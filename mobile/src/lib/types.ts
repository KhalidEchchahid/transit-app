// Type definitions matching the backend API

export interface Line {
  id: number;
  code: string;
  name: string;
  type: TransportType;
  color: string;
  operator_id?: number;
  origin: string;
  destination: string;
  stop_count?: number;
  schedule?: LineSchedule;

  // Some screens treat lines as optionally hydrated with stops.
  // The backend /lines endpoint does not currently include these.
  stops?: Stop[];
}

export interface LineSchedule {
  first_departure?: string;
  last_departure?: string;
  frequency?: string;
}

export interface Stop {
  id: number | string;
  code?: string;
  name: string;
  lat: number;
  lon: number;
  type?: string;
  sequence?: number;
  lines?: string[];
}

export interface LineDetails {
  line: Line;
  stops: Stop[];
}

export interface StopDetails {
  stop: Stop;
  lines: Line[];
}

export type TransportType = 'bus' | 'tram' | 'train' | 'busway' | 'taxi';

// Used across UI for coloring & filtering (includes walking legs).
export type TransportMode = TransportType | 'walk';

// Back-compat alias for screens that used an older naming.
export type TransportLine = Line;

export interface JourneyLeg {
  type: string;
  fromStop: Stop;
  toStop: Stop;
  startTime: string;
  endTime: string;
  duration: number;
  routeCode: string;
  routeColor: string;
  waitTime: number;
  stops?: Stop[];
  geometry?: [number, number][];
}

export interface Journey {
  legs: JourneyLeg[];
}

export interface CondensedLeg {
  mode: string;
  routeCode: string;
  color: string;
  fromStop: Stop;
  toStop: Stop;
  startTime?: string;
  endTime?: string;
  duration: number;
  waitTime?: number;
  isWalk: boolean;
  segments: JourneyLeg[];
  stops: Stop[];
}

export interface ViewportBounds {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

export interface RouteRequest {
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  time?: number; // seconds from midnight
  day?: 'weekday' | 'saturday' | 'sunday' | 'weekend';
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  db: 'connected' | 'disconnected';
}

// Planner types
export interface PlannerState {
  origin: Stop | null;
  destination: Stop | null;
  departureTime: 'now' | Date;
  dayType: 'weekday' | 'saturday' | 'sunday';
  modes: TransportType[];
}

// Favorites types
export interface FavoriteStop {
  stop: Stop;
  addedAt: number;
  nickname?: string;
}

export interface FavoriteLine {
  line: Line;
  addedAt: number;
}

export interface RecentJourney {
  origin: Stop;
  destination: Stop;
  timestamp: number;
}

// Map types
export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface MapMarker {
  id: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  type: 'stop' | 'origin' | 'destination' | 'custom';
  data?: Stop;
}

export interface MapPolyline {
  id: string;
  coordinates: Array<{
    latitude: number;
    longitude: number;
  }>;
  color: string;
  width: number;
  isWalk?: boolean;
}
