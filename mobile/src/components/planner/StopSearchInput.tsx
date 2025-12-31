import React, { memo, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { useStopsInViewport } from '@/hooks/useTransport';
import { DEFAULT_CENTER } from '@/lib/constants';
import type { Stop } from '@/lib/types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface StopSearchInputProps {
  label: string;
  value: Stop | null;
  onChange: (stop: Stop | null) => void;
  onMapSelect?: () => void;
  placeholder?: string;
  error?: string;
}

function StopSearchInputComponent({
  label,
  value,
  onChange,
  onMapSelect,
  placeholder = 'Search for a stop...',
  error,
}: StopSearchInputProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<TextInput>(null);

  // Fetch stops in a wide viewport for search
  const viewport = useMemo(() => ({
    minLat: DEFAULT_CENTER.latitude - 0.1,
    maxLat: DEFAULT_CENTER.latitude + 0.1,
    minLon: DEFAULT_CENTER.longitude - 0.1,
    maxLon: DEFAULT_CENTER.longitude + 0.1,
  }), []);

  const { data: allStops } = useStopsInViewport(viewport);

  // Filter stops based on search query
  const filteredStops = useMemo(() => {
    if (!allStops || !searchQuery) return allStops?.slice(0, 50) || [];

    const query = searchQuery.toLowerCase();
    return allStops
      .filter((stop) =>
        stop.name?.toLowerCase().includes(query) ||
        stop.code?.toLowerCase().includes(query)
      )
      .slice(0, 50);
  }, [allStops, searchQuery]);

  const handleOpen = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsOpen(true);
    setSearchQuery(value?.name || '');
  }, [value]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
  }, []);

  const handleSelectStop = useCallback((stop: Stop) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onChange(stop);
    handleClose();
  }, [onChange, handleClose]);

  const handleClear = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(null);
  }, [onChange]);

  const handleMapSelect = useCallback(() => {
    handleClose();
    onMapSelect?.();
  }, [handleClose, onMapSelect]);

  const renderStop = useCallback(({ item }: { item: Stop }) => (
    <TouchableOpacity
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: theme.spacing[4],
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        gap: theme.spacing[3],
        minHeight: theme.touchTargets.comfortable,
      }}
      onPress={() => handleSelectStop(item)}
      accessibilityRole="button"
      accessibilityLabel={`Select ${item.name}`}
    >
      <View
        style={{
          width: 32,
          height: 32,
          backgroundColor: theme.colors.primary,
          borderWidth: 2,
          borderColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="location" size={16} color={theme.colors.primaryForeground} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: theme.typography.fonts.bold,
            fontSize: theme.typography.sizes.base,
            color: theme.colors.foreground,
          }}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        {item.code && (
          <Text
            style={{
              fontFamily: theme.typography.fonts.regular,
              fontSize: theme.typography.sizes.xs,
              color: theme.colors.mutedForeground,
            }}
          >
            {item.code}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  ), [theme, handleSelectStop]);

  const triggerStyle = StyleSheet.create({
    container: {
      gap: theme.spacing[1],
    },
    label: {
      fontFamily: theme.typography.fonts.bold,
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.foreground,
      textTransform: 'uppercase',
      letterSpacing: theme.typography.letterSpacing.wide,
    },
    input: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.input,
      borderWidth: theme.borderWidths.base,
      borderColor: error ? theme.colors.destructive : theme.colors.border,
      paddingHorizontal: theme.spacing[3],
      minHeight: theme.touchTargets.comfortable,
      gap: theme.spacing[2],
    },
    value: {
      flex: 1,
      fontFamily: theme.typography.fonts.regular,
      fontSize: theme.typography.sizes.base,
      color: value ? theme.colors.foreground : theme.colors.mutedForeground,
      paddingVertical: theme.spacing[3],
    },
    error: {
      fontFamily: theme.typography.fonts.regular,
      fontSize: theme.typography.sizes.xs,
      color: theme.colors.destructive,
    },
  });

  return (
    <>
      {/* Trigger */}
      <View style={triggerStyle.container}>
        <Text style={triggerStyle.label}>{label}</Text>
        <TouchableOpacity
          style={triggerStyle.input}
          onPress={handleOpen}
          accessibilityRole="combobox"
          accessibilityLabel={label}
        >
          <Ionicons name="location" size={20} color={theme.colors.mutedForeground} />
          <Text style={triggerStyle.value} numberOfLines={1}>
            {value?.name || placeholder}
          </Text>
          {value && (
            <TouchableOpacity
              onPress={handleClear}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={20} color={theme.colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
        {error && <Text style={triggerStyle.error}>{error}</Text>}
      </View>

      {/* Search Modal */}
      <Modal
        visible={isOpen}
        animationType="none"
        transparent
        onRequestClose={handleClose}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          onPress={handleClose}
        >
          <Animated.View
            entering={SlideInDown.duration(200)}
            exiting={SlideOutDown.duration(150)}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: SCREEN_HEIGHT * 0.75,
              backgroundColor: theme.colors.card,
              borderTopWidth: theme.borderWidths.thick,
              borderColor: theme.colors.border,
            }}
            onStartShouldSetResponder={() => true}
          >
            {/* Search Header */}
            <View
              style={{
                paddingTop: theme.spacing[4],
                paddingHorizontal: theme.spacing[4],
                paddingBottom: theme.spacing[3],
                borderBottomWidth: theme.borderWidths.base,
                borderBottomColor: theme.colors.border,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: theme.colors.input,
                  borderWidth: theme.borderWidths.base,
                  borderColor: theme.colors.border,
                  paddingHorizontal: theme.spacing[3],
                }}
              >
                <Ionicons name="search" size={20} color={theme.colors.mutedForeground} />
                <TextInput
                  ref={inputRef}
                  style={{
                    flex: 1,
                    fontFamily: theme.typography.fonts.regular,
                    fontSize: theme.typography.sizes.base,
                    color: theme.colors.foreground,
                    paddingVertical: theme.spacing[3],
                    paddingHorizontal: theme.spacing[2],
                  }}
                  placeholder={placeholder}
                  placeholderTextColor={theme.colors.mutedForeground}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color={theme.colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Map Select Option */}
              {onMapSelect && (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing[2],
                    marginTop: theme.spacing[3],
                    paddingVertical: theme.spacing[2],
                  }}
                  onPress={handleMapSelect}
                >
                  <Ionicons name="map" size={20} color={theme.colors.primary} />
                  <Text
                    style={{
                      fontFamily: theme.typography.fonts.bold,
                      fontSize: theme.typography.sizes.sm,
                      color: theme.colors.primary,
                      textTransform: 'uppercase',
                    }}
                  >
                    Select on Map
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Stops List */}
            <FlatList
              data={filteredStops}
              renderItem={renderStop}
              keyExtractor={(item) => String(item.id)}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: insets.bottom }}
              ListEmptyComponent={
                <View style={{ padding: theme.spacing[6], alignItems: 'center' }}>
                  <Text
                    style={{
                      fontFamily: theme.typography.fonts.regular,
                      fontSize: theme.typography.sizes.base,
                      color: theme.colors.mutedForeground,
                    }}
                  >
                    {searchQuery ? 'No stops found' : 'Start typing to search...'}
                  </Text>
                </View>
              }
            />
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

export default memo(StopSearchInputComponent);
