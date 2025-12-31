import React, { memo } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export type BadgeTone = 'muted' | 'accent' | 'critical' | 'success' | 'info';
export type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  size?: BadgeSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}

function BadgeComponent({
  children,
  tone = 'muted',
  size = 'md',
  leftIcon,
  rightIcon,
  style,
  textStyle,
  accessibilityLabel,
}: BadgeProps) {
  const { theme } = useTheme();

  const getToneStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (tone) {
      case 'accent':
        return {
          container: { backgroundColor: theme.colors.accent },
          text: { color: theme.colors.accentForeground },
        };
      case 'critical':
        return {
          container: { backgroundColor: theme.colors.destructive },
          text: { color: theme.colors.destructiveForeground },
        };
      case 'success':
        return {
          container: { backgroundColor: theme.colors.modes.busway },
          text: { color: '#FFFFFF' },
        };
      case 'info':
        return {
          container: { backgroundColor: theme.colors.modes.bus },
          text: { color: '#FFFFFF' },
        };
      default:
        return {
          container: { backgroundColor: theme.colors.muted },
          text: { color: theme.colors.foreground },
        };
    }
  };

  const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (size) {
      case 'sm':
        return {
          container: {
            paddingHorizontal: theme.spacing[1.5],
            paddingVertical: theme.spacing[0.5],
          },
          text: {
            fontSize: theme.typography.sizes.xs,
          },
        };
      default:
        return {
          container: {
            paddingHorizontal: theme.spacing[2],
            paddingVertical: theme.spacing[1],
          },
          text: {
            fontSize: theme.typography.sizes.xs,
          },
        };
    }
  };

  const toneStyles = getToneStyles();
  const sizeStyles = getSizeStyles();

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[1],
    borderWidth: theme.borderWidths.base,
    borderColor: theme.colors.border,
    ...theme.shadows.xs,
    ...toneStyles.container,
    ...sizeStyles.container,
    ...style,
  };

  const labelStyle: TextStyle = {
    fontFamily: theme.typography.fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wide,
    ...toneStyles.text,
    ...sizeStyles.text,
    ...textStyle,
  };

  const extractPlainText = (node: React.ReactNode): string | undefined => {
    if (node === null || node === undefined || typeof node === 'boolean') return undefined;
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) {
      const parts = node
        .map(extractPlainText)
        .filter((p): p is string => typeof p === 'string' && p.length > 0);
      return parts.length ? parts.join(' ') : undefined;
    }
    return undefined;
  };

  const renderLabelNode = (node: React.ReactNode): React.ReactNode => {
    if (node === null || node === undefined || typeof node === 'boolean') return null;
    if (typeof node === 'string' || typeof node === 'number') {
      return <Text style={labelStyle}>{String(node)}</Text>;
    }
    if (Array.isArray(node)) {
      return node.map((child, idx) => (
        <React.Fragment key={idx}>{renderLabelNode(child)}</React.Fragment>
      ));
    }
    return node;
  };

  return (
    <View
      style={containerStyle}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel || extractPlainText(children)}
    >
      {renderLabelNode(leftIcon)}
      {renderLabelNode(children)}
      {renderLabelNode(rightIcon)}
    </View>
  );
}

export const Badge = memo(BadgeComponent);
