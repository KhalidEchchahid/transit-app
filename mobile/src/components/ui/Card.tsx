import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
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
const AnimatedView = Animated.createAnimatedComponent(View);

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  elevated?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

function CardComponent({
  children,
  onPress,
  elevated = false,
  style,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: CardProps) {
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
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  }, [onPress]);

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

  const containerStyle: ViewStyle = {
    backgroundColor: theme.colors.card,
    borderWidth: theme.borderWidths.base,
    borderColor: theme.colors.border,
    padding: theme.spacing[4],
    ...(elevated ? theme.shadows.lg : theme.shadows.md),
    ...style,
  };

  if (onPress) {
    return (
      <AnimatedTouchable
        style={[containerStyle, animatedStyle]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        testID={testID}
      >
        {children}
      </AnimatedTouchable>
    );
  }

  return (
    <View
      style={containerStyle}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {children}
    </View>
  );
}

interface CardHeaderProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

function CardHeader({ children, style }: CardHeaderProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        {
          paddingBottom: theme.spacing[3],
          borderBottomWidth: theme.borderWidths.thin,
          borderBottomColor: theme.colors.border,
          marginBottom: theme.spacing[3],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

interface CardTitleProps {
  children: string;
  style?: TextStyle;
}

function CardTitle({ children, style }: CardTitleProps) {
  const { theme } = useTheme();

  return (
    <Text
      style={[
        {
          fontFamily: theme.typography.fonts.heading,
          fontSize: theme.typography.sizes.lg,
          color: theme.colors.foreground,
          textTransform: 'uppercase',
          letterSpacing: theme.typography.letterSpacing.wide,
        },
        style,
      ]}
      accessibilityRole="header"
    >
      {children}
    </Text>
  );
}

interface CardContentProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

function CardContent({ children, style }: CardContentProps) {
  return <View style={style}>{children}</View>;
}

interface CardFooterProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

function CardFooter({ children, style }: CardFooterProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        {
          paddingTop: theme.spacing[3],
          borderTopWidth: theme.borderWidths.thin,
          borderTopColor: theme.colors.border,
          marginTop: theme.spacing[3],
          flexDirection: 'row',
          gap: theme.spacing[2],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export const Card = Object.assign(memo(CardComponent), {
  Header: memo(CardHeader),
  Title: memo(CardTitle),
  Content: memo(CardContent),
  Footer: memo(CardFooter),
});
