import React, { memo, useCallback, useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, Layout } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { useStopsInViewport } from '@/hooks/useTransport';
import { useLocation, formatDistance, calculateDistance } from '@/hooks/useLocation';
import { Button, Badge, Card, Input, ModeIcon, LineBadge, SkeletonCard, EmptyState } from '@/components/ui';
import { DEFAULT_CENTER } from '@/lib/constants';
import type { Stop, TransportType } from '@/lib/types';

function StopsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { location, isLoading: locationLoading, refreshLocation, permissionStatus } = useLocation();
  
  const [searchQuery, setSearchQuery] = useState('');
  
  // Default viewport around user location or Casablanca center
  const viewport = useMemo(() => {
    const center = location || DEFAULT_CENTER;
    const delta = 0.02; // ~2km radius
    return {
      minLat: center.latitude - delta,
      maxLat: center.latitude + delta,
      minLon: center.longitude - delta,
      maxLon: center.longitude + delta,
    };
  }, [location]);

  const { data: stops, isLoading, error, refetch, isRefetching } = useStopsInViewport(viewport);

  // Sort stops by distance from user
  const sortedStops = useMemo(() => {
    if (!stops) return [];
    
    let filtered = stops;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = stops.filter((stop) =>
        stop.name?.toLowerCase().includes(query) ||
        stop.code?.toLowerCase().includes(query)
      );
    }

    // Sort by distance if location available
    if (location) {
      return [...filtered].sort((a, b) => {
        const distA = calculateDistance(location.latitude, location.longitude, a.lat, a.lon);
        const distB = calculateDistance(location.latitude, location.longitude, b.lat, b.lon);
        return distA - distB;
      });
    }

    return filtered;
  }, [stops, searchQuery, location]);

  // Request location on mount
  useEffect(() => {
    if (permissionStatus === 'granted' && !location) {
      refreshLocation();
    }
  }, [permissionStatus]);

  const handleStopPress = useCallback((stop: Stop) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/stop/${stop.id}`);
  }, [router]);

  const handleLocateMe = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await refreshLocation();
  }, [refreshLocation]);

  const renderStop = useCallback(({ item, index }: { item: Stop; index: number }) => (
    <Animated.View
      entering={FadeIn.delay(index * 20).duration(150)}
      layout={Layout.springify()}
    >
      <StopCard
        stop={item}
        userLocation={location}
        onPress={() => handleStopPress(item)}
      />
    </Animated.View>
  ), [handleStopPress, location]);

  const keyExtractor = useCallback((item: Stop) => String(item.id), []);

  const renderEmptyState = useCallback(() => {
    if (isLoading || locationLoading) {
      return (
        <View style={{ padding: theme.spacing[4], gap: theme.spacing[3] }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </View>
      );
    }

    if (error) {
      return (
        <EmptyState
          title="Failed to Load"
          message="Could not load nearby stops. Please try again."
          icon="alert-circle-outline"
          action={{ label: 'Retry', onPress: refetch }}
          style={{ margin: theme.spacing[4] }}
        />
      );
    }

    if (searchQuery) {
      return (
        <EmptyState
          title="No Stops Found"
          message="Try a different search term."
          icon="search-outline"
          action={{ label: 'Clear Search', onPress: () => setSearchQuery('') }}
          style={{ margin: theme.spacing[4] }}
        />
      );
    }

    return (
      <EmptyState
        title="No Nearby Stops"
        message="Enable location to find stops near you."
        icon="location-outline"
        action={{ label: 'Enable Location', onPress: refreshLocation }}
        style={{ margin: theme.spacing[4] }}
      />
    );
  }, [isLoading, locationLoading, error, searchQuery, theme, refetch, refreshLocation]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      paddingTop: insets.top,
      paddingHorizontal: theme.spacing[4],
      paddingBottom: theme.spacing[4],
      backgroundColor: theme.colors.accent,
      borderBottomWidth: theme.borderWidths.thick,
      borderBottomColor: theme.colors.border,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing[3],
    },
    headerTitle: {
      fontFamily: theme.typography.fonts.heading,
      fontSize: theme.typography.sizes['2xl'],
      color: theme.colors.accentForeground,
      textTransform: 'uppercase',
      letterSpacing: theme.typography.letterSpacing.wider,
    },
    searchContainer: {
      backgroundColor: theme.colors.background,
      borderWidth: theme.borderWidths.base,
      borderColor: theme.colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing[3],
    },
    searchInput: {
      flex: 1,
      fontFamily: theme.typography.fonts.regular,
      fontSize: theme.typography.sizes.base,
      color: theme.colors.foreground,
      paddingVertical: theme.spacing[3],
    },
    locationBar: {
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[3],
      backgroundColor: theme.colors.card,
      borderBottomWidth: theme.borderWidths.base,
      borderBottomColor: theme.colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
    },
    locationText: {
      fontFamily: theme.typography.fonts.regular,
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.mutedForeground,
      flex: 1,
    },
    resultCount: {
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[2],
      fontFamily: theme.typography.fonts.regular,
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.mutedForeground,
    },
    list: {
      flex: 1,
    },
    listContent: {
      padding: theme.spacing[4],
      paddingBottom: insets.bottom + theme.spacing[4],
      gap: theme.spacing[3],
    },
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Stops</Text>
          <TouchableOpacity
            onPress={handleLocateMe}
            style={{
              padding: theme.spacing[2],
              backgroundColor: theme.colors.background,
              borderWidth: theme.borderWidths.base,
              borderColor: theme.colors.border,
            }}
            accessibilityLabel="Find my location"
          >
            <Ionicons
              name={locationLoading ? 'sync' : 'locate'}
              size={24}
              color={theme.colors.foreground}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color={theme.colors.mutedForeground}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search stops..."
            placeholderTextColor={theme.colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons
                name="close-circle"
                size={20}
                color={theme.colors.mutedForeground}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Location Status */}
      <View style={styles.locationBar}>
        <Ionicons
          name={location ? 'location' : 'location-outline'}
          size={16}
          color={location ? theme.colors.modes.busway : theme.colors.mutedForeground}
        />
        <Text style={styles.locationText}>
          {locationLoading
            ? 'Getting your location...'
            : location
            ? `Showing stops near you`
            : 'Location not available'}
        </Text>
      </View>

      {/* Results Count */}
      {!isLoading && sortedStops.length > 0 && (
        <Text style={styles.resultCount}>
          {sortedStops.length} stop{sortedStops.length !== 1 ? 's' : ''} nearby
        </Text>
      )}

      {/* Stops List */}
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={sortedStops}
        renderItem={renderStop}
        keyExtractor={keyExtractor}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              refreshLocation();
              refetch();
            }}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={8}
      />
    </View>
  );
}

// Memoized Stop Card component
interface StopCardProps {
  stop: Stop;
  userLocation: { latitude: number; longitude: number } | null;
  onPress: () => void;
}

const StopCard = memo(function StopCard({ stop, userLocation, onPress }: StopCardProps) {
  const { theme } = useTheme();

  const distance = useMemo(() => {
    if (!userLocation) return null;
    return calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      stop.lat,
      stop.lon
    );
  }, [userLocation, stop.lat, stop.lon]);

  return (
    <Card
      onPress={onPress}
      style={{ minHeight: 80 }}
      accessibilityLabel={`Stop ${stop.name}${distance ? `, ${formatDistance(distance)} away` : ''}`}
    >
      <View style={{ flexDirection: 'row', gap: theme.spacing[3], alignItems: 'center' }}>
        {/* Stop Icon */}
        <View
          style={{
            width: 44,
            height: 44,
            backgroundColor: theme.colors.primary,
            borderWidth: theme.borderWidths.base,
            borderColor: theme.colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="location" size={24} color={theme.colors.primaryForeground} />
        </View>

        {/* Stop Info */}
        <View style={{ flex: 1, gap: theme.spacing[1] }}>
          <Text
            style={{
              fontFamily: theme.typography.fonts.heading,
              fontSize: theme.typography.sizes.md,
              color: theme.colors.foreground,
            }}
            numberOfLines={1}
          >
            {stop.name}
          </Text>

          {stop.code && (
            <Text
              style={{
                fontFamily: theme.typography.fonts.regular,
                fontSize: theme.typography.sizes.xs,
                color: theme.colors.mutedForeground,
                textTransform: 'uppercase',
              }}
            >
              {stop.code}
            </Text>
          )}

          {stop.lines && stop.lines.length > 0 && (
            <View style={{ flexDirection: 'row', gap: theme.spacing[1], flexWrap: 'wrap' }}>
              {stop.lines.slice(0, 4).map((lineCode, idx) => (
                <Badge key={`${lineCode}-${idx}`} tone="muted" size="sm">
                  {lineCode}
                </Badge>
              ))}
              {stop.lines.length > 4 && (
                <Badge tone="muted" size="sm">
                  +{stop.lines.length - 4}
                </Badge>
              )}
            </View>
          )}
        </View>

        {/* Distance */}
        {distance !== null && (
          <View style={{ alignItems: 'flex-end', gap: theme.spacing[1] }}>
            <Text
              style={{
                fontFamily: theme.typography.fonts.bold,
                fontSize: theme.typography.sizes.md,
                color: theme.colors.foreground,
              }}
            >
              {formatDistance(distance)}
            </Text>
            <Ionicons name="walk" size={16} color={theme.colors.mutedForeground} />
          </View>
        )}

        {/* Arrow */}
        <Ionicons
          name="chevron-forward"
          size={24}
          color={theme.colors.mutedForeground}
        />
      </View>
    </Card>
  );
});

export default StopsScreen;
