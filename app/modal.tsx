import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import OnboardingModal from '@/components/OnboardingModal';

export default function ModalScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [showOnboarding, setShowOnboarding] = useState(false);

  const handleOpenOnboarding = async () => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    setShowOnboarding(true);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}>
      <View style={styles.iconCircle}>
        <Ionicons name="sparkles" size={36} color={theme.tint} />
      </View>

      <Text style={[styles.title, { color: theme.text }]}>Tentang Notia</Text>
      <Text style={[styles.tagline, { color: theme.subtext }]}>
        Organize foto catatan kuliah pakai AI vision untuk mahasiswa Indonesia.
      </Text>

      {/* Button to Replay Onboarding */}
      <TouchableOpacity
        style={[styles.onboardingBtn, { backgroundColor: theme.tint }]}
        activeOpacity={0.8}
        onPress={handleOpenOnboarding}>
        <Ionicons name="help-circle-outline" size={20} color="#FFFFFF" />
        <Text style={styles.onboardingBtnText}>Lihat Panduan Onboarding</Text>
      </TouchableOpacity>

      <View
        style={[
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          💡 Solusi Notia
        </Text>
        <Text style={[styles.cardDesc, { color: theme.subtext }]}>
          Membantu mahasiswa agar foto catatan kuliah di galeri tidak bercampur dan
          mudah dicari saat UTS & UAS.
        </Text>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          🛠️ Teknologi & Stack
        </Text>
        <Text style={[styles.cardDesc, { color: theme.subtext }]}>
          • Framework: Expo React Native (TypeScript){'\n'}
          • Storage: expo-sqlite (Local-first, Zero server requirement){'\n'}
          • AI Vision: Groq Multimodal API (llama-3.2 vision){'\n'}
          • Tactile: expo-haptics feedback{'\n'}
          • Platform: Android-first
        </Text>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          🚀 Status Sprint
        </Text>
        <Text style={[styles.cardDesc, { color: theme.subtext }]}>
          • Phase 1: Foundation (✅ Selesai){'\n'}
          • Phase 2: Capture & AI Vision (✅ Selesai){'\n'}
          • Phase 3: Browse & Search (✅ Selesai){'\n'}
          • Phase 4: Polish & QA (🔄 Sedang Berjalan){'\n'}
          • Phase 5: Launch Prep{'\n'}
          • Phase 6: Live & Feedback
        </Text>
      </View>

      <OnboardingModal
        visible={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />

      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    alignItems: 'center',
    padding: 24,
    paddingTop: 32,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  tagline: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  onboardingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 20,
    width: '100%',
    justifyContent: 'center',
  },
  onboardingBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  card: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 20,
  },
});
