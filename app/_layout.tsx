import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View, Image, StyleSheet, Platform } from 'react-native';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { migrateDbIfNeeded } from '../src/db/database';
import { startAiQueue, stopAiQueue } from '../src/services/aiQueue';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

// Subtle 7x7 dot tooth textures ported from glm53flash .paper-grain (opacity ~0.03)
const GRAIN_PNG_LIGHT =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAcAAAAHCAYAAADEUlfTAAAAFElEQVR4nGOQEhHgYKAtoIMVIAAAU5kAjSWCiz8AAAAASUVORK5CYII=';
const GRAIN_PNG_DARK =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAcAAAAHCAYAAADEUlfTAAAAFElEQVR4nGN4++wWJwNtAR2sAAEANmQFbWvlv20AAAAASUVORK5CYII=';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <SQLiteProvider databaseName="notia.db" onInit={migrateDbIfNeeded}>
      <RootLayoutNav />
    </SQLiteProvider>
  );
}

function RootLayoutNav() {
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();

  useEffect(() => {
    startAiQueue(db);
    return () => {
      stopAiQueue();
    };
  }, [db]);

  // Warm Living Notebook theme overrides for expo-router's navigation chrome
  const WarmLightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: '#faf7f2',
      card: '#fffcf6',
      text: '#1a1410',
      border: '#e7dece',
      primary: '#4c4689',
    },
  };

  const WarmDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: '#1c1814',
      card: '#252019',
      text: '#EDE6DA',
      border: '#372f24',
      primary: '#b2abe2',
    },
  };

  const grainUri = colorScheme === 'dark' ? GRAIN_PNG_DARK : GRAIN_PNG_LIGHT;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? WarmDarkTheme : WarmLightTheme}>
      <View style={grainStyles.root}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="note/[id]"
            options={{
              title: 'Detail Catatan',
              headerBackTitle: 'Kembali',
            }}
          />
          <Stack.Screen
            name="modal"
            options={{
              presentation: 'modal',
              title: 'Pengaturan & Cadangan',
            }}
          />
          <Stack.Screen
            name="trash"
            options={{
              title: 'Keranjang Catatan',
              headerBackTitle: 'Kembali',
            }}
          />
        </Stack>

        {/* Subtle paper grain overlay — repeating 7x7 dot texture with pointerEvents="none" */}
        <View pointerEvents="none" style={grainStyles.grainOverlay}>
          <Image
            source={{ uri: grainUri }}
            resizeMode="repeat"
            style={StyleSheet.absoluteFill}
          />
        </View>
      </View>
    </ThemeProvider>
  );
}

const grainStyles = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative' as const,
  },
  grainOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 9999,
  },
});
