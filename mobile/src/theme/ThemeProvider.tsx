import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useColorScheme, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme, lightTheme, darkTheme, ColorScheme, createTheme } from './index';

const THEME_STORAGE_KEY = 'casa-transit-theme';

interface ThemeContextValue {
  theme: Theme;
  colorScheme: ColorScheme;
  isDark: boolean;
  toggleTheme: () => void;
  setColorScheme: (scheme: ColorScheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(systemColorScheme ?? 'light');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved theme preference
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') {
          setColorSchemeState(saved);
        }
      } catch (error) {
        console.warn('Failed to load theme preference:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadTheme();
  }, []);

  // Listen to system theme changes
  useEffect(() => {
    const listener = Appearance.addChangeListener(({ colorScheme: newScheme }) => {
      // Only update if user hasn't explicitly set a preference
      AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
        if (!saved && newScheme) {
          setColorSchemeState(newScheme);
        }
      });
    });

    return () => listener.remove();
  }, []);

  const setColorScheme = useCallback(async (scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, scheme);
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const newScheme = colorScheme === 'light' ? 'dark' : 'light';
    setColorScheme(newScheme);
  }, [colorScheme, setColorScheme]);

  const theme = useMemo(() => createTheme(colorScheme), [colorScheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      colorScheme,
      isDark: colorScheme === 'dark',
      toggleTheme,
      setColorScheme,
    }),
    [theme, colorScheme, toggleTheme, setColorScheme]
  );

  if (!isLoaded) {
    return null;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Hook for getting specific theme values
export function useThemeColor<K extends keyof Theme['colors']>(
  colorKey: K
): Theme['colors'][K] {
  const { theme } = useTheme();
  return theme.colors[colorKey];
}

// Hook for getting shadow styles
export function useThemeShadow(
  shadowKey: keyof Theme['shadows']
): Theme['shadows'][keyof Theme['shadows']] {
  const { theme } = useTheme();
  return theme.shadows[shadowKey];
}

export { ThemeContext };
