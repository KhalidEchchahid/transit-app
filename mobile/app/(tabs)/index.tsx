import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '@gorhom/bottom-sheet';
import Animated, { FadeIn, FadeOut, SlideInUp, SlideOutDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { TransitMap } from '@/components/map/TransitMap';
import { JourneyPlanner } from '@/components/planner/JourneyPlanner';
import { useStopsInViewport, useRoutePlanning } from '@/hooks/useTransport';
import { useLocation } from '@/hooks/useLocation';
import { Badge, Button, Card } from '@/components/ui';
import type { Stop, Journey, MapRegion } from '@/lib/types';
import { DEFAULT_CENTER } from '@/lib/constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function MapScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomSheetRef = useRef<BottomSheet>(null);

  // State
  const [originStop, setOriginStop] = useState<Stop | null>(null);
  const [destinationStop, setDestinationStop] = useState<Stop | null>(null);
  const [mapClickMode, setMapClickMode] = useState<'origin' | 'destination' | null>(null);
  const [currentRegion, setCurrentRegion] = useState<MapRegion>({
    latitude: DEFAULT_CENTER.latitude,
    longitude: DEFAULT_CENTER.longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [journey, setJourney] = useState<Journey | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Hooks
  const { location, refreshLocation, isLoading: locationLoading } = useLocation();
  // Viewport for stops
  const viewport = useMemo(() => ({
    minLat: currentRegion.latitude - currentRegion.latitudeDelta / 2,
    maxLat: currentRegion.latitude + currentRegion.latitudeDelta / 2,
    minLon: currentRegion.longitude - currentRegion.longitudeDelta / 2,
    maxLon: currentRegion.longitude + currentRegion.longitudeDelta / 2,
  }), [currentRegion]);

  const { data: stops } = useStopsInViewport(viewport);
  const routePlanning = useRoutePlanning();

  // Handle map region change
  const handleRegionChange = useCallback((region: MapRegion) => {
    setCurrentRegion(region);
  }, []);

  // Handle stop selection from map
  const handleStopPress = useCallback((stop: Stop) => {
    if (mapClickMode === 'origin') {
      setOriginStop(stop);
      setMapClickMode(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (mapClickMode === 'destination') {
      setDestinationStop(stop);
      setMapClickMode(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      // Show stop details
      router.push({
        pathname: '/stop/[id]',
        params: {
          id: String(stop.id),
          name: stop.name,
          lat: String(stop.lat),
          lon: String(stop.lon),
          type: stop.type || '',
          code: stop.code || '',
        },
      });
    }
  }, [mapClickMode, router]);

  // Handle map tap for custom location
  const handleMapPress = useCallback((coordinates: { latitude: number; longitude: number }) => {
    if (mapClickMode) {
      const customStop: Stop = {
        id: `custom-${Date.now()}`,
        name: `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`,
        lat: coordinates.latitude,
        lon: coordinates.longitude,
        type: 'custom',
      };

      if (mapClickMode === 'origin') {
        setOriginStop(customStop);
      } else {
        setDestinationStop(customStop);
      }
      setMapClickMode(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [mapClickMode]);

  // Handle map long press for context menu
  const handleMapLongPress = useCallback((coordinates: { latitude: number; longitude: number }) => {
    // For now, set as origin
    const customStop: Stop = {
      id: `custom-${Date.now()}`,
      name: `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`,
      lat: coordinates.latitude,
      lon: coordinates.longitude,
      type: 'custom',
    };
    setOriginStop(customStop);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  // Swap origin and destination
  const handleSwapStops = useCallback(() => {
    const temp = originStop;
    setOriginStop(destinationStop);
    setDestinationStop(temp);
    setJourney(null);
    setRouteError(null);
  }, [originStop, destinationStop]);

  // Compute route
  const handleComputeRoute = useCallback(async () => {
    if (!originStop || !destinationStop) return;

    setRouteError(null);
    setJourney(null);

    try {
      const result = await routePlanning.mutateAsync({
        origin: originStop,
        destination: destinationStop,
      });
      setJourney(result);
      
      // Expand bottom sheet to show results
      bottomSheetRef.current?.snapToIndex(2);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Route calculation failed';
      setRouteError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [originStop, destinationStop, routePlanning]);

  // Start selecting origin from map
  const handleSelectOriginFromMap = useCallback(() => {
    setMapClickMode('origin');
    bottomSheetRef.current?.snapToIndex(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  // Start selecting destination from map
  const handleSelectDestinationFromMap = useCallback(() => {
    setMapClickMode('destination');
    bottomSheetRef.current?.snapToIndex(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  // Center on user location
  const handleCenterOnUser = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await refreshLocation();
  }, [refreshLocation]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    mapContainer: {
      flex: 1,
    },
    mapControls: {
      position: 'absolute',
      right: theme.spacing[4],
      top: insets.top + 70,
      gap: theme.spacing[2],
      zIndex: 10,
    },
    mapControlButton: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
      borderWidth: theme.borderWidths.base,
      borderColor: theme.colors.border,
      ...theme.shadows.md,
    },
    selectModeOverlay: {
      position: 'absolute',
      top: insets.top + 70,
      left: theme.spacing[4],
      right: theme.spacing[4],
      zIndex: 20,
    },
    selectModeCard: {
      backgroundColor: theme.colors.accent,
      borderWidth: theme.borderWidths.thick,
      borderColor: theme.colors.border,
      padding: theme.spacing[4],
      ...theme.shadows.lg,
    },
    selectModeText: {
      fontFamily: theme.typography.fonts.heading,
      fontSize: theme.typography.sizes.md,
      color: theme.colors.accentForeground,
      textTransform: 'uppercase',
      textAlign: 'center',
    },
    selectModeHint: {
      fontFamily: theme.typography.fonts.regular,
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.accentForeground,
      textAlign: 'center',
      marginTop: theme.spacing[1],
    },
  });

  return (
    <View style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        <TransitMap
          stops={stops || []}
          journeyLegs={journey?.legs || []}
          originStop={originStop}
          destinationStop={destinationStop}
          userLocation={location}
          onStopPress={handleStopPress}
          onMapPress={handleMapPress}
          onMapLongPress={handleMapLongPress}
          onRegionChange={handleRegionChange}
          mapClickMode={mapClickMode}
          showStops={!journey}
        />
      </View>

      {/* Map Controls */}
      <View style={styles.mapControls}>
        <TouchableOpacity
          style={styles.mapControlButton}
          onPress={handleCenterOnUser}
          accessibilityLabel="Center on my location"
        >
          <Ionicons
            name={locationLoading ? 'sync' : 'locate'}
            size={24}
            color={theme.colors.foreground}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.mapControlButton}
          onPress={toggleTheme}
          accessibilityLabel="Toggle theme"
        >
          <Ionicons
            name={isDark ? 'sunny' : 'moon'}
            size={20}
            color={theme.colors.foreground}
          />
        </TouchableOpacity>
      </View>

      {/* Select Mode Overlay */}
      {mapClickMode && (
        <Animated.View
          entering={SlideInUp.duration(200)}
          exiting={SlideOutDown.duration(150)}
          style={styles.selectModeOverlay}
        >
          <View style={styles.selectModeCard}>
            <Text style={styles.selectModeText}>
              Select {mapClickMode === 'origin' ? 'Origin' : 'Destination'}
            </Text>
            <Text style={styles.selectModeHint}>
              Tap on the map or a stop marker
            </Text>
            <TouchableOpacity
              style={{
                marginTop: theme.spacing[3],
                alignSelf: 'center',
              }}
              onPress={() => setMapClickMode(null)}
            >
              <Text
                style={{
                  fontFamily: theme.typography.fonts.bold,
                  color: theme.colors.accentForeground,
                  textTransform: 'uppercase',
                  textDecorationLine: 'underline',
                }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Journey Planner Bottom Sheet */}
      <JourneyPlanner
        bottomSheetRef={bottomSheetRef}
        originStop={originStop}
        destinationStop={destinationStop}
        onOriginChange={setOriginStop}
        onDestinationChange={setDestinationStop}
        onSelectOriginFromMap={handleSelectOriginFromMap}
        onSelectDestinationFromMap={handleSelectDestinationFromMap}
        onStopPress={handleStopPress}
        journey={journey}
        isLoading={routePlanning.isPending}
        error={routeError}
        onComputeRoute={handleComputeRoute}
        onSwapStops={handleSwapStops}
      />
    </View>
  );
}
