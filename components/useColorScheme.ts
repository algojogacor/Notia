import { useState, useEffect } from 'react';
import { useColorScheme as useColorSchemeCore } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'notia_theme';

// In-memory cache & listeners for instant reactive updates across all components
let currentPreference: ThemePreference = 'system';
const listeners = new Set<(pref: ThemePreference) => void>();

// Read initial value once from storage
AsyncStorage.getItem(THEME_STORAGE_KEY)
  .then((val) => {
    if (val === 'light' || val === 'dark' || val === 'system') {
      currentPreference = val;
      listeners.forEach((l) => l(val));
    }
  })
  .catch(() => {});

export async function setThemePreference(newPref: ThemePreference) {
  currentPreference = newPref;
  try {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, newPref);
  } catch (err) {
    console.warn('Failed to persist notia_theme:', err);
  }
  listeners.forEach((l) => l(newPref));
}

export function useThemePreference() {
  const [preference, setPreference] = useState<ThemePreference>(currentPreference);

  useEffect(() => {
    const listener = (newPref: ThemePreference) => setPreference(newPref);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    themePreference: preference,
    setThemePreference,
  };
}

export const useColorScheme = (): 'light' | 'dark' => {
  const coreScheme = useColorSchemeCore();
  const { themePreference } = useThemePreference();

  if (themePreference === 'light') return 'light';
  if (themePreference === 'dark') return 'dark';
  return coreScheme === 'dark' ? 'dark' : 'light';
};
