import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { Badge, Button, Card, ModeIcon } from '@/components/ui';
import type { Journey, JourneyLeg, TransportMode } from '@/lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Helper functions
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatTime(timestamp: string | number): string {
  // Backend currently returns HH:MM strings for leg times.
  if (typeof timestamp === 'string' && /^\d{1,2}:\d{2}/.test(timestamp)) return timestamp;
  const date = new Date(timestamp);
  return date.toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function normalizeLegMode(leg: JourneyLeg): TransportMode {
  const t = (leg.type || '').toLowerCase();
  if (t === 'walk') return 'walk';
  // Backend uses "transit" for all transit legs; without richer data, default to bus.
  return 'bus';
}

// Journey Leg Component
const JourneyLegDetail = React.memo(function JourneyLegDetail({
  leg,
  index,
  isLast,
}: {
  leg: JourneyLeg;
  index: number;
  isLast: boolean;
}) {
  const { theme, isDark } = useTheme();
  const router = useRouter();

  const getModeColor = (mode?: TransportMode) => {
    if (!mode) return theme.colors.mutedForeground;
    return theme.colors.modes[mode] || theme.colors.mutedForeground;
  };

  const mode = normalizeLegMode(leg);
  const isWalk = mode === 'walk';
  const modeColor = getModeColor(mode);
  const duration = leg.duration ? formatDuration(leg.duration) : '';

  const styles = StyleSheet.create({
    container: {
      marginBottom: theme.spacing[4],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[3],
      marginBottom: theme.spacing[3],
    },
    stepNumber: {
      width: 36,
      height: 36,
      backgroundColor: modeColor,
      borderWidth: theme.borderWidths.base,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepNumberText: {
      fontFamily: theme.typography.fonts.heading,
      fontSize: theme.typography.sizes.md,
      color: isDark ? theme.colors.background : theme.colors.foreground,
    },
    headerInfo: {
      flex: 1,
    },
    modeLabel: {
      fontFamily: theme.typography.fonts.heading,
      fontSize: theme.typography.sizes.base,
      color: theme.colors.foreground,
      textTransform: 'uppercase',
    },
    durationText: {
      fontFamily: theme.typography.fonts.regular,
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.mutedForeground,
    },
    lineBadge: {
      backgroundColor: modeColor,
      borderWidth: theme.borderWidths.base,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing[3],
      paddingVertical: theme.spacing[1],
    },
    lineText: {
      fontFamily: theme.typography.fonts.heading,
      fontSize: theme.typography.sizes.sm,
      color: isDark ? theme.colors.background : theme.colors.foreground,
    },
    card: {
      backgroundColor: theme.colors.card,
      borderWidth: theme.borderWidths.base,
      borderColor: theme.colors.border,
      borderLeftWidth: 4,
      borderLeftColor: modeColor,
    },
    stopsContainer: {
      padding: theme.spacing[4],
    },
    stopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: theme.spacing[3],
    },
    stopTimeline: {
      width: 24,
      alignItems: 'center',
      marginRight: theme.spacing[3],
    },
    stopDot: {
      width: 12,
      height: 12,
      backgroundColor: modeColor,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    stopLine: {
      width: 2,
      flex: 1,
      backgroundColor: modeColor,
      marginTop: theme.spacing[1],
    },
    stopInfo: {
      flex: 1,
    },
    stopName: {
      fontFamily: theme.typography.fonts.bold,
      fontSize: theme.typography.sizes.base,
      color: theme.colors.foreground,
    },
    stopTime: {
      fontFamily: theme.typography.fonts.mono,
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.mutedForeground,
      marginTop: theme.spacing[1],
    },
    intermediateStops: {
      paddingVertical: theme.spacing[3],
      paddingHorizontal: theme.spacing[4],
      backgroundColor: theme.colors.muted,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    intermediateLabel: {
      fontFamily: theme.typography.fonts.regular,
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.mutedForeground,
    },
    walkInstructions: {
      padding: theme.spacing[4],
    },
    walkText: {
      fontFamily: theme.typography.fonts.regular,
      fontSize: theme.typography.sizes.base,
      color: theme.colors.foreground,
    },
    connector: {
      height: theme.spacing[6],
      width: 2,
      backgroundColor: theme.colors.border,
      marginLeft: theme.spacing[4] + 17,
      marginBottom: theme.spacing[2],
    },
  });

  if (isWalk) {
    return (
      <Animated.View
        entering={FadeInDown.delay(index * 100).duration(300)}
        style={styles.container}
      >
        <View style={styles.header}>
          <View style={styles.stepNumber}>
            <Ionicons name="walk" size={20} color={isDark ? theme.colors.background : theme.colors.foreground} />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.modeLabel}>Walk</Text>
            <Text style={styles.durationText}>{duration}</Text>
          </View>
        </View>
        
        <View style={styles.card}>
          <View style={styles.walkInstructions}>
            <Text style={styles.walkText}>
              Walk from {leg.fromStop?.name || 'origin'} to {leg.toStop?.name || 'destination'}
            </Text>
          </View>
        </View>

        {!isLast && <View style={styles.connector} />}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).duration(300)}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>{index + 1}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.modeLabel}>TRANSIT</Text>
          <Text style={styles.durationText}>{duration}</Text>
        </View>
        <View style={styles.lineBadge}>
          <Text style={styles.lineText}>{leg.routeCode || '—'}</Text>
        </View>
      </View>
      
      <View style={styles.card}>
        <View style={styles.stopsContainer}>
          {/* Boarding stop */}
          <View style={styles.stopRow}>
            <View style={styles.stopTimeline}>
              <View style={styles.stopDot} />
              <View style={styles.stopLine} />
            </View>
            <View style={styles.stopInfo}>
              <Text style={styles.stopName}>{leg.fromStop?.name || 'Departure'}</Text>
              {!!leg.startTime && <Text style={styles.stopTime}>{formatTime(leg.startTime)}</Text>}
            </View>
          </View>
          
          {/* Alighting stop */}
          <View style={[styles.stopRow, { marginBottom: 0 }]}>
            <View style={[styles.stopTimeline, { width: 24 }]}>
              <View style={styles.stopDot} />
            </View>
            <View style={styles.stopInfo}>
              <Text style={styles.stopName}>{leg.toStop?.name || 'Arrival'}</Text>
              {!!leg.endTime && <Text style={styles.stopTime}>{formatTime(leg.endTime)}</Text>}
            </View>
          </View>
        </View>
      </View>

      {!isLast && <View style={styles.connector} />}
    </Animated.View>
  );
});

export default function JourneyDetailScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();

  // In a real app, we'd get the journey from route state or a store
  // For now, we show a placeholder
  const journey: Journey | null = useMemo(() => {
    // Parse journey from params if available
    if (params.journey) {
      try {
        return JSON.parse(params.journey as string);
      } catch {
        return null;
      }
    }
    return null;
  }, [params.journey]);

  const totalDuration = useMemo(() => {
    if (!journey?.legs) return 0;
    return journey.legs.reduce((acc, leg) => acc + (leg.duration || 0), 0);
  }, [journey]);

  const totalLegs = journey?.legs.length || 0;
  const transitLegs = journey?.legs.filter((l) => normalizeLegMode(l) !== 'walk').length || 0;
  const walkLegs = journey?.legs.filter((l) => normalizeLegMode(l) === 'walk').length || 0;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor: theme.colors.primary,
      borderBottomWidth: theme.borderWidths.thick,
      borderBottomColor: theme.colors.border,
      paddingTop: insets.top,
      paddingHorizontal: theme.spacing[4],
      paddingBottom: theme.spacing[4],
    },
    headerNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing[4],
    },
    backButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
      borderWidth: theme.borderWidths.base,
      borderColor: theme.colors.border,
    },
    headerTitle: {
      fontFamily: theme.typography.fonts.heading,
      fontSize: theme.typography.sizes['2xl'],
      color: theme.colors.primaryForeground,
      textTransform: 'uppercase',
      letterSpacing: theme.typography.letterSpacing.wider,
    },
    summaryCard: {
      backgroundColor: theme.colors.background,
      borderWidth: theme.borderWidths.thick,
      borderColor: theme.colors.border,
      padding: theme.spacing[4],
      marginTop: theme.spacing[4],
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    summaryItem: {
      alignItems: 'center',
    },
    summaryValue: {
      fontFamily: theme.typography.fonts.heading,
      fontSize: theme.typography.sizes.xl,
      color: theme.colors.foreground,
    },
    summaryLabel: {
      fontFamily: theme.typography.fonts.regular,
      fontSize: theme.typography.sizes.xs,
      color: theme.colors.mutedForeground,
      textTransform: 'uppercase',
      marginTop: theme.spacing[1],
    },
    summaryDivider: {
      width: 2,
      height: 40,
      backgroundColor: theme.colors.border,
    },
    routeSection: {
      padding: theme.spacing[4],
    },
    sectionTitle: {
      fontFamily: theme.typography.fonts.heading,
      fontSize: theme.typography.sizes.lg,
      color: theme.colors.foreground,
      textTransform: 'uppercase',
      marginBottom: theme.spacing[4],
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing[8],
    },
    emptyIcon: {
      width: 80,
      height: 80,
      backgroundColor: theme.colors.muted,
      borderWidth: theme.borderWidths.thick,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing[4],
    },
    emptyTitle: {
      fontFamily: theme.typography.fonts.heading,
      fontSize: theme.typography.sizes.xl,
      color: theme.colors.foreground,
      textAlign: 'center',
      textTransform: 'uppercase',
    },
    emptyText: {
      fontFamily: theme.typography.fonts.regular,
      fontSize: theme.typography.sizes.base,
      color: theme.colors.mutedForeground,
      textAlign: 'center',
      marginTop: theme.spacing[2],
    },
  });

  if (!journey) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        
        <View style={styles.header}>
          <View style={styles.headerNav}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={24} color={theme.colors.foreground} />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerTitle}>Journey</Text>
        </View>

        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="navigate" size={40} color={theme.colors.mutedForeground} />
          </View>
          <Text style={styles.emptyTitle}>No Journey</Text>
          <Text style={styles.emptyText}>
            Plan a route from the map screen to see journey details here.
          </Text>
          <Button
            variant="primary"
            size="lg"
            onPress={() => router.push('/(tabs)')}
            style={{ marginTop: theme.spacing[6] }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="map" size={18} color={theme.colors.primaryForeground} />
              <Text style={{ color: theme.colors.primaryForeground, fontFamily: theme.typography.fonts.bold }}>
                Go to Map
              </Text>
            </View>
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <View style={styles.headerNav}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.foreground} />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>Journey Details</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{formatDuration(totalDuration)}</Text>
              <Text style={styles.summaryLabel}>Total Time</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{transitLegs}</Text>
              <Text style={styles.summaryLabel}>{transitLegs === 1 ? 'Connection' : 'Connections'}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{walkLegs}</Text>
              <Text style={styles.summaryLabel}>{walkLegs === 1 ? 'Walk' : 'Walks'}</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Route Steps */}
      <ScrollView
        style={styles.routeSection}
        contentContainerStyle={{ paddingBottom: insets.bottom + theme.spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Route</Text>
        
        {journey.legs.map((leg, index) => (
          <JourneyLegDetail
            key={`${leg.routeCode || leg.type || 'leg'}-${index}`}
            leg={leg}
            index={index}
            isLast={index === journey.legs.length - 1}
          />
        ))}
      </ScrollView>
    </View>
  );
}
