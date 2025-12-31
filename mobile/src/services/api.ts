import { API_BASE_URL, REQUEST_TIMEOUT } from '../lib/constants';
import type {
  Line,
  LineDetails,
  StopDetails,
  Stop,
  Journey,
  ViewportBounds,
  RouteRequest,
  HealthResponse,
} from '../lib/types';
import type {
  AuthResponse,
  SignUpRequest,
  SignInRequest,
  User,
} from '../lib/auth-types';

/**
 * Custom fetch with timeout and error handling
 */
async function fetchWithTimeout<T>(
  url: string,
  options: RequestInit = {},
  timeout: number = REQUEST_TIMEOUT
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        // Handle NestJS validation errors (array of messages)
        if (Array.isArray(errorData.message)) {
          errorMessage = errorData.message.join('. ');
        } else if (typeof errorData.message === 'string') {
          errorMessage = errorData.message;
        } else if (typeof errorData.error === 'string') {
          errorMessage = errorData.error;
        }
      } catch {
        // If JSON parsing fails, try to get text
        errorMessage = await response.text() || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    }
    
    throw new Error('Unknown error occurred');
  }
}

/**
 * API service for transport data
 */
export const api = {
  /**
   * Health check
   */
  async getHealth(): Promise<HealthResponse> {
    return fetchWithTimeout<HealthResponse>(`${API_BASE_URL.replace('/api/v1', '')}/health`);
  },

  // ========== AUTH ==========

  /**
   * Sign up a new user
   */
  async signUp(data: SignUpRequest): Promise<AuthResponse> {
    return fetchWithTimeout<AuthResponse>(`${API_BASE_URL.replace('/api/v1', '')}/auth/signup`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Sign in an existing user
   */
  async signIn(data: SignInRequest): Promise<AuthResponse> {
    return fetchWithTimeout<AuthResponse>(`${API_BASE_URL.replace('/api/v1', '')}/auth/signin`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get current user profile (requires auth token)
   */
  async getProfile(token: string): Promise<User> {
    return fetchWithTimeout<User>(`${API_BASE_URL.replace('/api/v1', '')}/auth/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },

  // ========== TRANSPORT ==========

  /**
   * Get all lines
   */
  async getLines(): Promise<Line[]> {
    return fetchWithTimeout<Line[]>(`${API_BASE_URL}/lines`);
  },

  /**
   * Get line details including stops
   */
  async getLineDetails(id: number | string): Promise<LineDetails> {
    return fetchWithTimeout<LineDetails>(`${API_BASE_URL}/lines/${id}`);
  },

  /**
   * Get stops within viewport bounds
   */
  async getStopsInViewport(bounds: ViewportBounds): Promise<Stop[]> {
    const params = new URLSearchParams({
      min_lat: String(bounds.minLat),
      min_lon: String(bounds.minLon),
      max_lat: String(bounds.maxLat),
      max_lon: String(bounds.maxLon),
    });
    return fetchWithTimeout<Stop[]>(`${API_BASE_URL}/stops?${params.toString()}`);
  },

  /**
   * Get stop details (stop + connected lines)
   */
  async getStopDetails(id: number): Promise<StopDetails> {
    return fetchWithTimeout<StopDetails>(`${API_BASE_URL}/stops/${id}`);
  },

  /**
   * Get route between two points
   */
  async getRoute(request: RouteRequest): Promise<Journey> {
    const params = new URLSearchParams({
      from_lat: String(request.fromLat),
      from_lon: String(request.fromLon),
      to_lat: String(request.toLat),
      to_lon: String(request.toLon),
    });

    if (request.time !== undefined) {
      params.append('time', String(request.time));
    }

    if (request.day) {
      params.append('day', request.day);
    }

    return fetchWithTimeout<Journey>(`${API_BASE_URL}/route?${params.toString()}`);
  },
};

/**
 * Utility function to get current time in seconds from midnight
 */
export function getTimeInSeconds(date: Date = new Date()): number {
  return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
}

/**
 * Utility function to format seconds to HH:MM
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Utility function to format duration
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes} min`;
}

/**
 * Get day type from date
 */
export function getDayType(date: Date): 'weekday' | 'saturday' | 'sunday' {
  const day = date.getDay();
  if (day === 0) return 'sunday';
  if (day === 6) return 'saturday';
  return 'weekday';
}
