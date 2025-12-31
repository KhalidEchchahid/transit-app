/**
 * Casa Transit - Neo-Brutalist Design System
 * 
 * This theme system mirrors the web frontend's brutalist aesthetic
 * with bold geometric shapes, thick black borders, raw typography,
 * high-contrast color blocks, and intentional visual weight.
 */

// Typography - Space Mono and IBM Plex Mono
export const typography = {
  fonts: {
    regular: 'SpaceMono-Regular',
    bold: 'SpaceMono-Bold',
    mono: 'SpaceMono-Regular',
    heading: 'IBMPlexMono-Bold',
    headingMedium: 'IBMPlexMono-SemiBold',
  },
  sizes: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  lineHeights: {
    tight: 1.1,
    normal: 1.4,
    relaxed: 1.6,
  },
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 1,
    wider: 2,
    widest: 3,
  },
} as const;

// Color palette - matching web frontend's brutalist color scheme
export const colors = {
  light: {
    background: '#FFFFFF',
    foreground: '#000000',
    card: '#E0E0E0',
    cardForeground: '#000000',
    popover: '#F0F0F0',
    popoverForeground: '#000000',
    primary: '#FF0000',
    primaryForeground: '#FFFFFF',
    secondary: '#B0B0B0',
    secondaryForeground: '#000000',
    muted: '#D0D0D0',
    mutedForeground: '#222222',
    accent: '#FFD700',
    accentForeground: '#000000',
    destructive: '#A00000',
    destructiveForeground: '#FFFFFF',
    border: '#000000',
    input: '#E0E0E0',
    ring: '#FF0000',
    // Transport mode colors
    modes: {
      walk: '#000000',
      bus: '#0B2C6F',
      busway: '#0F7A0F',
      tram: '#D6452F',
      train: '#D10000',
      taxi: '#C58F00',
    },
  },
  dark: {
    background: '#000000',
    foreground: '#FFFFFF',
    card: '#111111',
    cardForeground: '#FFFFFF',
    popover: '#050505',
    popoverForeground: '#FFFFFF',
    primary: '#FF0000',
    primaryForeground: '#FFFFFF',
    secondary: '#222222',
    secondaryForeground: '#FFFFFF',
    muted: '#1A1A1A',
    mutedForeground: '#CCCCCC',
    accent: '#FFD700',
    accentForeground: '#000000',
    destructive: '#FF4444',
    destructiveForeground: '#000000',
    border: '#FFFFFF',
    input: '#111111',
    ring: '#FF0000',
    // Transport mode colors (same in dark mode)
    modes: {
      walk: '#FFFFFF',
      bus: '#4A7BFF',
      busway: '#50DC64',
      tram: '#FF6B5B',
      train: '#FF4444',
      taxi: '#FFD700',
    },
  },
} as const;

// Spacing system - based on 4px grid
export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
  28: 112,
  32: 128,
} as const;

// Border widths - thick, brutalist borders
export const borderWidths = {
  none: 0,
  thin: 1,
  base: 2,
  thick: 3,
  heavy: 4,
  brutal: 5,
} as const;

// Border radius - sharp edges for brutalist look (0px)
export const borderRadius = {
  none: 0,
  sm: 0,
  base: 0,
  md: 0,
  lg: 0,
  xl: 0,
  full: 9999,
} as const;

// Shadow system - offset shadows for brutalist depth
export const shadows = {
  light: {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    xs: {
      shadowColor: '#000000',
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 0.5,
      shadowRadius: 0,
      elevation: 1,
    },
    sm: {
      shadowColor: '#000000',
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 2,
    },
    md: {
      shadowColor: '#000000',
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000000',
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 6,
    },
    xl: {
      shadowColor: '#000000',
      shadowOffset: { width: 5, height: 5 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 8,
    },
  },
  dark: {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    xs: {
      shadowColor: '#FFFFFF',
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 0.5,
      shadowRadius: 0,
      elevation: 1,
    },
    sm: {
      shadowColor: '#FFFFFF',
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 2,
    },
    md: {
      shadowColor: '#FFFFFF',
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 4,
    },
    lg: {
      shadowColor: '#FFFFFF',
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 6,
    },
    xl: {
      shadowColor: '#FFFFFF',
      shadowOffset: { width: 5, height: 5 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 8,
    },
  },
} as const;

// Animation timings - fast, linear transitions (no soft easing)
export const animation = {
  duration: {
    instant: 0,
    fast: 120,
    normal: 160,
    slow: 300,
  },
  easing: {
    linear: 'linear',
    step: 'steps(3)',
  },
} as const;

// Touch targets - minimum 44x44 for accessibility
export const touchTargets = {
  minimum: 44,
  comfortable: 48,
  large: 56,
} as const;

// Z-index layers
export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modalBackdrop: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
  toast: 80,
} as const;

// Screen breakpoints (for responsive design)
export const breakpoints = {
  sm: 360,
  md: 768,
  lg: 1024,
} as const;

export type ColorScheme = 'light' | 'dark';
export type ThemeColors = (typeof colors)[ColorScheme];
export type ThemeShadows = (typeof shadows)[ColorScheme];

// Theme type definition
export interface Theme {
  colors: ThemeColors;
  shadows: ThemeShadows;
  typography: typeof typography;
  spacing: typeof spacing;
  borderWidths: typeof borderWidths;
  borderRadius: typeof borderRadius;
  animation: typeof animation;
  touchTargets: typeof touchTargets;
  zIndex: typeof zIndex;
  breakpoints: typeof breakpoints;
}

// Create theme function
export function createTheme(scheme: ColorScheme): Theme {
  return {
    colors: colors[scheme],
    shadows: shadows[scheme],
    typography,
    spacing,
    borderWidths,
    borderRadius,
    animation,
    touchTargets,
    zIndex,
    breakpoints,
  };
}

// Default themes
export const lightTheme = createTheme('light');
export const darkTheme = createTheme('dark');
