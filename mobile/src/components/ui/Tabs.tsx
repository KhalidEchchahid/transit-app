import React, { memo, useState, useCallback, useMemo } from 'react';
import { View, TouchableOpacity, Text, ViewStyle, TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  interpolateColor,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeProvider';

interface TabItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  style?: ViewStyle;
}

function TabsComponent({ items, activeKey, onChange, style }: TabsProps) {
  const { theme } = useTheme();
  const [tabLayouts, setTabLayouts] = useState<Record<string, { x: number; width: number }>>({});

  const handleTabPress = useCallback(
    (key: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onChange(key);
    },
    [onChange]
  );

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    backgroundColor: theme.colors.muted,
    borderWidth: theme.borderWidths.base,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
    ...style,
  };

  return (
    <View style={containerStyle}>
      {items.map((item, index) => {
        const isActive = item.key === activeKey;
        const isLast = index === items.length - 1;

        const tabStyle: ViewStyle = {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: theme.spacing[3],
          paddingHorizontal: theme.spacing[2],
          minHeight: theme.touchTargets.comfortable,
          backgroundColor: isActive ? theme.colors.primary : 'transparent',
          borderRightWidth: isLast ? 0 : theme.borderWidths.thin,
          borderRightColor: theme.colors.border,
          gap: theme.spacing[1],
        };

        const textStyle: TextStyle = {
          fontFamily: theme.typography.fonts.bold,
          fontSize: theme.typography.sizes.sm,
          color: isActive ? theme.colors.primaryForeground : theme.colors.foreground,
          textTransform: 'uppercase',
          letterSpacing: theme.typography.letterSpacing.wide,
        };

        return (
          <TouchableOpacity
            key={item.key}
            style={tabStyle}
            onPress={() => handleTabPress(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={item.label}
          >
            {item.icon}
            <Text style={textStyle} numberOfLines={1}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export const Tabs = memo(TabsComponent);

interface TabContentProps {
  children: React.ReactNode;
  tabKey: string;
  activeKey: string;
}

function TabContentComponent({ children, tabKey, activeKey }: TabContentProps) {
  if (tabKey !== activeKey) {
    return null;
  }

  return <>{children}</>;
}

export const TabContent = memo(TabContentComponent);
