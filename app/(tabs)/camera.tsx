import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import {
  analyzeLectureNote,
  isGroqConfigured,
} from '@/src/services/groq';
import {
  getSubjects,
  saveCapturedNote,
} from '@/src/db/database';
import { Subject, GroqVisionAnalysisResult, NoteWithSubject } from '@/src/types';

type FlowStep = 'CAPTURE' | 'PREVIEW' | 'PROCESSING' | 'REVIEW' | 'SUCCESS';

export default function CameraScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const db = useSQLiteContext();

  // State machine
  const [step, setStep] = useState<FlowStep>('CAPTURE');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  // AI & Editing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('Menghubungi Groq Vision...');
  const [aiResult, setAiResult] = useState<GroqVisionAnalysisResult | null>(null);
  const [editedText, setEditedText] = useState('');
  const [selectedSubjectName, setSelectedSubjectName] = useState('');
  const [customSubjectInput, setCustomSubjectInput] = useState('');
  const [showCustomSubject, setShowCustomSubject] = useState(false);
  const [existingSubjects, setExistingSubjects] = useState<Subject[]>([]);
  const [savedNote, setSavedNote] = useState<NoteWithSubject | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing subjects from SQLite for context-aware AI & subject selector
  const loadSubjects = useCallback(async () => {
    try {
      const subs = await getSubjects(db);
      setExistingSubjects(subs);
    } catch (err) {
      console.error('Error loading subjects:', err);
    }
  }, [db]);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  // 1. Capture from Camera
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Izin Kamera Ditolak',
          'Notia membutuhkan akses kamera untuk memfoto catatan kuliah. Harap aktifkan izin di pengaturan perangkat.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        if (Platform.OS !== 'web') {
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } catch {}
        }
        const asset = result.assets[0];
        setImageUri(asset.uri);
        setImageBase64(asset.base64 || null);
        setStep('PREVIEW');
      }
    } catch (err: any) {
      console.error('Error taking photo:', err);
      Alert.alert('Gagal Membuka Kamera', err.message || 'Terjadi kesalahan kamera.');
    }
  };

  // 2. Pick from Media Gallery
  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Izin Galeri Ditolak',
          'Notia membutuhkan akses galeri foto untuk memilih catatan kuliah.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        if (Platform.OS !== 'web') {
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } catch {}
        }
        const asset = result.assets[0];
        setImageUri(asset.uri);
        setImageBase64(asset.base64 || null);
        setStep('PREVIEW');
      }
    } catch (err: any) {
      console.error('Error picking photo:', err);
      Alert.alert('Gagal Membuka Galeri', err.message || 'Terjadi kesalahan.');
    }
  };

  // 3. Process with Groq Vision
  const handleProcessWithAI = async () => {
    if (!imageBase64) {
      Alert.alert('Foto Tidak Lengkap', 'Data base64 foto tidak tersedia. Silakan ambil foto ulang.');
      return;
    }

    if (!isGroqConfigured()) {
      Alert.alert(
        'Groq API Key Belum Disetel',
        'Untuk menggunakan AI Vision Notia, tambahkan EXPO_PUBLIC_GROQ_API_KEY di file .env.\n\nDapatkan API key gratis di https://console.groq.com/keys'
      );
      return;
    }

    setStep('PROCESSING');
    setIsProcessing(true);
    setProcessingStatus('Mengunggah foto ke Groq Vision...');

    const timer1 = setTimeout(() => {
      setProcessingStatus('AI membaca tulisan catatan kuliah...');
    }, 1500);

    const timer2 = setTimeout(() => {
      setProcessingStatus('Mendeteksi mata kuliah & merangkum materi...');
    }, 3500);

    try {
      const subjectNames = existingSubjects.map((s) => s.name);
      const result = await analyzeLectureNote({
        imageBase64,
        existingSubjects: subjectNames,
      });

      clearTimeout(timer1);
      clearTimeout(timer2);

      if (Platform.OS !== 'web') {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }

      setAiResult(result);
      setEditedText(result.extracted_text);
      setSelectedSubjectName(result.suggested_subject || 'Umum');
      setStep('REVIEW');
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      console.error('Groq Vision Error:', err);
      Alert.alert(
        'Gagal Menganalisis Foto',
        err.message || 'Terjadi kesalahan saat memproses foto dengan AI.',
        [
          { text: 'Ambil Ulang', onPress: () => handleResetFlow() },
          { text: 'Coba Lagi', onPress: () => handleProcessWithAI() },
        ]
      );
      setStep('PREVIEW');
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Save to SQLite
  const handleSaveNote = async () => {
    if (!imageUri) return;

    setIsSaving(true);
    try {
      const finalSubjectName = showCustomSubject && customSubjectInput.trim()
        ? customSubjectInput.trim()
        : selectedSubjectName;

      const created = await saveCapturedNote(db, {
        imageUri,
        subjectName: finalSubjectName,
        extractedText: editedText,
        dateTaken: new Date().toISOString().split('T')[0],
      });

      if (Platform.OS !== 'web') {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }

      setSavedNote(created);
      await loadSubjects(); // refresh subject list
      setStep('SUCCESS');
    } catch (err: any) {
      console.error('Error saving note:', err);
      Alert.alert('Gagal Menyimpan', err.message || 'Terjadi kesalahan saat menyimpan catatan.');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset Flow
  const handleResetFlow = () => {
    setStep('CAPTURE');
    setImageUri(null);
    setImageBase64(null);
    setAiResult(null);
    setEditedText('');
    setSelectedSubjectName('');
    setCustomSubjectInput('');
    setShowCustomSubject(false);
    setSavedNote(null);
  };

  // --------------------------------------------------------------------------
  // RENDER: STEP 1 - CAPTURE
  // --------------------------------------------------------------------------
  if (step === 'CAPTURE') {
    const groqReady = isGroqConfigured();

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

            <Ionicons name="scan-outline" size={56} color="#818CF8" />
            <Text style={styles.viewfinderTitle}>Capture Catatan Kuliah</Text>
            <Text style={styles.viewfinderText}>
              Arahkan ke tulisan tangan binder, whiteboard kelas, atau slide proyektor
            </Text>
          </View>
        </View>

        {/* Capture Action Triggers */}
        <View style={styles.captureActions}>
          <TouchableOpacity
            style={[styles.primaryCaptureBtn, { backgroundColor: theme.tint }]}
            activeOpacity={0.8}
            onPress={handleTakePhoto}>
            <Ionicons name="camera" size={24} color="#FFFFFF" />
            <Text style={styles.primaryCaptureBtnText}>Ambil Foto (Kamera)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryCaptureBtn,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
            activeOpacity={0.8}
            onPress={handlePickFromGallery}>
            <Ionicons name="images" size={22} color={theme.tint} />
            <Text style={[styles.secondaryCaptureBtnText, { color: theme.text }]}>
              Pilih dari Galeri
            </Text>
          </TouchableOpacity>
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
              size={22}
              color={groqReady ? '#10B981' : '#F59E0B'}
            />
            <View style={styles.statusTextContainer}>
              <Text style={[styles.statusTitle, { color: theme.text }]}>
                {groqReady ? 'Groq Vision API Aktif' : 'Groq API Key Belum Ada'}
              </Text>
              <Text style={[styles.statusSubtitle, { color: theme.subtext }]}>
                {groqReady
                  ? 'Model llama-3.2 multimodal siap membaca dan mengekstrak catatanmu.'
                  : 'Tambahkan EXPO_PUBLIC_GROQ_API_KEY di .env untuk mengaktifkan AI Vision.'}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Tips */}
        <View style={styles.tipsCard}>
          <Text style={[styles.tipsTitle, { color: theme.text }]}>
            💡 Tips Foto Catatan Berkualitas:
          </Text>
          <Text style={[styles.tipsItem, { color: theme.subtext }]}>
            • Pastikan pencahayaan cukup dan hindari bayangan tangan.
          </Text>
          <Text style={[styles.tipsItem, { color: theme.subtext }]}>
            • Foto tegak lurus sejajar dengan lembar kertas atau whiteboard.
          </Text>
          <Text style={[styles.tipsItem, { color: theme.subtext }]}>
            • Tulisan tangan tidak rapi atau singkatan ("yg", "dgn") tetap bisa dibaca oleh AI.
          </Text>
        </View>
      </ScrollView>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER: STEP 2 - PREVIEW & CONFIRM
  // --------------------------------------------------------------------------
  if (step === 'PREVIEW' && imageUri) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.contentContainer}>
        <View style={styles.previewHeader}>
          <Text style={[styles.screenHeading, { color: theme.text }]}>
            Tinjau Foto Catatan
          </Text>
          <Text style={[styles.screenSubheading, { color: theme.subtext }]}>
            Pastikan teks materi kuliah terlihat jelas sebelum dianalisis.
          </Text>
        </View>

        <View style={styles.previewImageContainer}>
          <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
        </View>

        <View style={styles.previewActions}>
          <TouchableOpacity
            style={[styles.previewRetakeBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
            onPress={handleResetFlow}>
            <Ionicons name="refresh-outline" size={18} color={theme.text} />
            <Text style={[styles.previewRetakeText, { color: theme.text }]}>Foto Ulang</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.previewProcessBtn, { backgroundColor: theme.tint }]}
            onPress={handleProcessWithAI}>
            <Ionicons name="sparkles" size={18} color="#FFFFFF" />
            <Text style={styles.previewProcessText}>Analisis dengan AI ✨</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER: STEP 3 - PROCESSING
  // --------------------------------------------------------------------------
  if (step === 'PROCESSING') {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.processingCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <ActivityIndicator size="large" color={theme.tint} style={{ marginBottom: 16 }} />
          <Text style={[styles.processingHeading, { color: theme.text }]}>
            Memproses Catatan Kuliah
          </Text>
          <Text style={[styles.processingStatus, { color: theme.tint }]}>
            {processingStatus}
          </Text>
          <Text style={[styles.processingDesc, { color: theme.subtext }]}>
            Groq Multimodal Vision sedang membaca isi tulisan, mengekstrak materi, dan mencocokkan ke mata kuliah.
          </Text>
        </View>
      </View>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER: STEP 4 - REVIEW & SAVE
  // --------------------------------------------------------------------------
  if (step === 'REVIEW' && aiResult) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.contentContainer}>
        <View style={styles.reviewHeader}>
          <Text style={[styles.screenHeading, { color: theme.text }]}>
            Hasil AI Vision
          </Text>
          <Text style={[styles.screenSubheading, { color: theme.subtext }]}>
            Periksa hasil ekstraksi dan mata kuliah sebelum disimpan ke SQLite.
          </Text>
        </View>

        {/* Thumbnail & Detection Summary */}
        <View
          style={[
            styles.detectionCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}>
          <View style={styles.detectionTopRow}>
            {imageUri && (
              <Image source={{ uri: imageUri }} style={styles.reviewThumbnail} />
            )}
            <View style={styles.detectionInfo}>
              <Text style={[styles.detectionLabel, { color: theme.subtext }]}>
                Mata Kuliah Terdeteksi:
              </Text>
              <View style={[styles.activeSubjectBadge, { backgroundColor: theme.tint }]}>
                <Ionicons name="school" size={14} color="#FFFFFF" />
                <Text style={styles.activeSubjectText}>
                  {showCustomSubject && customSubjectInput.trim()
                    ? customSubjectInput.trim()
                    : selectedSubjectName}
                </Text>
              </View>
              <Text style={[styles.confidenceText, { color: theme.subtext }]}>
                Akurasi AI: {Math.round(aiResult.confidence * 100)}%
              </Text>
            </View>
          </View>

          {/* AI Summary */}
          {aiResult.summary ? (
            <View style={styles.summaryContainer}>
              <Text style={[styles.summaryTitle, { color: theme.tint }]}>
                📌 Rangkuman AI:
              </Text>
              <Text style={[styles.summaryBody, { color: theme.text }]}>
                {aiResult.summary}
              </Text>
            </View>
          ) : null}

          {/* AI Keywords */}
          {aiResult.keywords && aiResult.keywords.length > 0 ? (
            <View style={styles.keywordsRow}>
              {aiResult.keywords.map((kw, i) => (
                <View key={i} style={styles.keywordPill}>
                  <Text style={styles.keywordText}>#{kw}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Subject Chooser */}
        <View style={styles.subjectChooserSection}>
          <Text style={[styles.sectionHeading, { color: theme.text }]}>
            Ganti Mata Kuliah (Opsional):
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subjectChipsScroll}>
            {existingSubjects.map((sub) => {
              const isSelected =
                !showCustomSubject && selectedSubjectName === sub.name;
              return (
                <TouchableOpacity
                  key={sub.id}
                  style={[
                    styles.subjectChip,
                    {
                      backgroundColor: isSelected ? sub.color : theme.card,
                      borderColor: isSelected ? sub.color : theme.border,
                    },
                  ]}
                  onPress={() => {
                    setSelectedSubjectName(sub.name);
                    setShowCustomSubject(false);
                  }}>
                  <Text
                    style={[
                      styles.subjectChipText,
                      { color: isSelected ? '#FFFFFF' : theme.text },
                    ]}>
                    {sub.name}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[
                styles.subjectChip,
                {
                  backgroundColor: showCustomSubject ? theme.tint : theme.card,
                  borderColor: showCustomSubject ? theme.tint : theme.border,
                },
              ]}
              onPress={() => setShowCustomSubject(!showCustomSubject)}>
              <Ionicons
                name="add-circle-outline"
                size={16}
                color={showCustomSubject ? '#FFFFFF' : theme.tint}
              />
              <Text
                style={[
                  styles.subjectChipText,
                  { color: showCustomSubject ? '#FFFFFF' : theme.text },
                ]}>
                Tambah Baru
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {showCustomSubject && (
            <View style={styles.customSubjectInputWrapper}>
              <TextInput
                style={[
                  styles.customSubjectInput,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                placeholder="Masukkan nama mata kuliah baru..."
                placeholderTextColor={theme.subtext}
                value={customSubjectInput}
                onChangeText={setCustomSubjectInput}
              />
            </View>
          )}
        </View>

        {/* Extracted Text (Editable) */}
        <View style={styles.textEditorSection}>
          <View style={styles.textEditorHeader}>
            <Text style={[styles.sectionHeading, { color: theme.text }]}>
              Teks Catatan (Dapat Diedit):
            </Text>
            <Ionicons name="create-outline" size={18} color={theme.subtext} />
          </View>
          <TextInput
            style={[
              styles.textEditorInput,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            multiline
            numberOfLines={8}
            value={editedText}
            onChangeText={setEditedText}
            placeholder="Teks hasil ekstraksi..."
            placeholderTextColor={theme.subtext}
            textAlignVertical="top"
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.reviewActions}>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: theme.tint }]}
            onPress={handleSaveNote}
            disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>Simpan ke Catatan Notia</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: theme.border }]}
            onPress={handleResetFlow}
            disabled={isSaving}>
            <Text style={[styles.cancelBtnText, { color: theme.subtext }]}>
              Batal
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER: STEP 5 - SUCCESS
  // --------------------------------------------------------------------------
  if (step === 'SUCCESS' && savedNote) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.contentContainer}>
        <View style={styles.successWrapper}>
          <View style={styles.successIconCircle}>
            <Ionicons name="checkmark-done" size={48} color="#10B981" />
          </View>

          <Text style={[styles.successTitle, { color: theme.text }]}>
            Catatan Berhasil Disimpan!
          </Text>
          <Text style={[styles.successSubtitle, { color: theme.subtext }]}>
            Foto catatan dan hasil transkripsi AI telah tersimpan di SQLite lokal.
          </Text>

          {/* Saved Note Card Preview */}
          <View
            style={[
              styles.savedCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}>
            <View style={styles.savedCardHeader}>
              <View
                style={[
                  styles.subjectBadge,
                  { backgroundColor: savedNote.subject_color || theme.tint },
                ]}>
                <Text style={styles.subjectBadgeText}>
                  {savedNote.subject_name || 'Umum'}
                </Text>
              </View>
              <Text style={[styles.savedDate, { color: theme.subtext }]}>
                {savedNote.date_taken}
              </Text>
            </View>
            <Text
              numberOfLines={3}
              style={[styles.savedExcerpt, { color: theme.text }]}>
              {savedNote.extracted_text || 'Tidak ada teks.'}
            </Text>
          </View>

          {/* Navigation Action Buttons */}
          <View style={styles.successActions}>
            <TouchableOpacity
              style={[styles.successPrimaryBtn, { backgroundColor: theme.tint }]}
              onPress={() => router.push(`/note/${savedNote.id}`)}>
              <Ionicons name="eye-outline" size={18} color="#FFFFFF" />
              <Text style={styles.successPrimaryBtnText}>
                Lihat Detail Catatan
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.successSecondaryBtn,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              onPress={handleResetFlow}>
              <Ionicons name="camera-outline" size={18} color={theme.text} />
              <Text style={[styles.successSecondaryBtnText, { color: theme.text }]}>
                Ambil Foto Catatan Lagi
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backHomeBtn}
              onPress={() => router.push('/')}>
              <Text style={[styles.backHomeText, { color: theme.subtext }]}>
                Kembali ke Beranda
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  viewfinderContainer: {
    height: 280,
    borderRadius: 20,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
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
    width: 28,
    height: 28,
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
  viewfinderTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 12,
  },
  viewfinderText: {
    color: '#C7D2FE',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 260,
    lineHeight: 18,
  },
  captureActions: {
    gap: 12,
    marginBottom: 20,
  },
  primaryCaptureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  primaryCaptureBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryCaptureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryCaptureBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  statusSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  tipsCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
  },
  tipsTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  tipsItem: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  previewHeader: {
    marginBottom: 16,
  },
  screenHeading: {
    fontSize: 20,
    fontWeight: '800',
  },
  screenSubheading: {
    fontSize: 13,
    marginTop: 4,
  },
  previewImageContainer: {
    height: 340,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000000',
    marginBottom: 20,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
  },
  previewRetakeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
  },
  previewRetakeText: {
    fontWeight: '600',
    fontSize: 14,
  },
  previewProcessBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
  },
  previewProcessText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  processingCard: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
  },
  processingHeading: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  processingStatus: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  processingDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  reviewHeader: {
    marginBottom: 16,
  },
  detectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 18,
  },
  detectionTopRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#000',
  },
  detectionInfo: {
    flex: 1,
  },
  detectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  activeSubjectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 4,
  },
  activeSubjectText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  confidenceText: {
    fontSize: 11,
  },
  summaryContainer: {
    backgroundColor: '#EEF2FF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryBody: {
    fontSize: 12,
    lineHeight: 18,
  },
  keywordsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  keywordPill: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  keywordText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  subjectChooserSection: {
    marginBottom: 18,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  subjectChipsScroll: {
    gap: 8,
    paddingBottom: 8,
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  subjectChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  customSubjectInputWrapper: {
    marginTop: 8,
  },
  customSubjectInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  textEditorSection: {
    marginBottom: 20,
  },
  textEditorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textEditorInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 13,
    lineHeight: 20,
    minHeight: 160,
  },
  reviewActions: {
    gap: 10,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 14,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  successWrapper: {
    alignItems: 'center',
    paddingTop: 24,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 280,
    lineHeight: 18,
  },
  savedCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  savedCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  subjectBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  subjectBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  savedDate: {
    fontSize: 12,
  },
  savedExcerpt: {
    fontSize: 13,
    lineHeight: 19,
  },
  successActions: {
    width: '100%',
    gap: 12,
  },
  successPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
  },
  successPrimaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  successSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
  },
  successSecondaryBtnText: {
    fontWeight: '600',
    fontSize: 14,
  },
  backHomeBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  backHomeText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
