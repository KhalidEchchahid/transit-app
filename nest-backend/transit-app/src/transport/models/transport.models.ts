// Mirrors Go models/models.go

export interface Line {
  id: number;
  code: string;
  name: string;
  type: string; // tram | bus | busway | train
  color: string;
  operator_id: number;
  origin: string;
  destination: string;
  stop_count?: number;
}

export interface Stop {
  id: number;
  code: string;
  name: string;
  lat: number;
  lon: number;
  type: string;
  sequence?: number;
}

export interface LineDetails {
  line: Line;
  stops: Stop[];
}

export interface StopDetails {
  stop: Stop;
  lines: Line[];
}
