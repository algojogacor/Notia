import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { isGroqConfigured } from '@/src/services/groq';

export default function CameraScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const [groqReady, setGroqReady] = useState(false);

  useEffect(() => {
    setGroqReady(isGroqConfigured());
  }, []);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}>
      {/* Viewfinder Mockup */}
      <View
        style={[
          styles.viewfinderContainer,
          { backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#1E1B4B' },
        ]}>
        <View style={styles.viewfinderBorder}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />

          <Ionicons name="scan-outline" size={48} color="#818CF8" />
          <Text style={styles.viewfinderText}>
            Arahkan kamera ke catatan kuliah, papan tulis, atau slide
          </Text>

          <View style={styles.shutterContainer}>
            <TouchableOpacity
              style={styles.shutterButton}
              activeOpacity={0.7}
              onPress={() => {
                alert(
                  'Phase 1: Placeholder Camera Screen.\n\nKamera aktif (expo-camera) dan integrasi Groq Vision akan diaktifkan di Phase 2!'
                );
              }}>
              <View style={styles.shutterInner} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Groq API Status Badge */}
      <View
        style={[
          styles.statusCard,
          {
            backgroundColor: theme.card,
            borderColor: groqReady ? '#10B981' : '#F59E0B',
          },
        ]}>
        <View style={styles.statusRow}>
          <Ionicons
            name={groqReady ? 'checkmark-circle' : 'alert-circle'}
            size={24}
            color={groqReady ? '#10B981' : '#F59E0B'}
          />
          <View style={styles.statusTextContainer}>
            <Text style={[styles.statusTitle, { color: theme.text }]}>
              Groq Vision API Client
            </Text>
            <Text style={[styles.statusSubtitle, { color: theme.subtext }]}>
              {groqReady
                ? 'API Key terdeteksi dan siap digunakan untuk analisis multimodal (llama-3.2).'
                : 'Belum ada API Key. Set EXPO_PUBLIC_GROQ_API_KEY di file .env untuk mengaktifkan AI Vision di Phase 2.'}
            </Text>
          </View>
        </View>
      </View>

      {/* Pipeline Preview */}
      <View style={styles.pipelineCard}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Alur Kerja AI Vision (Phase 2 Roadmap)
        </Text>

        <View style={styles.stepItem}>
          <View style={[styles.stepNumber, { backgroundColor: theme.tint }]}>
            <Text style={styles.stepNumberText}>1</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: theme.text }]}>
              Ambil Foto / Upload Galeri
            </Text>
            <Text style={[styles.stepDesc, { color: theme.subtext }]}>
              Foto catatan tangan, slide proyektor, atau papan tulis ruang kuliah.
            </Text>
          </View>
        </View>

        <View style={styles.stepItem}>
          <View style={[styles.stepNumber, { backgroundColor: '#8B5CF6' }]}>
            <Text style={styles.stepNumberText}>2</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: theme.text }]}>
              Groq Multimodal Vision OCR
            </Text>
            <Text style={[styles.stepDesc, { color: theme.subtext }]}>
              Ekstraksi teks cerdas dengan prompt kurikulum universitas Indonesia.
            </Text>
          </View>
        </View>

        <View style={styles.stepItem}>
          <View style={[styles.stepNumber, { backgroundColor: '#10B981' }]}>
            <Text style={styles.stepNumberText}>3</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: theme.text }]}>
              Auto-Kategorisasi & Simpan SQLite
            </Text>
            <Text style={[styles.stepDesc, { color: theme.subtext }]}>
              Mata kuliah terdeteksi otomatis, tersimpan local-first di perangkat.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  viewfinderContainer: {
    height: 280,
    borderRadius: 20,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewfinderBorder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    padding: 16,
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#818CF8',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  viewfinderText: {
    color: '#E0E7FF',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 240,
  },
  shutterContainer: {
    position: 'absolute',
    bottom: 12,
  },
  shutterButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  statusCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 12,
    lineHeight: 18,
  },
  pipelineCard: {
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
});
