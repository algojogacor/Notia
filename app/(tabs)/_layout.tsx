import React from 'react';
import { Tabs, Link } from 'expo-router';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.tint,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: theme.card,
        },
        headerTitleStyle: {
          fontWeight: '700',
          color: theme.text,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Catatan',
          tabBarLabel: 'Beranda',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'book' : 'book-outline'}
              size={24}
              color={color}
            />
          ),
          headerRight: () => (
            <Link href="/modal" asChild>
              <Pressable style={{ marginRight: 16 }}>
                {({ pressed }) => (
                  <Ionicons
                    name="settings-outline"
                    size={24}
                    color={theme.tint}
                    style={{ opacity: pressed ? 0.5 : 1 }}
                  />
                )}
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          title: 'Capture Catatan',
          tabBarLabel: 'Kamera',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'camera' : 'camera-outline'}
              size={26}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Cari Catatan',
          tabBarLabel: 'Cari',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'search' : 'search-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
