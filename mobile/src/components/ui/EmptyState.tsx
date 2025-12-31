import React, { memo } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  action?:
    | {
        label: string;
        onPress: () => void;
      }
    | React.ReactNode;
  style?: ViewStyle;
}

function EmptyStateComponent({
  title,
  message,
  icon = 'search-outline',
  action,
  style,
}: EmptyStateProps) {
  const { theme } = useTheme();

  const containerStyle: ViewStyle = {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing[8],
    gap: theme.spacing[4],
    borderWidth: theme.borderWidths.base,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    backgroundColor: theme.colors.card,
    ...style,
  };

  const titleStyle: TextStyle = {
    fontFamily: theme.typography.fonts.heading,
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.foreground,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wider,
    textAlign: 'center',
  };

  const messageStyle: TextStyle = {
    fontFamily: theme.typography.fonts.regular,
    fontSize: theme.typography.sizes.base,
    color: theme.colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 280,
  };

  return (
    <View style={containerStyle}>
      <View
        style={{
          width: 64,
          height: 64,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.muted,
          borderWidth: theme.borderWidths.base,
          borderColor: theme.colors.border,
        }}
      >
        <Ionicons
          name={icon}
          size={32}
          color={theme.colors.mutedForeground}
        />
      </View>
      <Text style={titleStyle}>{title}</Text>
      {message && <Text style={messageStyle}>{message}</Text>}
      {typeof action === 'object' && action !== null && 'label' in action && 'onPress' in action ? (
        <Button variant="ghost" size="sm" onPress={action.onPress}>
          {action.label}
        </Button>
      ) : (
        action || null
      )}
    </View>
  );
}

export const EmptyState = memo(EmptyStateComponent);
