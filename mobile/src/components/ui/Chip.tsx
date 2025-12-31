import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeProvider';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  leftIcon?: React.ReactNode;
  disabled?: boolean;
  color?: string;
  style?: ViewStyle;
}

function ChipComponent({
  label,
  selected = false,
  onPress,
  leftIcon,
  disabled = false,
  color,
  style,
}: ChipProps) {
  const { theme } = useTheme();
  const pressed = useSharedValue(0);

  const handlePressIn = useCallback(() => {
    if (onPress) {
      pressed.value = withTiming(1, { duration: 50 });
    }
  }, [pressed, onPress]);

  const handlePressOut = useCallback(() => {
    pressed.value = withTiming(0, { duration: 100 });
  }, [pressed]);

  const handlePress = useCallback(() => {
    if (onPress && !disabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  }, [onPress, disabled]);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(pressed.value, [0, 1], [1, 0.95]);
    return {
      transform: [{ scale }],
    };
  });

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    gap: theme.spacing[1.5],
    borderWidth: theme.borderWidths.base,
    borderColor: theme.colors.border,
    backgroundColor: selected
      ? color || theme.colors.primary
      : theme.colors.muted,
    opacity: disabled ? 0.5 : 1,
    ...theme.shadows.xs,
    ...style,
  };

  const labelStyle: TextStyle = {
    fontFamily: theme.typography.fonts.bold,
    fontSize: theme.typography.sizes.sm,
    color: selected
      ? color ? '#FFFFFF' : theme.colors.primaryForeground
      : theme.colors.foreground,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wide,
  };

  if (onPress) {
    return (
      <AnimatedTouchable
        style={[containerStyle, animatedStyle]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityState={{ selected, disabled }}
        accessibilityLabel={label}
      >
        {leftIcon}
        <Text style={labelStyle}>{label}</Text>
      </AnimatedTouchable>
    );
  }

  return (
    <View style={containerStyle} accessibilityLabel={label}>
      {leftIcon}
      <Text style={labelStyle}>{label}</Text>
    </View>
  );
}

export const Chip = memo(ChipComponent);

interface ChipGroupProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

function ChipGroupComponent({ children, style }: ChipGroupProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing[2],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export const ChipGroup = memo(ChipGroupComponent);
