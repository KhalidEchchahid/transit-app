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
import { useStopDetails } from '@/hooks/useTransport';
import { Badge, Button, Card, Skeleton, LineBadge, ModeIcon, EmptyState } from '@/components/ui';
import type { Line, Stop, TransportMode, TransportType } from '@/lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const LineItem = React.memo(function LineItem({
  line,
  onPress,
}: {
  line: Line;
  onPress: () => void;
}) {
  const { theme, isDark } = useTheme();

  const getModeColor = (mode?: TransportMode) => {
    if (!mode) return theme.colors.primary;
    return theme.colors.modes[mode] || theme.colors.primary;
  };

  const mode: TransportMode | undefined = useMemo(() => {
    const t = (line.type || '').toLowerCase() as TransportType;
    if (t === 'bus' || t === 'tram' || t === 'train' || t === 'busway' || t === 'taxi') return t;
    return undefined;
  }, [line.type]);

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.card,
      borderWidth: theme.borderWidths.base,
      borderColor: theme.colors.border,
      padding: theme.spacing[3],
      marginBottom: theme.spacing[2],
    },
    modeStrip: {
      width: 6,
      height: '100%',
      backgroundColor: getModeColor(mode),
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
    },
    content: {
      flex: 1,
      marginLeft: theme.spacing[2],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing[2],
    },
    lineBadge: {
      backgroundColor: getModeColor(mode),
      borderWidth: theme.borderWidths.base,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing[2],
      paddingVertical: theme.spacing[1],
      minWidth: 44,
      alignItems: 'center',
    },
    lineNumber: {
      fontFamily: theme.typography.fonts.heading,
      fontSize: theme.typography.sizes.sm,
      color: isDark ? theme.colors.background : theme.colors.foreground,
    },
    lineName: {
      fontFamily: theme.typography.fonts.bold,
      fontSize: theme.typography.sizes.base,
      color: theme.colors.foreground,
      flex: 1,
    },
    routeText: {
      fontFamily: theme.typography.fonts.regular,
      fontSize: theme.typography.sizes.xs,
      color: theme.colors.mutedForeground,
      marginTop: theme.spacing[1],
    },
    arrowContainer: {
      paddingLeft: theme.spacing[2],
    },
  });

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      accessibilityLabel={`Line ${line.code || line.id}: ${line.name}`}
      accessibilityRole="button"
    >
      <View style={styles.modeStrip} />
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.lineBadge}>
            <Text style={styles.lineNumber}>{line.code || String(line.id)}</Text>
          </View>
          <Text style={styles.lineName} numberOfLines={1}>{line.name}</Text>
        </View>
        {line.origin && line.destination && (
          <Text style={styles.routeText} numberOfLines={1}>
            {line.origin} → {line.destination}
          </Text>
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

export default function StopDetailScreen() {
  const { id, name, lat, lon, type, code } = useLocalSearchParams<{
    id: string;
    name?: string;
    lat?: string;
    lon?: string;
    type?: string;
    code?: string;
  }>();
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const numericStopId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) && String(n) === String(Number.parseInt(id, 10)) ? n : null;
  }, [id]);

  const { data, isLoading, error } = useStopDetails(numericStopId);

  const stop: Stop | null = useMemo(() => {
    if (data?.stop) return data.stop;
    if (numericStopId !== null) return null;
    // Custom stop fallback (e.g. map-picked coordinates)
    const parsedLat = lat ? Number(lat) : undefined;
    const parsedLon = lon ? Number(lon) : undefined;
    if (typeof name !== 'string' || !Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) return null;
    return {
      id,
      name,
      lat: parsedLat!,
      lon: parsedLon!,
      type: type || 'custom',
      code,
    };
  }, [data?.stop, numericStopId, lat, lon, name, type, id, code]);

  const connectedLines: Line[] = data?.lines || [];

  const handleLinePress = useCallback((line: Line) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/line/${line.id}`);
  }, [router]);

  const handleSetAsOrigin = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/(tabs)',
      params: { 
        originStopId: id,
        originStopName: stop?.name,
      },
    });
  }, [id, stop, router]);

  const handleSetAsDestination = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/(tabs)',
      params: { 
        destinationStopId: id,
        destinationStopName: stop?.name,
      },
    });
  }, [id, stop, router]);

  const handleShowOnMap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (stop) {
      router.push({
        pathname: '/(tabs)',
        params: { 
          focusLat: stop.lat.toString(),
          focusLon: stop.lon.toString(),
        },
      });
    }
  }, [stop, router]);

  const renderLine = useCallback(({ item }: { item: Line }) => (
    <LineItem
      line={item}
      onPress={() => handleLinePress(item)}
    />
  ), [handleLinePress]);

  const keyExtractor = useCallback((item: Line) => String(item.id), []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor: theme.colors.accent,
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
    headerIcon: {
      width: 60,
      height: 60,
      backgroundColor: theme.colors.background,
      borderWidth: theme.borderWidths.thick,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing[3],
    },
    stopName: {
      fontFamily: theme.typography.fonts.heading,
      fontSize: theme.typography.sizes['2xl'],
      color: theme.colors.accentForeground,
      textTransform: 'uppercase',
      letterSpacing: theme.typography.letterSpacing.wider,
    },
    stopType: {
      fontFamily: theme.typography.fonts.regular,
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.accentForeground,
      opacity: 0.8,
      marginTop: theme.spacing[1],
      textTransform: 'uppercase',
    },
    coordinates: {
      fontFamily: theme.typography.fonts.mono,
      fontSize: theme.typography.sizes.xs,
      color: theme.colors.accentForeground,
      opacity: 0.6,
      marginTop: theme.spacing[2],
    },
    actionsSection: {
      padding: theme.spacing[4],
      borderBottomWidth: theme.borderWidths.base,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.muted,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: theme.spacing[2],
      marginBottom: theme.spacing[2],
    },
    linesSection: {
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
    linesCount: {
      fontFamily: theme.typography.fonts.regular,
      color: theme.colors.mutedForeground,
    },
    loadingContainer: {
      flex: 1,
      padding: theme.spacing[4],
    },
    skeletonHeader: {
      height: 150,
      marginBottom: theme.spacing[4],
    },
    skeletonActions: {
      height: 60,
      marginBottom: theme.spacing[4],
    },
    skeletonLine: {
      height: 70,
      marginBottom: theme.spacing[2],
    },
    emptyLines: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing[8],
    },
    emptyText: {
      fontFamily: theme.typography.fonts.regular,
      fontSize: theme.typography.sizes.base,
      color: theme.colors.mutedForeground,
      textAlign: 'center',
    },
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <Skeleton style={styles.skeletonHeader} />
          <Skeleton style={styles.skeletonActions} />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} style={styles.skeletonLine} />
          ))}
        </View>
      </View>
    );
  }

  if (error || !stop) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { backgroundColor: theme.colors.destructive }]}>
          <View style={styles.headerNav}>
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
          title="Stop Not Found"
          message="The requested transit stop could not be loaded."
          action={
            <Button onPress={() => router.back()}>
              <Text style={{ color: theme.colors.primaryForeground, fontFamily: theme.typography.fonts.bold }}>
                Go Back
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
        <View style={styles.headerNav}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.foreground} />
          </TouchableOpacity>
        </View>

        <View style={styles.headerIcon}>
          <Ionicons name="bus" size={32} color={theme.colors.foreground} />
        </View>
        
        <Text style={styles.stopName}>{stop.name}</Text>
        {stop.type && (
          <Text style={styles.stopType}>{stop.type} stop</Text>
        )}
        <Text style={styles.coordinates}>
          {stop.lat.toFixed(5)}, {stop.lon.toFixed(5)}
        </Text>
      </Animated.View>

      {/* Actions */}
      <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.actionsSection}>
        <View style={styles.actionsRow}>
          <Button
            variant="primary"
            size="md"
            onPress={handleSetAsOrigin}
            style={{ flex: 1 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="navigate" size={16} color={theme.colors.primaryForeground} />
              <Text style={{ color: theme.colors.primaryForeground, fontFamily: theme.typography.fonts.bold, fontSize: 13 }}>
                From Here
              </Text>
            </View>
          </Button>
          
          <Button
            variant="accent"
            size="md"
            onPress={handleSetAsDestination}
            style={{ flex: 1 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="flag" size={16} color={theme.colors.accentForeground} />
              <Text style={{ color: theme.colors.accentForeground, fontFamily: theme.typography.fonts.bold, fontSize: 13 }}>
                To Here
              </Text>
            </View>
          </Button>
        </View>
        
        <Button
          variant="muted"
          size="md"
          onPress={handleShowOnMap}
          block
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="map" size={18} color={theme.colors.foreground} />
            <Text style={{ color: theme.colors.foreground, fontFamily: theme.typography.fonts.bold }}>
              Show on Map
            </Text>
          </View>
        </Button>
      </Animated.View>

      {/* Connected Lines */}
      <Animated.View entering={FadeInDown.delay(200).duration(300)} style={styles.linesSection}>
        <Text style={styles.sectionTitle}>
          Connected Lines <Text style={styles.linesCount}>({connectedLines.length})</Text>
        </Text>
        
        {connectedLines.length > 0 ? (
          <FlatList
            data={connectedLines}
            renderItem={renderLine}
            keyExtractor={keyExtractor}
            showsVerticalScrollIndicator={false}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            contentContainerStyle={{ paddingBottom: insets.bottom + theme.spacing[4] }}
          />
        ) : (
          <View style={styles.emptyLines}>
            <Text style={styles.emptyText}>
              No transit lines serve this stop.
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}
