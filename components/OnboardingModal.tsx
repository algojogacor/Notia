import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

const { width } = Dimensions.get('window');

interface OnboardingSlide {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  badge: string;
  title: string;
  description: string;
}

const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    icon: 'camera',
    iconColor: '#4F46E5',
    badge: '1. CAPTURE CEPAT',
    title: 'Jepret Catatan Kuliah',
    description:
      'Foto catatan tulisan tangan di binder, whiteboard ruang kelas, atau slide materi proyektor dosen langsung dari kamera atau galeri.',
  },
  {
    icon: 'sparkles',
    iconColor: '#8B5CF6',
    badge: '2. GROQ AI VISION',
    title: 'Auto-Baca & Kategorisasi',
    description:
      'AI multimodal mengekstrak teks materi secara cerdas dan otomatis mengelompokkannya ke mata kuliah yang sesuai (Matematika, Alpro, Basis Data).',
  },
  {
    icon: 'flash',
    iconColor: '#10B981',
    badge: '3. ZERO-FRICTION',
    title: 'Siap Hadapi UTS & UAS',
    description:
      'Tidak ada lagi foto catatan tercecer di galeri! Cari rumus, kata kunci, atau materi kuliah secara instan dan 100% offline di SQLite.',
  },
];

interface OnboardingModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function OnboardingModal({
  visible,
  onClose,
}: OnboardingModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = async () => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }

    if (currentIndex < ONBOARDING_SLIDES.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }
    setCurrentIndex(0);
    onClose();
  };

  const slide = ONBOARDING_SLIDES[currentIndex];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleFinish}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}>
          {/* Header Badge */}
          <View
            style={[styles.badge, { backgroundColor: `${slide.iconColor}20` }]}>
            <Text style={[styles.badgeText, { color: slide.iconColor }]}>
              {slide.badge}
            </Text>
          </View>

          {/* Center Illustration Icon */}
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: `${slide.iconColor}15` },
            ]}>
            <Ionicons name={slide.icon} size={48} color={slide.iconColor} />
          </View>

          {/* Title & Description */}
          <Text style={[styles.title, { color: theme.text }]}>
            {slide.title}
          </Text>
          <Text style={[styles.description, { color: theme.subtext }]}>
            {slide.description}
          </Text>

          {/* Dots Indicator */}
          <View style={styles.dotsRow}>
            {ONBOARDING_SLIDES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i === currentIndex ? theme.tint : theme.border,
                    width: i === currentIndex ? 24 : 8,
                  },
                ]}
              />
            ))}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            {currentIndex < ONBOARDING_SLIDES.length - 1 ? (
              <>
                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={handleFinish}>
                  <Text style={[styles.skipText, { color: theme.subtext }]}>
                    Lewati
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: theme.tint }]}
                  onPress={handleNext}>
                  <Text style={styles.primaryButtonText}>Lanjut</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[
                  styles.primaryButtonFull,
                  { backgroundColor: theme.tint },
                ]}
                onPress={handleFinish}>
                <Ionicons name="rocket-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Mulai Gunakan Notia</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 8,
    marginBottom: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    marginBottom: 24,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: 14,
  },
  primaryButtonFull: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
