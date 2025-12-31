import { useMemo } from 'react';
import { StyleSheet, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { useTheme } from './ThemeProvider';
import { Theme } from './index';

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };
type StyleFactory<T> = (theme: Theme) => NamedStyles<T>;

/**
 * Hook for creating theme-aware styles
 * Similar to styled-components but optimized for React Native
 */
export function useThemedStyles<T extends NamedStyles<T>>(
  styleFactory: StyleFactory<T>
): T {
  const { theme } = useTheme();

  return useMemo(() => {
    const styles = styleFactory(theme);
    return StyleSheet.create(styles) as T;
  }, [theme, styleFactory]);
}

/**
 * Create a style factory that can be used with useThemedStyles
 */
export function createStyles<T extends NamedStyles<T>>(
  factory: StyleFactory<T>
): StyleFactory<T> {
  return factory;
}

/**
 * Common style patterns for brutalist design
 */
export const brutalStyles = {
  // Thick border with offset shadow
  brutalBox: (theme: Theme): ViewStyle => ({
    borderWidth: theme.borderWidths.base,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    ...theme.shadows.md,
  }),

  // Primary action button style
  primaryButton: (theme: Theme): ViewStyle => ({
    backgroundColor: theme.colors.primary,
    borderWidth: theme.borderWidths.base,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    ...theme.shadows.md,
  }),

  // Ghost button style
  ghostButton: (theme: Theme): ViewStyle => ({
    backgroundColor: theme.colors.background,
    borderWidth: theme.borderWidths.base,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    ...theme.shadows.sm,
  }),

  // Muted button style
  mutedButton: (theme: Theme): ViewStyle => ({
    backgroundColor: theme.colors.muted,
    borderWidth: theme.borderWidths.base,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    ...theme.shadows.sm,
  }),

  // Input field style
  input: (theme: Theme): ViewStyle => ({
    backgroundColor: theme.colors.input,
    borderWidth: theme.borderWidths.base,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    minHeight: theme.touchTargets.minimum,
  }),

  // Card style
  card: (theme: Theme): ViewStyle => ({
    backgroundColor: theme.colors.card,
    borderWidth: theme.borderWidths.base,
    borderColor: theme.colors.border,
    padding: theme.spacing[4],
    ...theme.shadows.md,
  }),

  // Badge style
  badge: (theme: Theme): ViewStyle => ({
    borderWidth: theme.borderWidths.base,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing[2],
    paddingVertical: theme.spacing[1],
    ...theme.shadows.xs,
  }),

  // Header text style
  heading: (theme: Theme): TextStyle => ({
    fontFamily: theme.typography.fonts.heading,
    fontSize: theme.typography.sizes.xl,
    color: theme.colors.foreground,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wider,
  }),

  // Body text style
  body: (theme: Theme): TextStyle => ({
    fontFamily: theme.typography.fonts.regular,
    fontSize: theme.typography.sizes.base,
    color: theme.colors.foreground,
    lineHeight: theme.typography.sizes.base * theme.typography.lineHeights.normal,
  }),

  // Label text style
  label: (theme: Theme): TextStyle => ({
    fontFamily: theme.typography.fonts.bold,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.foreground,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wide,
  }),
};

export type BrutalStyleKey = keyof typeof brutalStyles;
