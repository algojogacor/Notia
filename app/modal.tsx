import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { useColorScheme, useThemePreference, ThemePreference } from '@/components/useColorScheme';
import { useSQLiteContext } from 'expo-sqlite';
import OnboardingModal from '@/components/OnboardingModal';
import { shareNotiaApp } from '@/src/services/analytics';
import { getTrashCount } from '@/src/db/database';
import {
  getGroqApiKeys,
  saveGroqApiKeys,
  DEFAULT_VISION_MODEL,
  pingGroqApi,
} from '@/src/services/groq';
import { exportFullBackup, importFullBackup } from '@/src/services/backup';

export default function ModalScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { themePreference, setThemePreference } = useThemePreference();
  const db = useSQLiteContext();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [keysInput, setKeysInput] = useState('');
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [trashCount, setTrashCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{
    success: boolean;
    latencyMs: number;
    error?: string;
  } | null>(null);

  const handlePingAi = async () => {
    setIsPinging(true);
    setPingResult(null);
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    try {
      const res = await pingGroqApi();
      setPingResult(res);
      if (Platform.OS !== 'web') {
        try {
          if (res.success) {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
        } catch {}
      }
    } catch {
      setPingResult({ success: false, latencyMs: 0 });
    } finally {
      setIsPinging(false);
    }
  };

  useEffect(() => {
    async function loadData() {
      const keys = await getGroqApiKeys();
      setActiveKeys(keys);
      if (keys.length > 0) {
        setKeysInput(keys.join('\n'));
      }
      try {
        const count = await getTrashCount(db);
        setTrashCount(count);
      } catch (err) {
        console.warn('Failed to load trash count:', err);
      }
    }
    loadData();
  }, [db]);

  const handleSaveKeys = async () => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }
    const updated = await saveGroqApiKeys(keysInput);
    setActiveKeys(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
    Alert.alert(
      'Kunci API Disimpan',
      `Berhasil menyimpan ${updated.length} kunci Groq. Rotasi otomatis aktif saat limit tercapai.`
    );
  };

  const handleOpenOnboarding = async () => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    setShowOnboarding(true);
  };

  const handleShareApp = async () => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }
    await shareNotiaApp();
  };

  const handleExportBackup = async () => {
    try {
      setIsExporting(true);
      if (Platform.OS !== 'web') {
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {}
      }

      const result = await exportFullBackup(db);
      if (Platform.OS !== 'web') {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }

      Alert.alert(
        'Cadangan Berhasil Dibuat! 📦',
        `Berhasil mengemas ${result.notesCount} catatan dan ${result.subjectsCount} mata kuliah beserta foto asli ke file .notia.\n\nSimpan file ini di Google Drive, kirim ke WhatsApp, atau pindahkan ke HP baru.`
      );
    } catch (err: any) {
      console.error('Export error:', err);
      Alert.alert('Gagal Ekspor', err.message || 'Terjadi kesalahan saat mengekspor cadangan.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async () => {
    try {
      setIsImporting(true);
      if (Platform.OS !== 'web') {
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {}
      }

      const result = await importFullBackup(db);
      if (!result) {
        return; // user cancelled file picking
      }

      if (Platform.OS !== 'web') {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }

      Alert.alert(
        'Pemulihan Berhasil! 🎉',
        `Berhasil memulihkan ${result.restoredNotes} catatan dan ${result.restoredSubjects} mata kuliah beserta seluruh file foto.\n\nSemua materi kuliah Anda kini sudah aman di perangkat ini.`
      );
    } catch (err: any) {
      console.error('Import error:', err);
      Alert.alert('Gagal Impor', err.message || 'Gagal memulihkan cadangan Notia.');
    } finally {
      setIsImporting(false);
    }
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

      {/* Button to Share App */}
      <TouchableOpacity
        style={[styles.shareBtn, { backgroundColor: '#10B981' }]}
        activeOpacity={0.8}
        onPress={handleShareApp}>
        <Ionicons name="share-social" size={20} color="#FFFFFF" />
        <Text style={styles.shareBtnText}>Bagikan Notia ke Teman Sekelas</Text>
      </TouchableOpacity>

      {/* Button to Replay Onboarding */}
      <TouchableOpacity
        style={[styles.onboardingBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
        activeOpacity={0.8}
        onPress={handleOpenOnboarding}>
        <Ionicons name="help-circle-outline" size={20} color={theme.tint} />
        <Text style={[styles.onboardingBtnText, { color: theme.tint }]}>Lihat Panduan Onboarding</Text>
      </TouchableOpacity>

      {/* Keranjang Lembar (Trash) Navigation with Item Badge */}
      <TouchableOpacity
        style={[
          styles.trashNavBtn,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
        activeOpacity={0.8}
        onPress={() => {
          if (Platform.OS !== 'web') {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch {}
          }
          router.push('/trash');
        }}>
        <View style={styles.trashNavLeft}>
          <View
            style={[
              styles.trashIconCircle,
              { backgroundColor: colorScheme === 'dark' ? '#3d2520' : '#f9ebe6' },
            ]}>
            <Ionicons
              name="trash-outline"
              size={18}
              color={colorScheme === 'dark' ? '#d97b62' : '#b5472f'}
            />
          </View>
          <View style={styles.trashNavTextCol}>
            <Text style={[styles.trashNavTitle, { color: theme.text }]}>
              Keranjang Lembar
            </Text>
            <Text style={[styles.trashNavSub, { color: theme.subtext }]}>
              Catatan yang dilepas dari binder
            </Text>
          </View>
        </View>

        <View style={styles.trashNavRight}>
          <View
            style={[
              styles.trashBadge,
              {
                backgroundColor:
                  trashCount > 0
                    ? colorScheme === 'dark'
                      ? '#3d2520'
                      : '#f9ebe6'
                    : colorScheme === 'dark'
                      ? '#252019'
                      : '#f1eadd',
              },
            ]}>
            <Text
              style={[
                styles.trashBadgeText,
                {
                  color:
                    trashCount > 0
                      ? colorScheme === 'dark'
                        ? '#d97b62'
                        : '#b5472f'
                      : theme.subtext,
                },
              ]}>
              {trashCount} lembar
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.subtext} />
        </View>
      </TouchableOpacity>

      {/* Groq API Key Configuration Card with Multi-Key */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            🔑 Kunci Groq OCR (Multi-Key)
          </Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  activeKeys.length > 0 ? '#DCFCE7' : '#FEF3C7',
              },
            ]}>
            <Text
              style={[
                styles.statusBadgeText,
                { color: activeKeys.length > 0 ? '#166534' : '#92400E' },
              ]}>
              {activeKeys.length > 0
                ? `${activeKeys.length} Kunci Aktif`
                : 'Belum Diisi'}
            </Text>
          </View>
        </View>

        <Text style={[styles.cardDesc, { color: theme.subtext, marginBottom: 8 }]}>
          Model OCR: <Text style={{ fontWeight: '700', color: theme.text }}>{DEFAULT_VISION_MODEL}</Text>
        </Text>
        <Text style={[styles.cardDesc, { color: theme.subtext, fontSize: 12, marginBottom: 12 }]}>
          Mendukung banyak kunci sekaligus. Pisahkan dengan koma atau baris baru. Notia akan memutar (rotate) kunci secara otomatis saat rate-limit tercapai.
        </Text>

        <TextInput
          style={[
            styles.keyInput,
            {
              backgroundColor: theme.background,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
          placeholder="gsk_key1, gsk_key2..."
          placeholderTextColor={theme.subtext}
          value={keysInput}
          onChangeText={setKeysInput}
          multiline
          numberOfLines={3}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={[styles.saveKeyBtn, { backgroundColor: theme.tint }]}
          activeOpacity={0.8}
          onPress={handleSaveKeys}>
          <Ionicons
            name={isSaved ? 'checkmark-circle' : 'save-outline'}
            size={18}
            color="#FFFFFF"
          />
          <Text style={styles.saveKeyBtnText}>
            {isSaved ? 'Tersimpan!' : 'Simpan Kunci API'}
          </Text>
        </TouchableOpacity>

        {/* AI Ping Test with Latency Timing */}
        <View style={styles.pingRow}>
          <TouchableOpacity
            style={[
              styles.pingBtn,
              { backgroundColor: theme.background, borderColor: theme.border },
            ]}
            activeOpacity={0.8}
            disabled={isPinging}
            onPress={handlePingAi}>
            {isPinging ? (
              <ActivityIndicator size="small" color={theme.tint} />
            ) : (
              <Ionicons name="flash-outline" size={16} color={theme.tint} />
            )}
            <Text style={[styles.pingBtnText, { color: theme.tint }]}>
              {isPinging ? 'Menguji Koneksi...' : 'Uji Koneksi AI'}
            </Text>
          </TouchableOpacity>

          {pingResult && (
            <View
              style={[
                styles.pingBadge,
                {
                  backgroundColor: pingResult.success
                    ? colorScheme === 'dark'
                      ? '#14532d'
                      : '#DCFCE7'
                    : colorScheme === 'dark'
                      ? '#7f1d1d'
                      : '#FEE2E2',
                  borderColor: pingResult.success ? '#16a34a' : '#ef4444',
                },
              ]}>
              <Ionicons
                name={pingResult.success ? 'checkmark-circle' : 'alert-circle'}
                size={14}
                color={pingResult.success ? '#166534' : '#991B1B'}
              />
              <Text
                style={[
                  styles.pingBadgeText,
                  {
                    color: pingResult.success
                      ? colorScheme === 'dark'
                        ? '#86efac'
                        : '#166534'
                      : colorScheme === 'dark'
                        ? '#fca5a5'
                        : '#991B1B',
                  },
                ]}>
                {pingResult.success
                  ? `Terhubung — ${pingResult.latencyMs} ms`
                  : 'Gagal — periksa kunci API'}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Segmented Theme Control */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          🎨 Tema Tampilan
        </Text>
        <Text style={[styles.cardDesc, { color: theme.subtext, marginBottom: 12 }]}>
          Pilih tema Living Notebook yang paling nyaman untuk mata saat membaca catatan kuliah.
        </Text>

        <View style={styles.themeSegmentRow}>
          {[
            { key: 'light', label: 'Terang', icon: 'sunny-outline' },
            { key: 'dark', label: 'Gelap', icon: 'moon-outline' },
            { key: 'system', label: 'Sistem', icon: 'phone-portrait-outline' },
          ].map((item) => {
            const isActive = themePreference === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.themeSegmentBtn,
                  isActive
                    ? { backgroundColor: theme.tint, borderColor: theme.tint }
                    : { backgroundColor: 'transparent', borderColor: theme.border },
                ]}
                activeOpacity={0.8}
                onPress={async () => {
                  if (Platform.OS !== 'web') {
                    try {
                      Haptics.selectionAsync();
                    } catch {}
                  }
                  await setThemePreference(item.key as ThemePreference);
                }}>
                <Ionicons
                  name={item.icon as any}
                  size={16}
                  color={isActive ? '#FFFFFF' : theme.text}
                />
                <Text
                  style={[
                    styles.themeSegmentText,
                    { color: isActive ? '#FFFFFF' : theme.text },
                  ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Backup and Restore Card */}
      <View
        style={[
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            💾 Cadangan & Pindah HP (Backup & Restore)
          </Text>
        </View>

        <Text style={[styles.cardDesc, { color: theme.subtext, marginBottom: 12 }]}>
          Ekspor seluruh mata kuliah, catatan, transkripsi OCR, dan foto asli ke dalam satu file arsip portable (.notia). Saat ganti HP, cukup impor file tersebut untuk memulihkan semuanya 100% tanpa internet.
        </Text>

        <View style={styles.backupActionsCol}>
          <TouchableOpacity
            style={[styles.backupBtn, { backgroundColor: theme.tint }]}
            onPress={handleExportBackup}
            disabled={isExporting || isImporting}
            activeOpacity={0.8}>
            <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
            <Text style={styles.backupBtnText}>
              {isExporting ? 'Mengemas Cadangan...' : 'Ekspor Cadangan (.notia)'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.importBtn, { borderColor: theme.border, backgroundColor: theme.background }]}
            onPress={handleImportBackup}
            disabled={isExporting || isImporting}
            activeOpacity={0.8}>
            <Ionicons name="cloud-download-outline" size={18} color={theme.text} />
            <Text style={[styles.importBtnText, { color: theme.text }]}>
              {isImporting ? 'Memulihkan Data...' : 'Impor / Pulihkan Cadangan'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          🔒 Privasi 100% Local-First
        </Text>
        <Text style={[styles.cardDesc, { color: theme.subtext }]}>
          Notia tidak memiliki server pelacak pihak ketiga. Seluruh foto catatan dan
          hasil teks kuliah tersimpan aman di penyimpanan internal smartphone kamu.
        </Text>
      </View>

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
          • AI Vision: Groq Multimodal API (qwen/qwen3.8-27b vision){'\n'}
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
          • Phase 4: Polish & QA (✅ Selesai){'\n'}
          • Phase 5: Launch Prep (✅ Selesai){'\n'}
          • Phase 6: Live & Feedback (🚀 Siap Distribusi)
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
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 14,
    marginBottom: 10,
    width: '100%',
    justifyContent: 'center',
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  onboardingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 18,
    width: '100%',
    justifyContent: 'center',
  },
  onboardingBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
  trashNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  trashNavLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  trashIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trashNavTextCol: {
    flex: 1,
  },
  trashNavTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  trashNavSub: {
    fontSize: 12,
  },
  trashNavRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trashBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  trashBadgeText: {
    fontSize: 11,
    fontWeight: '600',
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
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  keyInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 12,
    textAlignVertical: 'top',
  },
  saveKeyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveKeyBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 20,
  },
  backupActionsCol: {
    gap: 10,
    marginTop: 4,
  },
  backupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
  },
  backupBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
  },
  importBtnText: {
    fontWeight: '600',
    fontSize: 14,
  },
  pingRow: {
    marginTop: 10,
    gap: 8,
  },
  pingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pingBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pingBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  themeSegmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  themeSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  themeSegmentText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
});
