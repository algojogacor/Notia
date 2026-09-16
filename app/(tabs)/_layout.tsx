import React from 'react';
import { Tabs, Link } from 'expo-router';
import { Pressable, View, Text, StyleSheet, Platform } from 'react-native';
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
          borderTopWidth: 0,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
          position: 'relative',
        },
        tabBarBackground: () => (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.card }]}>
            {/* Living Notebook stitch-line along the top edge */}
            <View
              style={{
                height: 1,
                width: '100%',
                borderTopWidth: 1,
                borderTopColor: theme.border,
                borderStyle: 'dashed',
              }}
            />
          </View>
        ),
        tabBarLabelStyle: {
          fontSize: 11.5,
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
              size={23}
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
          tabBarButton: ({ ref: _ref, ...props }) => (
            <Pressable
              {...props}
              style={({ pressed }) => [
                styles.shutterTabContainer,
                { transform: [{ scale: pressed ? 0.94 : 1 }] },
              ]}>
              <View
                style={[
                  styles.shutterRaisedButton,
                  {
                    backgroundColor: theme.tint,
                    borderColor: theme.background,
                  },
                ]}>
                <Ionicons name="camera" size={26} color="#FFFFFF" />
              </View>
              <Text
                style={[
                  styles.shutterLabel,
                  {
                    color: props.accessibilityState?.selected
                      ? theme.tint
                      : theme.tabIconDefault,
                  },
                ]}>
                Kamera
              </Text>
            </Pressable>
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
              size={23}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  shutterTabContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: -22,
  },
  shutterRaisedButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  shutterLabel: {
    fontSize: 11.5,
    fontWeight: '600',
  },
});
