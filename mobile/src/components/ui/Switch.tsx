import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeProvider';

interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 32;
const THUMB_SIZE = 24;
const THUMB_MARGIN = 4;

function SwitchComponent({
  value,
  onValueChange,
  label,
  disabled = false,
  style,
  accessibilityLabel,
}: SwitchProps) {
  const { theme } = useTheme();
  const position = useSharedValue(value ? 1 : 0);

  const handlePress = useCallback(() => {
    if (!disabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const newValue = !value;
      position.value = withSpring(newValue ? 1 : 0, {
        damping: 15,
        stiffness: 200,
      });
      onValueChange(newValue);
    }
  }, [disabled, value, onValueChange, position]);

  // Sync animation with value prop
  React.useEffect(() => {
    position.value = withSpring(value ? 1 : 0, {
      damping: 15,
      stiffness: 200,
    });
  }, [value, position]);

  const thumbAnimatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      position.value,
      [0, 1],
      [THUMB_MARGIN, TRACK_WIDTH - THUMB_SIZE - THUMB_MARGIN]
    );
    return {
      transform: [{ translateX }],
    };
  });

  const trackAnimatedStyle = useAnimatedStyle(() => {
    const backgroundColor = value ? theme.colors.primary : theme.colors.muted;
    return {
      backgroundColor,
    };
  });

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    opacity: disabled ? 0.5 : 1,
    ...style,
  };

  const trackStyle: ViewStyle = {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderWidth: theme.borderWidths.base,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    ...theme.shadows.sm,
  };

  const thumbStyle: ViewStyle = {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    backgroundColor: theme.colors.background,
    borderWidth: theme.borderWidths.base,
    borderColor: theme.colors.border,
    ...theme.shadows.xs,
  };

  const labelStyle: TextStyle = {
    fontFamily: theme.typography.fonts.regular,
    fontSize: theme.typography.sizes.base,
    color: theme.colors.foreground,
  };

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={1}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel || label}
    >
      <Animated.View style={[trackStyle, trackAnimatedStyle]}>
        <Animated.View style={[thumbStyle, thumbAnimatedStyle]} />
      </Animated.View>
      {label && <Text style={labelStyle}>{label}</Text>}
    </TouchableOpacity>
  );
}

export const Switch = memo(SwitchComponent);
