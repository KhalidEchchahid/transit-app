import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { useLineDetails } from '@/hooks/useTransport';
import { Badge, Button, Card, Skeleton, LineBadge, ModeIcon, EmptyState } from '@/components/ui';
import type { Stop, TransportMode, TransportType } from '@/lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const StopItem = React.memo(function StopItem({
  stop,
  index,
  total,
  onPress,
}: {
  stop: Stop;
  index: number;
  total: number;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const isFirst = index === 0;
  const isLast = index === total - 1;

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'stretch',
      paddingVertical: theme.spacing[2],
    },
    timeline: {
      width: 24,
      alignItems: 'center',
      marginRight: theme.spacing[3],
    },
    lineTop: {
      width: 3,
      flex: 1,
      backgroundColor: isFirst ? 'transparent' : theme.colors.border,
    },
    dot: {
      width: 16,
      height: 16,
      backgroundColor: theme.colors.primary,
      borderWidth: theme.borderWidths.base,
      borderColor: theme.colors.border,
    },
    lineBottom: {
      width: 3,
      flex: 1,
      backgroundColor: isLast ? 'transparent' : theme.colors.border,
    },
    content: {
      flex: 1,
      backgroundColor: theme.colors.card,
      borderWidth: theme.borderWidths.base,
      borderColor: theme.colors.border,
      padding: theme.spacing[3],
    },
    stopName: {
      fontFamily: theme.typography.fonts.bold,
      fontSize: theme.typography.sizes.base,
      color: theme.colors.foreground,
    },
    stopType: {
      fontFamily: theme.typography.fonts.regular,
      fontSize: theme.typography.sizes.xs,
      color: theme.colors.mutedForeground,
      textTransform: 'uppercase',
      marginTop: theme.spacing[1],
    },
    arrowContainer: {
      justifyContent: 'center',
      paddingLeft: theme.spacing[2],
    },
  });

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      accessibilityLabel={`Stop ${index + 1}: ${stop.name}`}
      accessibilityRole="button"
    >
      <View style={styles.timeline}>
        <View style={styles.lineTop} />
        <View style={styles.dot} />
        <View style={styles.lineBottom} />
      </View>
      <View style={styles.content}>
        <Text style={styles.stopName}>{stop.name}</Text>
        {stop.type && (
          <Text style={styles.stopType}>{stop.type}</Text>
        )}
      </View>
      <View style={styles.arrowContainer}>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={theme.colors.mutedForeground}
        />
      </View>
    </TouchableOpacity>
  );
});

export default function LineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: lineDetails, isLoading, error, refetch } = useLineDetails(id);
  const line = lineDetails?.line;
  const stops = useMemo(() => lineDetails?.stops || [], [lineDetails?.stops]);

  const handleStopPress = useCallback((stop: Stop) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/stop/${stop.id}`);
  }, [router]);

  const handleShowOnMap = useCallback(() => {
    // Navigate to map with this line highlighted
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/(tabs)',
      params: { lineId: id },
    });
  }, [id, router]);

  const getModeColor = useCallback((mode?: TransportMode) => {
    if (!mode) return theme.colors.primary;
    return theme.colors.modes[mode] || theme.colors.primary;
  }, [theme.colors]);

  const mode: TransportMode | undefined = useMemo(() => {
    const t = (line?.type || '').toLowerCase() as TransportType;
    if (t === 'bus' || t === 'tram' || t === 'train' || t === 'busway' || t === 'taxi') return t;
    return undefined;
  }, [line?.type]);

  const renderStop = useCallback(({ item, index }: { item: Stop; index: number }) => (
    <StopItem
      stop={item}
      index={index}
      total={stops.length}
      onPress={() => handleStopPress(item)}
    />
  ), [stops.length, handleStopPress]);

  const keyExtractor = useCallback((item: Stop) => String(item.id), []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor: getModeColor(mode),
      borderBottomWidth: theme.borderWidths.thick,
      borderBottomColor: theme.colors.border,
      paddingTop: insets.top,
      paddingHorizontal: theme.spacing[4],
      paddingBottom: theme.spacing[4],
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[3],
      flex: 1,
      paddingHorizontal: theme.spacing[4],
    },
    lineName: {
      fontFamily: theme.typography.fonts.heading,
      fontSize: theme.typography.sizes['2xl'],
      color: isDark ? theme.colors.background : theme.colors.foreground,
      textTransform: 'uppercase',
      letterSpacing: theme.typography.letterSpacing.wider,
      flex: 1,
    },
    lineNumberBadge: {
      backgroundColor: theme.colors.background,
      borderWidth: theme.borderWidths.thick,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[2],
    },
    lineNumber: {
      fontFamily: theme.typography.fonts.heading,
      fontSize: theme.typography.sizes.xl,
      color: theme.colors.foreground,
    },
    infoSection: {
      padding: theme.spacing[4],
      borderBottomWidth: theme.borderWidths.base,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.muted,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[3],
      marginBottom: theme.spacing[2],
    },
    infoLabel: {
      fontFamily: theme.typography.fonts.bold,
      fontSize: theme.typography.sizes.xs,
      color: theme.colors.mutedForeground,
      textTransform: 'uppercase',
      width: 100,
    },
    infoValue: {
      fontFamily: theme.typography.fonts.regular,
      fontSize: theme.typography.sizes.base,
      color: theme.colors.foreground,
      flex: 1,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: theme.spacing[3],
      marginTop: theme.spacing[3],
    },
    stopsSection: {
      flex: 1,
      padding: theme.spacing[4],
    },
    sectionTitle: {
      fontFamily: theme.typography.fonts.heading,
      fontSize: theme.typography.sizes.lg,
      color: theme.colors.foreground,
      textTransform: 'uppercase',
      marginBottom: theme.spacing[4],
    },
    stopsCount: {
      fontFamily: theme.typography.fonts.regular,
      color: theme.colors.mutedForeground,
    },
    loadingContainer: {
      flex: 1,
      padding: theme.spacing[4],
    },
    skeletonHeader: {
      height: 120,
      marginBottom: theme.spacing[4],
    },
    skeletonInfo: {
      height: 80,
      marginBottom: theme.spacing[4],
    },
    skeletonStop: {
      height: 60,
      marginBottom: theme.spacing[2],
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing[8],
    },
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <Skeleton style={styles.skeletonHeader} />
          <Skeleton style={styles.skeletonInfo} />
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} style={styles.skeletonStop} />
          ))}
        </View>
      </View>
    );
  }

  if (error || !line) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { backgroundColor: theme.colors.destructive }]}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={24} color={theme.colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>
        <EmptyState
          icon="alert-circle"
          title="Line Not Found"
          message="The requested transit line could not be loaded."
          action={
            <Button onPress={() => refetch()}>
              <Text style={{ color: theme.colors.primaryForeground, fontFamily: theme.typography.fonts.bold }}>
                Retry
              </Text>
            </Button>
          }
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.foreground} />
          </TouchableOpacity>
          
          <View style={styles.headerTitle}>
            <ModeIcon mode={mode || 'bus'} size="lg" />
            <Text style={styles.lineName} numberOfLines={1}>{line.name}</Text>
          </View>
          
          <View style={styles.lineNumberBadge}>
            <Text style={styles.lineNumber}>{line.code || String(line.id)}</Text>
          </View>
        </View>
      </Animated.View>

      {/* Info Section */}
      <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Mode</Text>
          <Text style={styles.infoValue}>{(line.type || '').toUpperCase() || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Stops</Text>
          <Text style={styles.infoValue}>{stops.length} stops</Text>
        </View>
        {line.origin && line.destination && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Route</Text>
            <Text style={styles.infoValue} numberOfLines={2}>
              {line.origin} → {line.destination}
            </Text>
          </View>
        )}
        
        <View style={styles.actionsRow}>
          <Button
            variant="primary"
            size="md"
            onPress={handleShowOnMap}
            style={{ flex: 1 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="map" size={18} color={theme.colors.primaryForeground} />
              <Text style={{ color: theme.colors.primaryForeground, fontFamily: theme.typography.fonts.bold }}>
                Show on Map
              </Text>
            </View>
          </Button>
        </View>
      </Animated.View>

      {/* Stops List */}
      <Animated.View entering={FadeInDown.delay(200).duration(300)} style={styles.stopsSection}>
        <Text style={styles.sectionTitle}>
          Stops <Text style={styles.stopsCount}>({stops.length})</Text>
        </Text>
        
        <FlatList
          data={stops}
          renderItem={renderStop}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          contentContainerStyle={{ paddingBottom: insets.bottom + theme.spacing[4] }}
        />
      </Animated.View>
    </View>
  );
}
