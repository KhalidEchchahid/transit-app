import React, { memo, useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  style?: ViewStyle;
}

function SkeletonComponent({ width = '100%', height = 20, style }: SkeletonProps) {
  const { theme } = useTheme();
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1000 }),
      -1,
      true
    );
  }, [shimmer]);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(shimmer.value, [0, 1], [0.3, 0.7]);
    return { opacity };
  });

  const containerStyle: ViewStyle = {
    width: typeof width === 'number' ? width : undefined,
    height,
    backgroundColor: theme.colors.muted,
    borderWidth: theme.borderWidths.thin,
    borderColor: theme.colors.border,
    ...style,
  };

  if (typeof width === 'string') {
    // Handle percentage widths
    return (
      <Animated.View
        style={[{ flex: 1 }, containerStyle, animatedStyle]}
      />
    );
  }

  return <Animated.View style={[containerStyle, animatedStyle]} />;
}

export const Skeleton = memo(SkeletonComponent);

interface SkeletonTextProps {
  lines?: number;
  lineHeight?: number;
  lastLineWidth?: number | string;
  style?: ViewStyle;
}

function SkeletonTextComponent({
  lines = 3,
  lineHeight = 16,
  lastLineWidth = '60%',
  style,
}: SkeletonTextProps) {
  const { theme } = useTheme();

  return (
    <View style={[{ gap: theme.spacing[2] }, style]}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height={lineHeight}
          width={index === lines - 1 ? lastLineWidth : '100%'}
        />
      ))}
    </View>
  );
}

export const SkeletonText = memo(SkeletonTextComponent);

interface SkeletonCardProps {
  style?: ViewStyle;
}

function SkeletonCardComponent({ style }: SkeletonCardProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.card,
          borderWidth: theme.borderWidths.base,
          borderColor: theme.colors.border,
          padding: theme.spacing[4],
          gap: theme.spacing[3],
          ...theme.shadows.sm,
        },
        style,
      ]}
    >
      <Skeleton height={24} width="70%" />
      <SkeletonText lines={2} />
      <View style={{ flexDirection: 'row', gap: theme.spacing[2] }}>
        <Skeleton height={32} width={80} />
        <Skeleton height={32} width={80} />
      </View>
    </View>
  );
}

export const SkeletonCard = memo(SkeletonCardComponent);
