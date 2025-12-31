import React, { memo, useCallback, useState, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { useRoutePlanning } from '@/hooks/useTransport';
import { useLocation } from '@/hooks/useLocation';
import { formatDuration } from '@/services/api';
import { Button, Badge, Card, Input, Chip, ChipGroup, ModeIcon, LineBadge, Skeleton, EmptyState } from '@/components/ui';
import StopSearchInput from '@/components/planner/StopSearchInput';
import type { Stop, Journey, JourneyLeg, TransportType } from '@/lib/types';

function formatClockTime(value?: string) {
  if (!value) return '--:--';
  const trimmed = String(value).trim();
  // Backend uses HH:MM (optionally HH:MM:SS). Keep it simple.
  const m = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return trimmed;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface JourneyPlannerProps {
  originStop: Stop | null;
  destinationStop: Stop | null;
  onOriginChange: (stop: Stop | null) => void;
  onDestinationChange: (stop: Stop | null) => void;
  onSelectOriginFromMap: () => void;
  onSelectDestinationFromMap: () => void;
  onStopPress?: (stop: Stop) => void;
  journey: Journey | null;
  isLoading: boolean;
  error: string | null;
  onComputeRoute: () => void;
  onSwapStops: () => void;
  bottomSheetRef?: React.RefObject<BottomSheet | null>;
}

function JourneyPlannerComponent({
  originStop,
  destinationStop,
  onOriginChange,
  onDestinationChange,
  onSelectOriginFromMap,
  onSelectDestinationFromMap,
  onStopPress,
  journey,
  isLoading,
  error,
  onComputeRoute,
  onSwapStops,
  bottomSheetRef,
}: JourneyPlannerProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { location, refreshLocation } = useLocation();
  const [expandedLeg, setExpandedLeg] = useState<number | null>(null);
  const [dayType, setDayType] = useState<'weekday' | 'saturday' | 'sunday'>('weekday');

  // Determine current day type
  useEffect(() => {
    const today = new Date().getDay();
    if (today === 0) setDayType('sunday');
    else if (today === 6) setDayType('saturday');
    else setDayType('weekday');
  }, []);

  const snapPoints = useMemo(() => ['20%', '50%', '90%'], []);

  const handleUseMyLocation = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refreshLocation();
    if (location) {
      const customStop: Stop = {
        id: `custom-${Date.now()}`,
        name: 'My Location',
        lat: location.latitude,
        lon: location.longitude,
        type: 'custom',
      };
      onOriginChange(customStop);
    }
  }, [location, refreshLocation, onOriginChange]);

  const handleSwapStops = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSwapStops();
  }, [onSwapStops]);

  const handleComputeRoute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onComputeRoute();
  }, [onComputeRoute]);

  const toggleLegExpansion = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedLeg(expandedLeg === index ? null : index);
  }, [expandedLeg]);

  // Condense consecutive legs of same type
  const condensedLegs = useMemo(() => {
    if (!journey?.legs) return [];
    return journey.legs;
  }, [journey]);

  const summary = useMemo(() => {
    const legs = journey?.legs || [];
    const totalDuration = legs.reduce((acc, leg) => acc + (leg.duration || 0), 0);
    const totalWalkTime = legs
      .filter((leg) => (leg.type || '').toLowerCase() === 'walk')
      .reduce((acc, leg) => acc + (leg.duration || 0), 0);
    const totalWaitTime = legs.reduce((acc, leg) => acc + (leg.waitTime || 0), 0);
    const transitLegs = legs.filter((leg) => (leg.type || '').toLowerCase() !== 'walk');
    const transfers = Math.max(0, transitLegs.length - 1);
    return { totalDuration, totalWalkTime, totalWaitTime, transfers };
  }, [journey]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.card,
    },
    handleContainer: {
      alignItems: 'center',
      paddingVertical: theme.spacing[2],
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: theme.colors.border,
    },
    header: {
      paddingHorizontal: theme.spacing[4],
      paddingBottom: theme.spacing[3],
      borderBottomWidth: theme.borderWidths.base,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontFamily: theme.typography.fonts.heading,
      fontSize: theme.typography.sizes.lg,
      color: theme.colors.foreground,
      textTransform: 'uppercase',
      letterSpacing: theme.typography.letterSpacing.wide,
    },
    inputsContainer: {
      paddingHorizontal: theme.spacing[4],
      paddingTop: theme.spacing[4],
      gap: theme.spacing[3],
    },
    inputRow: {
      flexDirection: 'row',
      gap: theme.spacing[2],
    },
    inputWrapper: {
      flex: 1,
    },
    swapButton: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
      borderWidth: theme.borderWidths.base,
      borderColor: theme.colors.border,
      ...theme.shadows.sm,
    },
    dayTypeContainer: {
      paddingHorizontal: theme.spacing[4],
      paddingTop: theme.spacing[3],
    },
    actionContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[4],
    },
    computeButtonWrap: {
      flex: 1,
    },
    resultsContainer: {
      flex: 1,
      paddingHorizontal: theme.spacing[4],
    },
    summaryCard: {
      marginBottom: theme.spacing[4],
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    summaryMain: {
      fontFamily: theme.typography.fonts.heading,
      fontSize: theme.typography.sizes['2xl'],
      color: theme.colors.foreground,
    },
    summaryLabel: {
      fontFamily: theme.typography.fonts.regular,
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.mutedForeground,
      textTransform: 'uppercase',
    },
    legsContainer: {
      gap: theme.spacing[2],
      paddingBottom: insets.bottom + theme.spacing[4],
    },
  });

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose={false}
      backgroundStyle={{
        backgroundColor: theme.colors.card,
        borderTopWidth: theme.borderWidths.thick,
        borderColor: theme.colors.border,
        borderRadius: 0,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
      }}
      handleComponent={() => (
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>
      )}
    >
      <BottomSheetScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Plan Your Journey</Text>
        </View>

        {/* Origin & Destination Inputs */}
        <View style={styles.inputsContainer}>
          <View style={styles.inputRow}>
            <View style={styles.inputWrapper}>
              <StopSearchInput
                label="From"
                value={originStop}
                onChange={onOriginChange}
                onMapSelect={onSelectOriginFromMap}
                placeholder="Choose origin..."
              />
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputWrapper}>
              <StopSearchInput
                label="To"
                value={destinationStop}
                onChange={onDestinationChange}
                onMapSelect={onSelectDestinationFromMap}
                placeholder="Choose destination..."
              />
            </View>
          </View>

          {/* Use My Location Button */}
          <Button
            variant="ghost"
            size="sm"
            onPress={handleUseMyLocation}
            leftIcon={<Ionicons name="locate" size={16} color={theme.colors.foreground} />}
          >
            Use My Location
          </Button>
        </View>

        {/* Day Type Selection */}
        <View style={styles.dayTypeContainer}>
          <ChipGroup>
            <Chip
              label="Weekday"
              selected={dayType === 'weekday'}
              onPress={() => setDayType('weekday')}
            />
            <Chip
              label="Saturday"
              selected={dayType === 'saturday'}
              onPress={() => setDayType('saturday')}
            />
            <Chip
              label="Sunday"
              selected={dayType === 'sunday'}
              onPress={() => setDayType('sunday')}
            />
          </ChipGroup>
        </View>

        {/* Compute Route Button */}
        <View style={styles.actionContainer}>
          <View style={styles.computeButtonWrap}>
            <Button
              variant="primary"
              onPress={handleComputeRoute}
              loading={isLoading}
              disabled={!originStop || !destinationStop}
              block
            >
              Compute Route
            </Button>
          </View>
          <TouchableOpacity
            style={styles.swapButton}
            onPress={handleSwapStops}
            accessibilityLabel="Swap origin and destination"
          >
            <Ionicons name="swap-vertical" size={20} color={theme.colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Error State */}
        {error && (
          <View style={{ paddingHorizontal: theme.spacing[4] }}>
            <Card style={{ backgroundColor: theme.colors.destructive }}>
              <Text style={{ color: theme.colors.destructiveForeground, fontFamily: theme.typography.fonts.regular }}>
                {error}
              </Text>
            </Card>
          </View>
        )}

        {/* Journey Results */}
        {journey && (
          <View style={styles.resultsContainer}>
            {/* Summary Card */}
            <Card style={styles.summaryCard} elevated>
              <View style={styles.summaryRow}>
                <View>
                  <Text style={styles.summaryMain}>
                    {formatDuration(summary.totalDuration)}
                  </Text>
                  <Text style={styles.summaryLabel}>Total Duration</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Badge tone={summary.transfers === 0 ? 'success' : 'muted'}>
                    {summary.transfers} {summary.transfers === 1 ? 'Transfer' : 'Transfers'}
                  </Badge>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: theme.spacing[4], marginTop: theme.spacing[3] }}>
                <View>
                  <Text style={styles.summaryLabel}>Walk Time</Text>
                  <Text style={{ fontFamily: theme.typography.fonts.bold, color: theme.colors.foreground }}>
                    {formatDuration(summary.totalWalkTime)}
                  </Text>
                </View>
                <View>
                  <Text style={styles.summaryLabel}>Wait Time</Text>
                  <Text style={{ fontFamily: theme.typography.fonts.bold, color: theme.colors.foreground }}>
                    {formatDuration(summary.totalWaitTime)}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Journey Legs */}
            <View style={styles.legsContainer}>
              {condensedLegs.map((leg, index) => (
                <JourneyLegCard
                  key={`leg-${index}`}
                  leg={leg}
                  index={index}
                  isExpanded={expandedLeg === index}
                  onToggle={() => toggleLegExpansion(index)}
                  onStopPress={onStopPress}
                />
              ))}
            </View>
          </View>
        )}

        {/* Empty State */}
        {!journey && !isLoading && originStop && destinationStop && (
          <EmptyState
            title="Ready to Plan"
            message="Tap 'Compute Route' to find the best journey."
            icon="navigate-outline"
            style={{ margin: theme.spacing[4] }}
          />
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

// Journey Leg Card Component
interface JourneyLegCardProps {
  leg: JourneyLeg;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onStopPress?: (stop: Stop) => void;
}

const JourneyLegCard = memo(function JourneyLegCard({
  leg,
  index,
  isExpanded,
  onToggle,
  onStopPress,
}: JourneyLegCardProps) {
  const { theme } = useTheme();
  const isWalk = leg.type?.toLowerCase() === 'walk';
  const mode = (leg.type?.toLowerCase() || 'bus') as TransportType;

  const stopsList = useMemo(() => {
    const list: Stop[] = [];
    if (leg.fromStop) list.push(leg.fromStop);
    if (leg.stops && leg.stops.length > 0) list.push(...leg.stops);
    if (leg.toStop) list.push(leg.toStop);

    // De-dupe by id if present; fallback to lat/lon.
    const seen = new Set<string>();
    return list.filter((s) => {
      const key = s.id ? String(s.id) : `${s.lat.toFixed(6)}:${s.lon.toFixed(6)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [leg.fromStop, leg.stops, leg.toStop]);

  return (
    <Card onPress={onToggle}>
      <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
        {/* Mode Icon / Line Badge */}
        {isWalk ? (
          <ModeIcon mode="walk" size="md" />
        ) : (
          <LineBadge
            code={leg.routeCode || mode.toUpperCase()}
            color={leg.routeColor}
            mode={mode}
            size="md"
          />
        )}

        {/* Leg Info */}
        <View style={{ flex: 1, gap: theme.spacing[1] }}>
          <Text
            style={{
              fontFamily: theme.typography.fonts.bold,
              fontSize: theme.typography.sizes.base,
              color: theme.colors.foreground,
            }}
          >
            {isWalk ? 'Walk' : leg.routeCode || leg.type}
          </Text>

          <Text
            style={{
              fontFamily: theme.typography.fonts.regular,
              fontSize: theme.typography.sizes.sm,
              color: theme.colors.mutedForeground,
            }}
            numberOfLines={isExpanded ? undefined : 1}
          >
            {leg.fromStop.name} → {leg.toStop.name}
          </Text>

          {/* Times */}
          {(leg.startTime || leg.endTime) && (
            <Text
              style={{
                fontFamily: theme.typography.fonts.mono,
                fontSize: theme.typography.sizes.sm,
                color: theme.colors.foreground,
              }}
            >
              {formatClockTime(leg.startTime)} → {formatClockTime(leg.endTime)}
            </Text>
          )}

          {/* Wait Time */}
          {leg.waitTime > 0 && (
            <Badge tone="accent" size="sm">
              Wait {formatDuration(leg.waitTime)}
            </Badge>
          )}
        </View>

        {/* Duration */}
        <View style={{ alignItems: 'flex-end' }}>
          <Text
            style={{
              fontFamily: theme.typography.fonts.bold,
              fontSize: theme.typography.sizes.md,
              color: theme.colors.foreground,
            }}
          >
            {formatDuration(leg.duration)}
          </Text>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={theme.colors.mutedForeground}
          />
        </View>
      </View>

      {/* Expanded Content - Intermediate Stops */}
      {isExpanded && stopsList.length > 0 && (
        <Animated.View
          entering={FadeIn.duration(150)}
          style={{
            marginTop: theme.spacing[3],
            paddingTop: theme.spacing[3],
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
          }}
        >
          <Text
            style={{
              fontFamily: theme.typography.fonts.bold,
              fontSize: theme.typography.sizes.sm,
              color: theme.colors.mutedForeground,
              textTransform: 'uppercase',
              marginBottom: theme.spacing[2],
            }}
          >
            {stopsList.length} Stops
          </Text>

          <View style={{ position: 'relative' }}>
            {/* Timeline rail */}
            <View
              style={{
                position: 'absolute',
                left: 7,
                top: 6,
                bottom: 6,
                width: 2,
                backgroundColor: theme.colors.border,
              }}
            />

            {stopsList.map((stop, stopIndex) => {
              const isStart = stopIndex === 0;
              const isEnd = stopIndex === stopsList.length - 1;
              const isEndpoint = isStart || isEnd;
              const timeLabel = isStart
                ? formatClockTime(leg.startTime)
                : isEnd
                  ? formatClockTime(leg.endTime)
                  : null;

              const accent = leg.routeColor || theme.colors.primary;

              return (
                <TouchableOpacity
                  key={`stop-${stop.id ?? stopIndex}`}
                  onPress={() => onStopPress?.(stop)}
                  disabled={!onStopPress}
                  accessibilityRole={onStopPress ? 'button' : undefined}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: theme.spacing[1.5],
                  }}
                >
                  {/* Bullet */}
                  <View
                    style={{
                      width: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: theme.spacing[2],
                    }}
                  >
                    <View
                      style={{
                        width: isEndpoint ? 14 : 12,
                        height: isEndpoint ? 14 : 12,
                        backgroundColor: theme.colors.background,
                        borderWidth: 2,
                        borderColor: theme.colors.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <View
                        style={{
                          width: isEndpoint ? 8 : 6,
                          height: isEndpoint ? 8 : 6,
                          backgroundColor: isEndpoint ? theme.colors.foreground : accent,
                        }}
                      />
                    </View>
                  </View>

                  {/* Stop name */}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: isEndpoint ? theme.typography.fonts.bold : theme.typography.fonts.regular,
                        fontSize: theme.typography.sizes.sm,
                        color: theme.colors.foreground,
                      }}
                      numberOfLines={1}
                    >
                      {stop.name}
                    </Text>
                  </View>

                  {/* Time label for endpoints */}
                  {timeLabel && (
                    <Text
                      style={{
                        fontFamily: theme.typography.fonts.mono,
                        fontSize: theme.typography.sizes.sm,
                        color: theme.colors.mutedForeground,
                        marginLeft: theme.spacing[2],
                      }}
                    >
                      {timeLabel}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      )}
    </Card>
  );
});

export const JourneyPlanner = memo(JourneyPlannerComponent);
