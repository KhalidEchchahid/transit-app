import React, { memo, useCallback } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  AccessibilityRole,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeProvider';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export type ButtonVariant = 'primary' | 'ghost' | 'muted' | 'destructive' | 'accent';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

function ButtonComponent({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  block = false,
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { theme } = useTheme();
  const pressed = useSharedValue(0);

  const handlePressIn = useCallback(() => {
    pressed.value = withTiming(1, { duration: 50 });
  }, [pressed]);

  const handlePressOut = useCallback(() => {
    pressed.value = withTiming(0, { duration: 100 });
  }, [pressed]);

  const handlePress = useCallback(() => {
    if (!disabled && !loading && onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onPress();
    }
  }, [disabled, loading, onPress]);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(pressed.value, [0, 1], [0, 2]);
    const translateY = interpolate(pressed.value, [0, 1], [0, 2]);
    
    return {
      transform: [
        { translateX },
        { translateY },
      ],
    };
  });

  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    const baseContainer: ViewStyle = {
      borderWidth: theme.borderWidths.base,
      borderColor: theme.colors.border,
    };

    switch (variant) {
      case 'primary':
        return {
          container: {
            ...baseContainer,
            backgroundColor: theme.colors.primary,
            ...theme.shadows.md,
          },
          text: {
            color: theme.colors.primaryForeground,
          },
        };
      case 'ghost':
        return {
          container: {
            ...baseContainer,
            backgroundColor: theme.colors.background,
            ...theme.shadows.sm,
          },
          text: {
            color: theme.colors.foreground,
          },
        };
      case 'muted':
        return {
          container: {
            ...baseContainer,
            backgroundColor: theme.colors.muted,
            ...theme.shadows.sm,
          },
          text: {
            color: theme.colors.foreground,
          },
        };
      case 'destructive':
        return {
          container: {
            ...baseContainer,
            backgroundColor: theme.colors.destructive,
            ...theme.shadows.md,
          },
          text: {
            color: theme.colors.destructiveForeground,
          },
        };
      case 'accent':
        return {
          container: {
            ...baseContainer,
            backgroundColor: theme.colors.accent,
            ...theme.shadows.md,
          },
          text: {
            color: theme.colors.accentForeground,
          },
        };
      default:
        return {
          container: baseContainer,
          text: { color: theme.colors.foreground },
        };
    }
  };

  const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (size) {
      case 'sm':
        return {
          container: {
            paddingHorizontal: theme.spacing[3],
            paddingVertical: theme.spacing[2],
            minHeight: theme.touchTargets.minimum,
          },
          text: {
            fontSize: theme.typography.sizes.sm,
          },
        };
      case 'lg':
        return {
          container: {
            paddingHorizontal: theme.spacing[6],
            paddingVertical: theme.spacing[4],
            minHeight: theme.touchTargets.large,
          },
          text: {
            fontSize: theme.typography.sizes.lg,
          },
        };
      default:
        return {
          container: {
            paddingHorizontal: theme.spacing[4],
            paddingVertical: theme.spacing[3],
            minHeight: theme.touchTargets.comfortable,
          },
          text: {
            fontSize: theme.typography.sizes.base,
          },
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[2],
    ...variantStyles.container,
    ...sizeStyles.container,
    ...(block && { width: '100%' }),
    ...(disabled && { opacity: 0.5 }),
    ...style,
  };

  const labelStyle: TextStyle = {
    fontFamily: theme.typography.fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wider,
    ...variantStyles.text,
    ...sizeStyles.text,
    ...textStyle,
  };

  return (
    <AnimatedTouchable
      style={[containerStyle, animatedStyle]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || (typeof children === 'string' ? children : undefined)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading }}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantStyles.text.color}
        />
      ) : (
        <>
          {leftIcon}
          {typeof children === 'string' ? (
            <Text style={labelStyle}>{children}</Text>
          ) : (
            children
          )}
          {rightIcon}
        </>
      )}
    </AnimatedTouchable>
  );
}

export const Button = memo(ButtonComponent);
