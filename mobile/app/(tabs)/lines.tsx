import React, { memo, useCallback, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { useLines, usePrefetchLineDetails } from '@/hooks/useTransport';
import { Button, Badge, Card, Input, Chip, ChipGroup, ModeIcon, LineBadge, SkeletonCard, EmptyState } from '@/components/ui';
import type { Line, TransportType } from '@/lib/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TRANSPORT_MODES: Array<{ key: TransportType | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'bus', label: 'Bus' },
  { key: 'tram', label: 'Tram' },
  { key: 'busway', label: 'Busway' },
  { key: 'train', label: 'Train' },
];

function LinesScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: lines, isLoading, error, refetch, isRefetching } = useLines();
  const prefetchLine = usePrefetchLineDetails();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMode, setSelectedMode] = useState<TransportType | 'all'>('all');
  
  // Filter lines based on search and mode
  const filteredLines = useMemo(() => {
    if (!lines) return [];
    
    return lines.filter((line) => {
      // Mode filter
      if (selectedMode !== 'all' && line.type !== selectedMode) {
        return false;
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          line.code?.toLowerCase().includes(query) ||
          line.name?.toLowerCase().includes(query) ||
          line.origin?.toLowerCase().includes(query) ||
          line.destination?.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [lines, searchQuery, selectedMode]);

  const handleLinePress = useCallback((line: Line) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/line/${line.id}`);
  }, [router]);

  const handleLinePrefetch = useCallback((lineId: number) => {
    prefetchLine(lineId);
  }, [prefetchLine]);

  const handleModeChange = useCallback((mode: TransportType | 'all') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMode(mode);
  }, []);

  const renderLine = useCallback(({ item, index }: { item: Line; index: number }) => (
    <Animated.View
      entering={FadeIn.delay(index * 30).duration(200)}
      layout={Layout.springify()}
    >
      <LineCard
        line={item}
        onPress={() => handleLinePress(item)}
        onPrefetch={() => handleLinePrefetch(item.id)}
      />
    </Animated.View>
  ), [handleLinePress, handleLinePrefetch]);

  const keyExtractor = useCallback((item: Line) => String(item.id), []);

  const renderEmptyState = useCallback(() => {
    if (isLoading) {
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
          message="Could not load transit lines. Please check your connection and try again."
          icon="alert-circle-outline"
          action={{ label: 'Retry', onPress: refetch }}
          style={{ margin: theme.spacing[4] }}
        />
      );
    }

    if (searchQuery || selectedMode !== 'all') {
      return (
        <EmptyState
          title="No Lines Found"
          message="Try adjusting your search or filter criteria."
          icon="search-outline"
          action={{ 
            label: 'Clear Filters', 
            onPress: () => {
              setSearchQuery('');
              setSelectedMode('all');
            }
          }}
          style={{ margin: theme.spacing[4] }}
        />
      );
    }

    return (
      <EmptyState
        title="No Lines Available"
        message="Transit line data is not available yet."
        icon="git-branch-outline"
        style={{ margin: theme.spacing[4] }}
      />
    );
  }, [isLoading, error, searchQuery, selectedMode, theme, refetch]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      paddingTop: insets.top,
      paddingHorizontal: theme.spacing[4],
      paddingBottom: theme.spacing[4],
      backgroundColor: theme.colors.primary,
      borderBottomWidth: theme.borderWidths.thick,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontFamily: theme.typography.fonts.heading,
      fontSize: theme.typography.sizes['2xl'],
      color: theme.colors.primaryForeground,
      textTransform: 'uppercase',
      letterSpacing: theme.typography.letterSpacing.wider,
      marginBottom: theme.spacing[3],
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
    filterContainer: {
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[3],
      backgroundColor: theme.colors.card,
      borderBottomWidth: theme.borderWidths.base,
      borderBottomColor: theme.colors.border,
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
        <Text style={styles.headerTitle}>Lines</Text>
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color={theme.colors.mutedForeground}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search lines..."
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

      {/* Mode Filters */}
      <View style={styles.filterContainer}>
        <ChipGroup>
          {TRANSPORT_MODES.map((mode) => (
            <Chip
              key={mode.key}
              label={mode.label}
              selected={selectedMode === mode.key}
              onPress={() => handleModeChange(mode.key)}
              color={mode.key !== 'all' ? theme.colors.modes[mode.key as TransportType] : undefined}
            />
          ))}
        </ChipGroup>
      </View>

      {/* Results Count */}
      {!isLoading && filteredLines.length > 0 && (
        <Text style={styles.resultCount}>
          {filteredLines.length} line{filteredLines.length !== 1 ? 's' : ''} found
        </Text>
      )}

      {/* Lines List */}
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={filteredLines}
        renderItem={renderLine}
        keyExtractor={keyExtractor}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={8}
        getItemLayout={(_, index) => ({
          length: 120,
          offset: 120 * index + theme.spacing[3] * index,
          index,
        })}
      />
    </View>
  );
}

// Memoized Line Card component
interface LineCardProps {
  line: Line;
  onPress: () => void;
  onPrefetch: () => void;
}

const LineCard = memo(function LineCard({ line, onPress, onPrefetch }: LineCardProps) {
  const { theme } = useTheme();

  return (
    <Card
      onPress={onPress}
      style={{ minHeight: 100 }}
      accessibilityLabel={`Line ${line.code || line.name}, ${line.type}, from ${line.origin} to ${line.destination}`}
    >
      <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
        {/* Line Badge */}
        <LineBadge
          code={line.code || line.id.toString()}
          color={line.color}
          mode={line.type as TransportType}
          size="lg"
        />

        {/* Line Info */}
        <View style={{ flex: 1, gap: theme.spacing[1] }}>
          <Text
            style={{
              fontFamily: theme.typography.fonts.heading,
              fontSize: theme.typography.sizes.md,
              color: theme.colors.foreground,
              textTransform: 'uppercase',
            }}
            numberOfLines={1}
          >
            {line.name}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
            <ModeIcon mode={line.type as TransportType} size="sm" />
            <Badge tone="muted" size="sm">
              {line.type}
            </Badge>
          </View>

          <Text
            style={{
              fontFamily: theme.typography.fonts.regular,
              fontSize: theme.typography.sizes.sm,
              color: theme.colors.mutedForeground,
            }}
            numberOfLines={2}
          >
            {line.origin} → {line.destination}
          </Text>
        </View>

        {/* Arrow */}
        <View style={{ justifyContent: 'center' }}>
          <Ionicons
            name="chevron-forward"
            size={24}
            color={theme.colors.mutedForeground}
          />
        </View>
      </View>
    </Card>
  );
});

export default LinesScreen;
