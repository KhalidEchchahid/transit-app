import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getTimeInSeconds, getDayType } from '@/services/api';
import type {
  Line,
  LineDetails,
  StopDetails,
  Stop,
  Journey,
  ViewportBounds,
  RouteRequest,
} from '@/lib/types';

// Query keys
export const queryKeys = {
  lines: ['lines'] as const,
  lineDetails: (id: number | string) => ['lines', id] as const,
  stops: (bounds: ViewportBounds) => ['stops', bounds] as const,
  stopDetails: (id: number) => ['stops', id] as const,
  route: (request: RouteRequest) => ['route', request] as const,
  health: ['health'] as const,
};

/**
 * Hook to fetch all lines
 */
export function useLines() {
  return useQuery({
    queryKey: queryKeys.lines,
    queryFn: () => api.getLines(),
    staleTime: 1000 * 60 * 30, // 30 minutes - lines don't change often
  });
}

/**
 * Hook to fetch line details
 */
export function useLineDetails(id: number | string | null) {
  return useQuery({
    queryKey: queryKeys.lineDetails(id!),
    queryFn: () => api.getLineDetails(id!),
    enabled: id !== null,
    staleTime: 1000 * 60 * 15, // 15 minutes
  });
}

/**
 * Hook to fetch stops in viewport
 */
export function useStopsInViewport(bounds: ViewportBounds | null) {
  return useQuery({
    queryKey: queryKeys.stops(bounds!),
    queryFn: () => api.getStopsInViewport(bounds!),
    enabled: bounds !== null,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch stop details (stop + connected lines)
 */
export function useStopDetails(id: number | null) {
  return useQuery({
    queryKey: id === null ? ['stops', 'null'] : queryKeys.stopDetails(id),
    queryFn: () => api.getStopDetails(id!),
    enabled: id !== null,
    staleTime: 1000 * 60 * 15,
  });
}

/**
 * Hook for route planning with mutation
 */
export function useRoutePlanning() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: {
      origin: Stop;
      destination: Stop;
      departureTime?: 'now' | Date;
      dayType?: 'weekday' | 'saturday' | 'sunday';
    }) => {
      const { origin, destination, departureTime = 'now', dayType } = request;
      
      const time = departureTime === 'now' 
        ? getTimeInSeconds() 
        : getTimeInSeconds(departureTime);
      
      const day = dayType || (departureTime === 'now' ? getDayType(new Date()) : getDayType(departureTime as Date));

      return api.getRoute({
        fromLat: origin.lat,
        fromLon: origin.lon,
        toLat: destination.lat,
        toLon: destination.lon,
        time,
        day,
      });
    },
    onSuccess: (data, variables) => {
      // Cache the route result
      queryClient.setQueryData(
        queryKeys.route({
          fromLat: variables.origin.lat,
          fromLon: variables.origin.lon,
          toLat: variables.destination.lat,
          toLon: variables.destination.lon,
        }),
        data
      );
    },
  });
}

/**
 * Hook for health check
 */
export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api.getHealth(),
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // Refetch every minute
  });
}

/**
 * Hook for prefetching line details
 */
export function usePrefetchLineDetails() {
  const queryClient = useQueryClient();

  return (id: number | string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.lineDetails(id),
      queryFn: () => api.getLineDetails(id),
      staleTime: 1000 * 60 * 15,
    });
  };
}

/**
 * Hook for invalidating queries
 */
export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  return {
    invalidateLines: () => queryClient.invalidateQueries({ queryKey: queryKeys.lines }),
    invalidateStops: () => queryClient.invalidateQueries({ queryKey: ['stops'] }),
    invalidateAll: () => queryClient.invalidateQueries(),
  };
}
