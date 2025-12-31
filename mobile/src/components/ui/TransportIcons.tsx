import React, { memo } from 'react';
import { View, Text, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';

export type TransportMode = 'bus' | 'tram' | 'train' | 'busway' | 'taxi' | 'walk';

interface ModeIconProps {
  mode: TransportMode;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  style?: ViewStyle;
}

const MODE_ICONS: Record<TransportMode, keyof typeof Ionicons.glyphMap> = {
  bus: 'bus',
  tram: 'train-outline',
  train: 'train',
  busway: 'bus',
  taxi: 'car',
  walk: 'walk',
};

const MODE_LABELS: Record<TransportMode, string> = {
  bus: 'Bus',
  tram: 'Tram',
  train: 'Train',
  busway: 'Busway',
  taxi: 'Taxi',
  walk: 'Walk',
};

function ModeIconComponent({
  mode,
  size = 'md',
  showLabel = false,
  style,
}: ModeIconProps) {
  const { theme } = useTheme();

  const getSizeValue = (): number => {
    switch (size) {
      case 'sm':
        return 16;
      case 'lg':
        return 28;
      default:
        return 20;
    }
  };

  const getContainerSize = (): number => {
    switch (size) {
      case 'sm':
        return 28;
      case 'lg':
        return 48;
      default:
        return 36;
    }
  };

  const modeColor = theme.colors.modes[mode] || theme.colors.primary;
  const iconSize = getSizeValue();
  const containerSize = getContainerSize();

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
    ...style,
  };

  const iconContainerStyle: ViewStyle = {
    width: containerSize,
    height: containerSize,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: modeColor,
    borderWidth: theme.borderWidths.base,
    borderColor: theme.colors.border,
    ...theme.shadows.xs,
  };

  const labelStyle: TextStyle = {
    fontFamily: theme.typography.fonts.bold,
    fontSize: size === 'sm' ? theme.typography.sizes.xs : theme.typography.sizes.sm,
    color: theme.colors.foreground,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wide,
  };

  // Determine if we need light or dark icon color based on background
  const getIconColor = () => {
    // For dark backgrounds, use white
    if (['bus', 'train', 'busway'].includes(mode)) {
      return '#FFFFFF';
    }
    // For lighter backgrounds (taxi, walk), use black
    if (mode === 'taxi' || mode === 'walk') {
      return '#000000';
    }
    return '#FFFFFF';
  };

  return (
    <View style={containerStyle}>
      <View style={iconContainerStyle}>
        <Ionicons
          name={MODE_ICONS[mode]}
          size={iconSize}
          color={getIconColor()}
        />
      </View>
      {showLabel && <Text style={labelStyle}>{MODE_LABELS[mode]}</Text>}
    </View>
  );
}

export const ModeIcon = memo(ModeIconComponent);

interface LineBadgeProps {
  code: string;
  color?: string;
  mode?: TransportMode;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

function LineBadgeComponent({
  code,
  color,
  mode,
  size = 'md',
  style,
}: LineBadgeProps) {
  const { theme } = useTheme();

  const fallbackColor = mode ? theme.colors.modes[mode] : theme.colors.primary;

  const normalizeBadgeColor = (value: string | undefined, fallback: string) => {
    if (!value) return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;

    // Hex: #RGB, #RRGGBB, #RRGGBBAA
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
      // If alpha is present and effectively transparent, fallback.
      if (trimmed.length === 9) {
        const alphaHex = trimmed.slice(7, 9);
        const alpha = Number.parseInt(alphaHex, 16) / 255;
        if (Number.isFinite(alpha) && alpha < 0.2) return fallback;
      }
      return trimmed;
    }

    // rgb()/rgba()
    const rgba = trimmed.match(
      /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(\d*\.?\d+)\s*)?\)$/i
    );
    if (rgba) {
      const a = rgba[4] !== undefined ? Number(rgba[4]) : 1;
      if (Number.isFinite(a) && a < 0.2) return fallback;
      return trimmed;
    }

    // Named colors are allowed by RN; keep them.
    return trimmed;
  };

  const backgroundColor = normalizeBadgeColor(color, fallbackColor);

  const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (size) {
      case 'sm':
        return {
          container: {
            paddingHorizontal: theme.spacing[2],
            paddingVertical: theme.spacing[1],
            minWidth: 32,
          },
          text: {
            fontSize: theme.typography.sizes.xs,
          },
        };
      case 'lg':
        return {
          container: {
            paddingHorizontal: theme.spacing[4],
            paddingVertical: theme.spacing[2],
            minWidth: 56,
          },
          text: {
            fontSize: theme.typography.sizes.lg,
          },
        };
      default:
        return {
          container: {
            paddingHorizontal: theme.spacing[3],
            paddingVertical: theme.spacing[1.5],
            minWidth: 44,
          },
          text: {
            fontSize: theme.typography.sizes.base,
          },
        };
    }
  };

  const sizeStyles = getSizeStyles();

  // Determine text color based on background brightness
  const getTextColor = () => {
    if (!backgroundColor) return '#FFFFFF';

    const parseToRgb = (value: string): { r: number; g: number; b: number } | null => {
      const v = value.trim();
      if (/^#([0-9a-fA-F]{3})$/.test(v)) {
        const r = Number.parseInt(v[1] + v[1], 16);
        const g = Number.parseInt(v[2] + v[2], 16);
        const b = Number.parseInt(v[3] + v[3], 16);
        return { r, g, b };
      }
      if (/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) {
        const r = Number.parseInt(v.slice(1, 3), 16);
        const g = Number.parseInt(v.slice(3, 5), 16);
        const b = Number.parseInt(v.slice(5, 7), 16);
        return { r, g, b };
      }
      const m = v.match(
        /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(\d*\.?\d+)\s*)?\)$/i
      );
      if (m) {
        return {
          r: Math.max(0, Math.min(255, Number(m[1]))),
          g: Math.max(0, Math.min(255, Number(m[2]))),
          b: Math.max(0, Math.min(255, Number(m[3]))),
        };
      }
      return null;
    };

    const rgb = parseToRgb(backgroundColor);
    if (!rgb) return theme.colors.foreground;

    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness > 160 ? '#000000' : '#FFFFFF';
  };

  const containerStyle: ViewStyle = {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor,
    borderWidth: theme.borderWidths.base,
    borderColor: theme.colors.border,
    ...theme.shadows.sm,
    ...sizeStyles.container,
    ...style,
  };

  const textStyle: TextStyle = {
    fontFamily: theme.typography.fonts.heading,
    color: getTextColor(),
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wide,
    textAlign: 'center',
    ...sizeStyles.text,
  };

  return (
    <View style={containerStyle}>
      <Text style={textStyle}>{code}</Text>
    </View>
  );
}

export const LineBadge = memo(LineBadgeComponent);
