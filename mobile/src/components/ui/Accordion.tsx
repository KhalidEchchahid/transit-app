import React, { memo, useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ViewStyle, TextStyle, LayoutAnimation, Platform, UIManager } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

function AccordionItemComponent({
  title,
  children,
  defaultOpen = false,
  icon,
  style,
}: AccordionItemProps) {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const rotation = useSharedValue(defaultOpen ? 1 : 0);

  const handleToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsOpen((prev) => !prev);
    rotation.value = withTiming(isOpen ? 0 : 1, { duration: 200 });
  }, [isOpen, rotation]);

  const iconAnimatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      rotation.value,
      [0, 1],
      [0, 180],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ rotate: `${rotate}deg` }],
    };
  });

  const containerStyle: ViewStyle = {
    borderWidth: theme.borderWidths.base,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    ...theme.shadows.sm,
    ...style,
  };

  const headerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    minHeight: theme.touchTargets.comfortable,
    gap: theme.spacing[2],
  };

  const titleContainerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing[2],
  };

  const titleStyle: TextStyle = {
    fontFamily: theme.typography.fonts.bold,
    fontSize: theme.typography.sizes.base,
    color: theme.colors.foreground,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wide,
    flex: 1,
  };

  const contentStyle: ViewStyle = {
    paddingHorizontal: theme.spacing[4],
    paddingBottom: theme.spacing[4],
    borderTopWidth: theme.borderWidths.thin,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing[3],
  };

  return (
    <View style={containerStyle}>
      <TouchableOpacity
        style={headerStyle}
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        accessibilityLabel={title}
      >
        <View style={titleContainerStyle}>
          {icon}
          <Text style={titleStyle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Animated.View style={iconAnimatedStyle}>
          <Ionicons
            name="chevron-down"
            size={20}
            color={theme.colors.foreground}
          />
        </Animated.View>
      </TouchableOpacity>

      {isOpen && <View style={contentStyle}>{children}</View>}
    </View>
  );
}

export const AccordionItem = memo(AccordionItemComponent);

interface AccordionProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

function AccordionComponent({ children, style }: AccordionProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        {
          gap: theme.spacing[2],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export const Accordion = Object.assign(memo(AccordionComponent), {
  Item: AccordionItem,
});
