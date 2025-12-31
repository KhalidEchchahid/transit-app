// RAPTOR routing types matching the Go backend

export type StopID = number;
export type RouteID = number;
export type TripID = number;

export interface RaptorStop {
  id: StopID;
  dbId: number;
  code: string;
  lat: number;
  lon: number;
  name: string;
}

export interface RaptorRoute {
  id: RouteID;
  stops: StopID[];
  trips: RaptorTrip[];
  lineId: number;
  lineCode: string;
  lineType: string;
  lineColor: string;
  price: number;
}

export interface RaptorTrip {
  id: TripID;
  stopTimes: StopTime[];
  serviceId: string; // "weekday" | "saturday" | "sunday"
}

export interface StopTime {
  arrival: number; // seconds from midnight
  departure: number;
}

export interface Transfer {
  toStop: StopID;
  timeSeconds: number;
}

export interface RaptorData {
  stops: RaptorStop[];
  routes: RaptorRoute[];
  transfers: Map<StopID, Transfer[]>;
  dbIdToStopId: Map<number, StopID>;
}

// Journey output

export interface JourneyLeg {
  type: 'transit' | 'walk';
  fromStop: RaptorStop;
  toStop: RaptorStop;
  startTime: string;
  endTime: string;
  duration: number;
  routeCode: string;
  routeColor: string;
  waitTime: number;
  stops?: RaptorStop[];
  geometry?: [number, number][];
}

export interface Journey {
  legs: JourneyLeg[];
}
