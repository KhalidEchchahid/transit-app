import React, { memo, useEffect } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
  SlideInRight,
  SlideOutRight,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeProvider';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onDismiss?: () => void;
  action?: {
    label: string;
    onPress: () => void;
  };
}

function ToastComponent({
  message,
  type = 'info',
  duration = 4000,
  onDismiss,
  action,
}: ToastProps) {
  const { theme } = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    // Haptic feedback based on toast type
    if (type === 'error') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (type === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (type === 'warning') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    // Auto-dismiss timer
    progress.value = withTiming(1, { duration }, () => {
      if (onDismiss) {
        runOnJS(onDismiss)();
      }
    });
  }, [duration, onDismiss, progress, type]);

  const getTypeStyles = (): { bg: string; icon: keyof typeof Ionicons.glyphMap; iconColor: string } => {
    switch (type) {
      case 'success':
        return {
          bg: theme.colors.modes.busway,
          icon: 'checkmark-circle',
          iconColor: '#FFFFFF',
        };
      case 'error':
        return {
          bg: theme.colors.destructive,
          icon: 'close-circle',
          iconColor: theme.colors.destructiveForeground,
        };
      case 'warning':
        return {
          bg: theme.colors.accent,
          icon: 'warning',
          iconColor: theme.colors.accentForeground,
        };
      default:
        return {
          bg: theme.colors.modes.bus,
          icon: 'information-circle',
          iconColor: '#FFFFFF',
        };
    }
  };

  const typeStyles = getTypeStyles();

  const progressStyle = useAnimatedStyle(() => ({
    width: `${(1 - progress.value) * 100}%`,
  }));

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: typeStyles.bg,
    borderWidth: theme.borderWidths.base,
    borderColor: theme.colors.border,
    padding: theme.spacing[3],
    gap: theme.spacing[3],
    ...theme.shadows.lg,
  };

  const messageStyle: TextStyle = {
    flex: 1,
    fontFamily: theme.typography.fonts.regular,
    fontSize: theme.typography.sizes.base,
    color: typeStyles.iconColor,
  };

  const actionStyle: TextStyle = {
    fontFamily: theme.typography.fonts.bold,
    fontSize: theme.typography.sizes.sm,
    color: typeStyles.iconColor,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wide,
    textDecorationLine: 'underline',
  };

  return (
    <Animated.View
      entering={SlideInRight.duration(200)}
      exiting={SlideOutRight.duration(150)}
      style={containerStyle}
    >
      <Ionicons name={typeStyles.icon} size={24} color={typeStyles.iconColor} />
      <Text style={messageStyle}>{message}</Text>
      {action && (
        <Pressable onPress={action.onPress}>
          <Text style={actionStyle}>{action.label}</Text>
        </Pressable>
      )}
      <Pressable onPress={onDismiss}>
        <Ionicons name="close" size={20} color={typeStyles.iconColor} />
      </Pressable>
      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: 3,
            backgroundColor: 'rgba(255,255,255,0.5)',
          },
          progressStyle,
        ]}
      />
    </Animated.View>
  );
}

export const Toast = memo(ToastComponent);
