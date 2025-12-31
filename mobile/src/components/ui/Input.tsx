import React, { memo, useState, useCallback, forwardRef } from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeProvider';

const AnimatedView = Animated.createAnimatedComponent(View);

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  disabled?: boolean;
}

const InputComponent = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      containerStyle,
      inputStyle,
      disabled = false,
      onFocus,
      onBlur,
      ...textInputProps
    },
    ref
  ) => {
    const { theme } = useTheme();
    const [isFocused, setIsFocused] = useState(false);
    const focusAnim = useSharedValue(0);

    const handleFocus: NonNullable<TextInputProps['onFocus']> = useCallback((e) => {
        setIsFocused(true);
        focusAnim.value = withTiming(1, { duration: 100 });
        onFocus?.(e);
      },
      [focusAnim, onFocus]
    );

    const handleBlur: NonNullable<TextInputProps['onBlur']> = useCallback((e) => {
        setIsFocused(false);
        focusAnim.value = withTiming(0, { duration: 100 });
        onBlur?.(e);
      },
      [focusAnim, onBlur]
    );

    const animatedContainerStyle = useAnimatedStyle(() => {
      return {
        borderColor: error
          ? theme.colors.destructive
          : focusAnim.value === 1
          ? theme.colors.ring
          : theme.colors.border,
      };
    });

    const wrapperStyle: ViewStyle = {
      gap: theme.spacing[1],
      opacity: disabled ? 0.5 : 1,
      ...containerStyle,
    };

    const inputContainerStyle: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.input,
      borderWidth: theme.borderWidths.base,
      borderColor: error ? theme.colors.destructive : theme.colors.border,
      paddingHorizontal: theme.spacing[3],
      minHeight: theme.touchTargets.comfortable,
      gap: theme.spacing[2],
    };

    const textInputStyle: TextStyle = {
      flex: 1,
      fontFamily: theme.typography.fonts.regular,
      fontSize: theme.typography.sizes.base,
      color: theme.colors.foreground,
      paddingVertical: theme.spacing[3],
      ...inputStyle,
    };

    const labelStyle: TextStyle = {
      fontFamily: theme.typography.fonts.bold,
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.foreground,
      textTransform: 'uppercase',
      letterSpacing: theme.typography.letterSpacing.wide,
    };

    const hintStyle: TextStyle = {
      fontFamily: theme.typography.fonts.regular,
      fontSize: theme.typography.sizes.xs,
      color: error ? theme.colors.destructive : theme.colors.mutedForeground,
    };

    return (
      <View style={wrapperStyle}>
        {label && (
          <Text style={labelStyle} accessibilityRole="text">
            {label}
          </Text>
        )}
        <AnimatedView style={[inputContainerStyle, animatedContainerStyle]}>
          {leftIcon}
          <TextInput
            ref={ref}
            style={textInputStyle}
            placeholderTextColor={theme.colors.mutedForeground}
            onFocus={handleFocus}
            onBlur={handleBlur}
            editable={!disabled}
            accessibilityLabel={label}
            accessibilityState={{ disabled }}
            {...textInputProps}
          />
          {rightIcon}
        </AnimatedView>
        {(error || hint) && (
          <Text style={hintStyle} accessibilityRole="text">
            {error || hint}
          </Text>
        )}
      </View>
    );
  }
);

InputComponent.displayName = 'Input';

export const Input = memo(InputComponent);
