import React, { memo, useCallback, useRef, useEffect, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  Region,
  MapPressEvent,
  LongPressEvent,
  MarkerPressEvent,
} from 'react-native-maps';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { DEFAULT_CENTER } from '@/lib/constants';
import type { Stop, JourneyLeg, MapMarker, MapPolyline, MapRegion } from '@/lib/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Light mode map style (brutalist, minimal)
const LIGHT_MAP_STYLE = [
  {
    elementType: 'geometry',
    stylers: [{ color: '#f5f5f5' }],
  },
  {
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#000000' }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#ffffff' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#000000' }, { weight: 1 }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#c9c9c9' }],
  },
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'simplified' }],
  },
];

// Dark mode map style
const DARK_MAP_STYLE = [
  {
    elementType: 'geometry',
    stylers: [{ color: '#1a1a1a' }],
  },
  {
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#ffffff' }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#000000' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#2a2a2a' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#ffffff' }, { weight: 0.5 }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0a0a0a' }],
  },
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'simplified' }],
  },
];

interface TransitMapProps {
  stops?: Stop[];
  journeyLegs?: JourneyLeg[];
  originStop?: Stop | null;
  destinationStop?: Stop | null;
  userLocation?: { latitude: number; longitude: number } | null;
  onStopPress?: (stop: Stop) => void;
  onMapPress?: (coordinates: { latitude: number; longitude: number }) => void;
  onMapLongPress?: (coordinates: { latitude: number; longitude: number }) => void;
  onRegionChange?: (region: MapRegion) => void;
  mapClickMode?: 'origin' | 'destination' | null;
  showStops?: boolean;
  style?: any;
}

function TransitMapComponent({
  stops = [],
  journeyLegs = [],
  originStop,
  destinationStop,
  userLocation,
  onStopPress,
  onMapPress,
  onMapLongPress,
  onRegionChange,
  mapClickMode,
  showStops = true,
  style,
}: TransitMapProps) {
  const { theme, isDark } = useTheme();
  const mapRef = useRef<MapView>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  const normalizeRouteColor = useCallback(
    (value: string | undefined) => {
      if (!value) return null;
      const trimmed = value.trim();
      if (!trimmed) return null;

      if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
        if (trimmed.length === 9) {
          const alpha = Number.parseInt(trimmed.slice(7, 9), 16) / 255;
          if (Number.isFinite(alpha) && alpha < 0.2) return null;
        }
        return trimmed;
      }

      const rgba = trimmed.match(
        /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(\d*\.?\d+)\s*)?\)$/i
      );
      if (rgba) {
        const a = rgba[4] !== undefined ? Number(rgba[4]) : 1;
        if (Number.isFinite(a) && a < 0.2) return null;
        return trimmed;
      }

      return trimmed;
    },
    []
  );

  // Initial region
  const initialRegion: Region = {
    latitude: DEFAULT_CENTER.latitude,
    longitude: DEFAULT_CENTER.longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  // Convert journey legs to polylines
  const polylines = useMemo<MapPolyline[]>(() => {
    return journeyLegs.map((leg, index) => {
      const coordinates = leg.geometry
        ? leg.geometry.map(([lon, lat]) => ({ latitude: lat, longitude: lon }))
        : [
            { latitude: leg.fromStop.lat, longitude: leg.fromStop.lon },
            { latitude: leg.toStop.lat, longitude: leg.toStop.lon },
          ];

      const isWalk = leg.type?.toLowerCase() === 'walk';

      const baseColor =
        normalizeRouteColor(leg.routeColor) ||
        (isWalk ? theme.colors.foreground : theme.colors.primary);

      return {
        id: `leg-${index}`,
        coordinates,
        color: baseColor,
        width: isWalk ? 4 : 7,
        isWalk,
      };
    });
  }, [journeyLegs, theme, normalizeRouteColor]);

  const journeyStopDots = useMemo(() => {
    if (journeyLegs.length === 0) return null;

    type Dot = {
      key: string;
      latitude: number;
      longitude: number;
      color: string;
    };

    const seen = new Set<string>();
    const dots: Dot[] = [];

    for (let i = 0; i < journeyLegs.length; i++) {
      const leg = journeyLegs[i];
      const isWalk = (leg.type || '').toLowerCase() === 'walk';
      const dotColor = normalizeRouteColor(leg.routeColor) || (isWalk ? theme.colors.foreground : theme.colors.primary);

      const candidates: Stop[] = [];
      if (leg.fromStop) candidates.push(leg.fromStop);
      if (leg.stops && leg.stops.length > 0) candidates.push(...leg.stops);
      if (leg.toStop) candidates.push(leg.toStop);

      for (const stop of candidates) {
        if (!Number.isFinite(stop.lat) || !Number.isFinite(stop.lon)) continue;
        const idPart = stop.id ? String(stop.id) : '';
        const key = idPart || `${stop.lat.toFixed(6)}:${stop.lon.toFixed(6)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        dots.push({ key, latitude: stop.lat, longitude: stop.lon, color: dotColor });
      }
    }

    return dots;
  }, [journeyLegs, theme.colors.foreground, theme.colors.primary, normalizeRouteColor]);

  // Handle map ready
  const handleMapReady = useCallback(() => {
    setIsMapReady(true);
  }, []);

  // Handle stop marker press
  const handleStopPress = useCallback(
    (stop: Stop) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onStopPress?.(stop);
    },
    [onStopPress]
  );

  // Handle map press
  const handleMapPress = useCallback(
    (event: MapPressEvent) => {
      const { coordinate } = event.nativeEvent;
      if (mapClickMode) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      onMapPress?.(coordinate);
    },
    [onMapPress, mapClickMode]
  );

  // Handle map long press
  const handleMapLongPress = useCallback(
    (event: LongPressEvent) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const { coordinate } = event.nativeEvent;
      onMapLongPress?.(coordinate);
    },
    [onMapLongPress]
  );

  // Handle region change
  const handleRegionChangeComplete = useCallback(
    (region: Region) => {
      onRegionChange?.(region);
    },
    [onRegionChange]
  );

  // Fit to journey when legs change
  useEffect(() => {
    if (isMapReady && mapRef.current && journeyLegs.length > 0) {
      const allCoordinates = journeyLegs.flatMap((leg) => {
        if (leg.geometry) {
          return leg.geometry.map(([lon, lat]) => ({ latitude: lat, longitude: lon }));
        }
        return [
          { latitude: leg.fromStop.lat, longitude: leg.fromStop.lon },
          { latitude: leg.toStop.lat, longitude: leg.toStop.lon },
        ];
      });

      if (allCoordinates.length > 0) {
        mapRef.current.fitToCoordinates(allCoordinates, {
          edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
          animated: true,
        });
      }
    }
  }, [isMapReady, journeyLegs]);

  // Center on user location
  useEffect(() => {
    if (isMapReady && mapRef.current && userLocation && journeyLegs.length === 0) {
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  }, [isMapReady, userLocation, journeyLegs.length]);

  // Render stop markers (memoized for performance)
  const stopMarkers = useMemo(() => {
    if (!showStops) return null;

    return stops.slice(0, 100).map((stop) => (
      <Marker
        key={`stop-${stop.id}`}
        coordinate={{ latitude: stop.lat, longitude: stop.lon }}
        onPress={() => handleStopPress(stop)}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={false}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: isDark ? '#000000' : '#FFFFFF',
            borderWidth: 3,
            borderColor: isDark ? '#FFFFFF' : '#000000',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: theme.colors.destructive,
            }}
          />
        </View>
      </Marker>
    ));
  }, [stops, showStops, isDark, theme.colors.destructive, handleStopPress]);

  return (
    <View style={[styles.container, style]}>
      <MapView
        key={isDark ? 'map-dark' : 'map-light'}
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        customMapStyle={isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
        onMapReady={handleMapReady}
        onPress={handleMapPress}
        onLongPress={handleMapLongPress}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        showsBuildings={false}
        showsIndoors={false}
        showsTraffic={false}
        showsPointsOfInterest={false}
        mapPadding={{ top: 0, right: 0, bottom: 0, left: 0 }}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {/* Stop Markers */}
        {stopMarkers}

        {/* Journey Polylines */}
        {polylines.map((polyline) => (
          <React.Fragment key={polyline.id}>
            {/* Black outline for transit lines */}
            {!polyline.isWalk && (
              <Polyline
                coordinates={polyline.coordinates}
                strokeWidth={polyline.width + 4}
                strokeColor="#000000"
                lineCap="square"
                lineJoin="miter"
              />
            )}
            {/* Main line */}
            <Polyline
              coordinates={polyline.coordinates}
              strokeWidth={polyline.width}
              strokeColor={polyline.color}
              lineCap="square"
              lineJoin="miter"
              lineDashPattern={polyline.isWalk ? [8, 8] : undefined}
            />
          </React.Fragment>
        ))}

        {/* Journey stop dots (like web legs visualization) */}
        {journeyStopDots?.map((dot) => (
          <Marker
            key={`journey-dot-${dot.key}`}
            coordinate={{ latitude: dot.latitude, longitude: dot.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View
              style={{
                width: 12,
                height: 12,
                backgroundColor: '#FFFFFF',
                borderWidth: 2,
                borderColor: '#000000',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  backgroundColor: dot.color,
                }}
              />
            </View>
          </Marker>
        ))}

        {/* Origin Marker */}
        {originStop && (
          <Marker
            coordinate={{ latitude: originStop.lat, longitude: originStop.lon }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: theme.colors.modes.busway,
                borderWidth: 3,
                borderColor: theme.colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: '#FFFFFF',
                }}
              />
            </View>
          </Marker>
        )}

        {/* Destination Marker */}
        {destinationStop && (
          <Marker
            coordinate={{ latitude: destinationStop.lat, longitude: destinationStop.lon }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: theme.colors.primary,
                borderWidth: 3,
                borderColor: theme.colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: '#FFFFFF',
                }}
              />
            </View>
          </Marker>
        )}

        {/* User Location Marker (custom) */}
        {userLocation && (
          <Marker
            coordinate={userLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View
              style={{
                width: 20,
                height: 20,
                backgroundColor: theme.colors.modes.bus,
                borderWidth: 3,
                borderColor: '#FFFFFF',
                borderRadius: 10,
              }}
            />
          </Marker>
        )}
      </MapView>

      {/* Loading Overlay */}
      {!isMapReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const TransitMap = memo(TransitMapComponent);
