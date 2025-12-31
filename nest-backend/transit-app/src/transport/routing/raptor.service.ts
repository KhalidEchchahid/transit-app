import { Injectable } from '@nestjs/common';
import { RaptorLoader } from './raptor-loader.service';
import {
  Journey,
  JourneyLeg,
  RaptorData,
  RaptorRoute,
  RaptorStop,
  RouteID,
  StopID,
} from './types';
import { Stop } from '../models/transport.models';

const MAX_ROUNDS = 6;
const INFINITY = Number.MAX_SAFE_INTEGER;
const WALK_ROUTE_ID = -1;

interface Label {
  fromStop: StopID;
  routeId: number;
  tripId: number;
  boardTime: number;
}

@Injectable()
export class RaptorService {
  constructor(private readonly loader: RaptorLoader) {}

  private get data(): RaptorData {
    return this.loader.getData();
  }

  /**
   * Convert DB stops to internal StopID with initial walk times.
   */
  convertStopsToIds(stops: Stop[], initialWalk: number): Map<StopID, number> {
    const result = new Map<StopID, number>();
    for (const s of stops) {
      const id = this.data.dbIdToStopId.get(s.id);
      if (id !== undefined) {
        result.set(id, initialWalk);
      }
    }
    return result;
  }

  /**
   * Run the RAPTOR algorithm to find a journey.
   */
  findRoute(
    sourceStops: Map<StopID, number>,
    targetStops: Set<StopID>,
    departureTime: number,
    dayType: string,
  ): Journey | null {
    const data = this.data;

    // rounds[k][stopID] -> earliest arrival time
    const rounds: number[][] = [];
    for (let k = 0; k <= MAX_ROUNDS; k++) {
      rounds.push(Array.from({ length: data.stops.length }, () => INFINITY));
    }

    let markedStops = new Set<StopID>();

    // Initialize round 0 with source stops
    for (const [stopId, walkTime] of sourceStops) {
      rounds[0][stopId] = departureTime + walkTime;
      markedStops.add(stopId);
    }

    // Labels for path reconstruction
    const labels: Label[][] = [];
    for (let k = 0; k <= MAX_ROUNDS; k++) {
      labels.push(
        new Array(data.stops.length).fill(null).map(() => ({
          fromStop: -1,
          routeId: -1,
          tripId: -1,
          boardTime: -1,
        })),
      );
    }

    // Build stop -> routes index
    const stopRoutes = this.buildStopRoutesIndex();

    for (let k = 1; k <= MAX_ROUNDS; k++) {
      // Copy previous round as baseline
      for (let i = 0; i < data.stops.length; i++) {
        rounds[k][i] = rounds[k - 1][i];
      }

      // Accumulate routes to process
      const routesToProcess = new Map<RouteID, StopID>();
      for (const stopId of markedStops) {
        const rids = stopRoutes.get(stopId);
        if (rids) {
          for (const rid of rids) {
            const existing = routesToProcess.get(rid);
            if (existing !== undefined) {
              if (
                this.getStopIndex(rid, stopId) <
                this.getStopIndex(rid, existing)
              ) {
                routesToProcess.set(rid, stopId);
              }
            } else {
              routesToProcess.set(rid, stopId);
            }
          }
        }
      }

      markedStops = new Set<StopID>();

      // Process routes
      for (const [rid, startStopId] of routesToProcess) {
        const route = data.routes[rid];
        let currentTrip: { tripIdx: number; stopTimes: number[] } | null = null;
        let boardStop: StopID = -1;
        let boardTime = 0;

        const startIdx = this.getStopIndex(rid, startStopId);
        for (let i = startIdx; i < route.stops.length; i++) {
          const stopId = route.stops[i];

          // Can we improve arrival at this stop?
          if (currentTrip !== null) {
            const arrivalTime = currentTrip.stopTimes[i];
            if (arrivalTime < rounds[k][stopId]) {
              rounds[k][stopId] = arrivalTime;
              labels[k][stopId] = {
                fromStop: boardStop,
                routeId: rid,
                tripId: currentTrip.tripIdx,
                boardTime,
              };
              markedStops.add(stopId);
            }
          }

          // Can we board a trip here?
          const prevArrival = rounds[k - 1][stopId];
          if (prevArrival < INFINITY) {
            let foundTrip = false;
            for (let t = 0; t < route.trips.length; t++) {
              const trip = route.trips[t];
              if (trip.serviceId !== dayType) continue;
              const dep = trip.stopTimes[i].departure;
              if (dep >= prevArrival) {
                currentTrip = {
                  tripIdx: t,
                  stopTimes: trip.stopTimes.map((st) => st.arrival),
                };
                boardStop = stopId;
                boardTime = dep;
                foundTrip = true;
                break;
              }
            }
            if (!foundTrip) {
              currentTrip = null;
            }
          }
        }
      }

      // Process transfers
      const transitMarked = [...markedStops];
      for (const stopId of transitMarked) {
        const arrivalTime = rounds[k][stopId];
        const transfers = data.transfers.get(stopId);
        if (transfers) {
          for (const tr of transfers) {
            const walkArr = arrivalTime + tr.timeSeconds;
            if (walkArr < rounds[k][tr.toStop]) {
              rounds[k][tr.toStop] = walkArr;
              labels[k][tr.toStop] = {
                fromStop: stopId,
                routeId: WALK_ROUTE_ID,
                tripId: -1,
                boardTime: arrivalTime,
              };
              markedStops.add(tr.toStop);
            }
          }
        }
      }

      if (markedStops.size === 0) break;
    }

    // Find best target
    let bestTime = INFINITY;
    let bestTarget: StopID = -1;
    for (const tStop of targetStops) {
      for (let k = 1; k <= MAX_ROUNDS; k++) {
        if (rounds[k][tStop] < bestTime) {
          bestTime = rounds[k][tStop];
          bestTarget = tStop;
        }
      }
    }

    if (bestTime === INFINITY) return null;

    // Reconstruct path
    const legs: JourneyLeg[] = [];
    let currentStop = bestTarget;

    let bestK = 0;
    for (let k = 1; k <= MAX_ROUNDS; k++) {
      if (rounds[k][bestTarget] === bestTime) {
        bestK = k;
        break;
      }
    }

    for (let k = bestK; k > 0; k--) {
      if (rounds[k][currentStop] === rounds[k - 1][currentStop]) continue;

      let label = labels[k][currentStop];
      let fromStop = label.fromStop;

      if (label.routeId === WALK_ROUTE_ID) {
        // Walk leg
        const walkStops = [data.stops[fromStop], data.stops[currentStop]];
        const walkGeom: [number, number][] = [
          [data.stops[fromStop].lon, data.stops[fromStop].lat],
          [data.stops[currentStop].lon, data.stops[currentStop].lat],
        ];

        legs.unshift({
          type: 'walk',
          fromStop: data.stops[fromStop],
          toStop: data.stops[currentStop],
          startTime: this.secondsToTime(label.boardTime),
          endTime: this.secondsToTime(rounds[k][currentStop]),
          duration: rounds[k][currentStop] - label.boardTime,
          routeCode: '',
          routeColor: '',
          waitTime: 0,
          stops: walkStops,
          geometry: walkGeom,
        });

        currentStop = fromStop;

        // Check if THIS stop was reached via transit in the SAME round
        if (rounds[k][currentStop] < rounds[k - 1][currentStop]) {
          label = labels[k][currentStop];
          fromStop = label.fromStop;
          const route = data.routes[label.routeId];
          const { stopsSeq, geom } = this.buildLegPath(
            route,
            fromStop,
            currentStop,
          );

          legs.unshift({
            type: 'transit',
            fromStop: data.stops[fromStop],
            toStop: data.stops[currentStop],
            startTime: this.secondsToTime(label.boardTime),
            endTime: this.secondsToTime(rounds[k][currentStop]),
            duration: rounds[k][currentStop] - label.boardTime,
            routeCode: route.lineCode,
            routeColor: route.lineColor,
            waitTime: 0,
            stops: stopsSeq,
            geometry: geom,
          });
          currentStop = fromStop;
        }
      } else {
        // Transit leg
        const route = data.routes[label.routeId];
        const { stopsSeq, geom } = this.buildLegPath(
          route,
          fromStop,
          currentStop,
        );

        legs.unshift({
          type: 'transit',
          fromStop: data.stops[fromStop],
          toStop: data.stops[currentStop],
          startTime: this.secondsToTime(label.boardTime),
          endTime: this.secondsToTime(rounds[k][currentStop]),
          duration: rounds[k][currentStop] - label.boardTime,
          routeCode: route.lineCode,
          routeColor: route.lineColor,
          waitTime: 0,
          stops: stopsSeq,
          geometry: geom,
        });
        currentStop = fromStop;
      }
    }

    return { legs };
  }

  private buildStopRoutesIndex(): Map<StopID, RouteID[]> {
    const idx = new Map<StopID, RouteID[]>();
    for (const route of this.data.routes) {
      for (const s of route.stops) {
        let list = idx.get(s);
        if (!list) {
          list = [];
          idx.set(s, list);
        }
        list.push(route.id);
      }
    }
    return idx;
  }

  private getStopIndex(rid: RouteID, sid: StopID): number {
    const route = this.data.routes[rid];
    return route.stops.indexOf(sid);
  }

  private buildLegPath(
    route: RaptorRoute,
    from: StopID,
    to: StopID,
  ): { stopsSeq: RaptorStop[]; geom: [number, number][] } {
    let fromIdx = this.getStopIndex(route.id, from);
    let toIdx = this.getStopIndex(route.id, to);
    if (fromIdx === -1 || toIdx === -1) return { stopsSeq: [], geom: [] };
    if (fromIdx > toIdx) [fromIdx, toIdx] = [toIdx, fromIdx];

    const sequence = route.stops.slice(fromIdx, toIdx + 1);
    const stopsSeq: RaptorStop[] = [];
    const geom: [number, number][] = [];

    for (const sid of sequence) {
      const st = this.data.stops[sid];
      stopsSeq.push(st);
      geom.push([st.lon, st.lat]);
    }

    return { stopsSeq, geom };
  }

  private secondsToTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}
