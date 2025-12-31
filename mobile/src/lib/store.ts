import { create } from 'zustand';
import type { Stop, Journey, TransportMode } from '@/lib/types';

// Journey Planner Store
interface JourneyPlannerState {
  originStop: Stop | null;
  destinationStop: Stop | null;
  journey: Journey | null;
  isLoading: boolean;
  error: string | null;
  dayType: 'weekday' | 'saturday' | 'sunday';
  
  setOriginStop: (stop: Stop | null) => void;
  setDestinationStop: (stop: Stop | null) => void;
  swapStops: () => void;
  setJourney: (journey: Journey | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setDayType: (dayType: 'weekday' | 'saturday' | 'sunday') => void;
  reset: () => void;
}

export const useJourneyPlannerStore = create<JourneyPlannerState>((set, get) => ({
  originStop: null,
  destinationStop: null,
  journey: null,
  isLoading: false,
  error: null,
  dayType: 'weekday',
  
  setOriginStop: (stop) => set({ originStop: stop, journey: null, error: null }),
  setDestinationStop: (stop) => set({ destinationStop: stop, journey: null, error: null }),
  swapStops: () => {
    const { originStop, destinationStop } = get();
    set({ 
      originStop: destinationStop, 
      destinationStop: originStop,
      journey: null,
      error: null,
    });
  },
  setJourney: (journey) => set({ journey, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  setDayType: (dayType) => set({ dayType }),
  reset: () => set({ 
    originStop: null, 
    destinationStop: null, 
    journey: null,
    isLoading: false,
    error: null,
  }),
}));

// Map State Store
interface MapState {
  selectedLineId: string | null;
  selectedStopId: string | null;
  mapClickMode: 'origin' | 'destination' | null;
  showStops: boolean;
  showLines: boolean;
  visibleModes: TransportMode[];
  
  setSelectedLineId: (lineId: string | null) => void;
  setSelectedStopId: (stopId: string | null) => void;
  setMapClickMode: (mode: 'origin' | 'destination' | null) => void;
  toggleShowStops: () => void;
  toggleShowLines: () => void;
  setVisibleModes: (modes: TransportMode[]) => void;
  toggleMode: (mode: TransportMode) => void;
}

const ALL_MODES: TransportMode[] = ['bus', 'tram', 'busway', 'train'];

export const useMapStore = create<MapState>((set, get) => ({
  selectedLineId: null,
  selectedStopId: null,
  mapClickMode: null,
  showStops: true,
  showLines: true,
  visibleModes: ALL_MODES,
  
  setSelectedLineId: (lineId) => set({ selectedLineId: lineId }),
  setSelectedStopId: (stopId) => set({ selectedStopId: stopId }),
  setMapClickMode: (mode) => set({ mapClickMode: mode }),
  toggleShowStops: () => set((state) => ({ showStops: !state.showStops })),
  toggleShowLines: () => set((state) => ({ showLines: !state.showLines })),
  setVisibleModes: (modes) => set({ visibleModes: modes }),
  toggleMode: (mode) => {
    const { visibleModes } = get();
    if (visibleModes.includes(mode)) {
      set({ visibleModes: visibleModes.filter(m => m !== mode) });
    } else {
      set({ visibleModes: [...visibleModes, mode] });
    }
  },
}));

// Filter Store for Lines/Stops screens
interface FilterState {
  searchQuery: string;
  selectedModes: TransportMode[];
  sortBy: 'name' | 'distance' | 'mode';
  
  setSearchQuery: (query: string) => void;
  setSelectedModes: (modes: TransportMode[]) => void;
  toggleMode: (mode: TransportMode) => void;
  setSortBy: (sortBy: 'name' | 'distance' | 'mode') => void;
  clearFilters: () => void;
}

export const useFilterStore = create<FilterState>((set, get) => ({
  searchQuery: '',
  selectedModes: ALL_MODES,
  sortBy: 'name',
  
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedModes: (modes) => set({ selectedModes: modes }),
  toggleMode: (mode) => {
    const { selectedModes } = get();
    if (selectedModes.includes(mode)) {
      if (selectedModes.length > 1) {
        set({ selectedModes: selectedModes.filter(m => m !== mode) });
      }
    } else {
      set({ selectedModes: [...selectedModes, mode] });
    }
  },
  setSortBy: (sortBy) => set({ sortBy }),
  clearFilters: () => set({ searchQuery: '', selectedModes: ALL_MODES, sortBy: 'name' }),
}));

// App Settings Store
interface SettingsState {
  hapticFeedback: boolean;
  showDistances: boolean;
  preferredModes: TransportMode[];
  maxWalkingDistance: number; // in meters
  
  setHapticFeedback: (enabled: boolean) => void;
  setShowDistances: (enabled: boolean) => void;
  setPreferredModes: (modes: TransportMode[]) => void;
  setMaxWalkingDistance: (distance: number) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  hapticFeedback: true,
  showDistances: true,
  preferredModes: ALL_MODES,
  maxWalkingDistance: 1000,
  
  setHapticFeedback: (enabled) => set({ hapticFeedback: enabled }),
  setShowDistances: (enabled) => set({ showDistances: enabled }),
  setPreferredModes: (modes) => set({ preferredModes: modes }),
  setMaxWalkingDistance: (distance) => set({ maxWalkingDistance: distance }),
}));
