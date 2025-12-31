import { Platform } from 'react-native';
import Constants from 'expo-constants';

const normalizeUrl = (url: string) => url.replace(/\/+$/, '');

const extractHostFromExpo = (): string | null => {
  // Expo can expose the dev server host in different places depending on SDK/runtime.
  // We try the common ones and parse out the hostname/IP.
  const rawHost =
    (Constants as any)?.expoConfig?.hostUri ||
    (Constants as any)?.expoConfig?.debuggerHost ||
    (Constants as any)?.manifest?.debuggerHost ||
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoClient?.debuggerHost;

  if (typeof rawHost !== 'string' || rawHost.trim().length === 0) return null;

  // hostUri/debuggerHost often looks like "192.168.1.50:19000".
  const trimmed = rawHost.trim();
  const hostPort = trimmed.includes('://') ? trimmed.split('://')[1] : trimmed;
  const host = hostPort.split('/')[0]?.split(':')[0];
  if (!host || host.length === 0) return null;
  return host;
};

// API base URL - adjust for your environment
// For Android emulator, use 10.0.2.2 instead of localhost
// For iOS simulator, localhost works fine
const getBaseUrl = () => {
  // Allow overriding the API URL at runtime (works in Expo Go).
  // Example:
  //   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:8080/api/v1
  //
  // Note: Expo only exposes env vars prefixed with EXPO_PUBLIC_.
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return normalizeUrl(envUrl.trim());
  }

  if (__DEV__) {
    // Development mode
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:8080/api/v1';
    }

    // If running on a physical device (Expo Go), localhost will not resolve.
    // Use the Expo dev-server host as a best-effort LAN fallback.
    const expoHost = extractHostFromExpo();
    if (expoHost) {
      return `http://${expoHost}:8080/api/v1`;
    }

    return 'http://localhost:8080/api/v1';
  }
  // Production - replace with your actual API URL
  return 'https://api.casatransit.ma/api/v1';
};

export const API_BASE_URL = getBaseUrl();

// Request timeout in milliseconds
export const REQUEST_TIMEOUT = 15000;

// Retry configuration
export const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000,
};

// Casablanca default coordinates
export const DEFAULT_CENTER = {
  latitude: 33.5928,
  longitude: -7.6175,
};

export const DEFAULT_ZOOM = 12;

// Map bounds for Casablanca region
export const MAP_BOUNDS = {
  minLatitude: 33.4,
  maxLatitude: 33.8,
  minLongitude: -7.9,
  maxLongitude: -7.3,
};

// Transport mode colors matching web frontend
export const MODE_COLORS: Record<string, string> = {
  walk: '#000000',
  bus: '#0B2C6F',
  busway: '#0F7A0F',
  tram: '#D6452F',
  train: '#D10000',
  taxi: '#C58F00',
};

// Special route colors
export const ROUTE_COLORS: Record<string, string> = {
  BW1: '#05780F',
  BW2: '#50DC64',
  T1: '#D6452F',
  T2: 'rgba(255,220,0,1)',
  T3: 'rgba(168,103,125,1)',
  T4: 'rgba(86,147,193,1)',
};

// Day types for scheduling
export const DAY_TYPES = {
  WEEKDAY: 'weekday',
  SATURDAY: 'saturday',
  SUNDAY: 'sunday',
  WEEKEND: 'weekend',
} as const;

// Cache keys
export const CACHE_KEYS = {
  LINES: 'lines',
  STOPS: 'stops',
  FAVORITES: 'favorites',
  RECENT_SEARCHES: 'recent_searches',
  THEME: 'theme',
} as const;

// Storage keys
export const STORAGE_KEYS = {
  THEME: 'casa-transit-theme',
  FAVORITES: 'casa-transit-favorites',
  RECENT_JOURNEYS: 'casa-transit-recent-journeys',
  ONBOARDING_COMPLETE: 'casa-transit-onboarding',
} as const;

// Animation durations
export const ANIMATION = {
  FAST: 120,
  NORMAL: 160,
  SLOW: 300,
} as const;

// Touch target sizes (accessibility)
export const TOUCH_TARGETS = {
  MINIMUM: 44,
  COMFORTABLE: 48,
  LARGE: 56,
} as const;
