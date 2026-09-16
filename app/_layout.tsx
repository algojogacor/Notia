import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SQLiteProvider } from 'expo-sqlite';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { migrateDbIfNeeded } from '../src/db/database';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

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
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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
            title: 'Tentang Notia',
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
