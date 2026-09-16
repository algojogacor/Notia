import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import AddSubjectModal from '@/components/AddSubjectModal';
import { getSubjects, saveBatchCapturedNotes } from '@/src/db/database';
import { triggerQueueProcessing } from '@/src/services/aiQueue';
import { Subject } from '@/src/types';

const MAX_BATCH_SIZE = 12;

interface StagedPhoto {
  id: string;
  uri: string;
  dateTaken: string;
}

export default function CameraScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const db = useSQLiteContext();

  const [existingSubjects, setExistingSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);

  // Staged batch queue (max 12 per batch)
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([]);
  const [previewPhotoUri, setPreviewPhotoUri] = useState<string | null>(null);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  // Load existing subjects
  const loadSubjects = useCallback(async () => {
    try {
      const subs = await getSubjects(db);
      setExistingSubjects(subs);
      if (subs.length > 0 && !selectedSubjectId) {
        setSelectedSubjectId(subs[0].id);
      }
    } catch (err) {
      console.error('Error loading subjects:', err);
    }
  }, [db, selectedSubjectId]);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  /**
   * Helper to handle adding photos with auto-overflow when exceeding 12:
   * "Kalau user nambah foto ke-13, batch sebelumnya auto-tersimpan dan mulai batch baru"
   */
  const handleAddPhotosToStaging = async (newUris: string[]) => {
    if (newUris.length === 0) return;

    let current = [...stagedPhotos];
    const today = new Date().toISOString().split('T')[0];

    for (const uri of newUris) {
      if (current.length >= MAX_BATCH_SIZE) {
        // Auto-commit existing 12 items
        try {
          await saveBatchCapturedNotes(
            db,
            current.map((p) => ({
              imageUri: p.uri,
              subjectId: selectedSubjectId,
              dateTaken: p.dateTaken,
            }))
          );
          triggerQueueProcessing();

          Alert.alert(
            'Batch Tersimpan Otomatis',
            'Batch 12 foto sebelumnya telah disimpan dan dimasukkan ke antrean AI. Memulai batch baru.'
          );
        } catch (err) {
          console.error('Failed to auto-save overflow batch:', err);
        }

        // Start new batch with remaining photo
        current = [{ id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, uri, dateTaken: today }];
      } else {
        current.push({
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          uri,
          dateTaken: today,
        });
      }
    }

    setStagedPhotos(current);
  };

  // 1. Capture single photo with crop
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Izin Kamera Ditolak',
          'Notia membutuhkan akses kamera untuk mengambil foto catatan kuliah.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        if (Platform.OS !== 'web') {
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } catch {}
        }
        await handleAddPhotosToStaging([result.assets[0].uri]);
      }
    } catch (err: any) {
      console.error('Error taking photo:', err);
      Alert.alert('Gagal Membuka Kamera', err.message || 'Terjadi kesalahan saat memfoto.');
    }
  };

  // 2. Pick photo(s) from Gallery
  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Izin Galeri Ditolak',
          'Notia membutuhkan akses galeri untuk memilih foto catatan kuliah.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: MAX_BATCH_SIZE,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        if (Platform.OS !== 'web') {
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch {}
        }
        const uris = result.assets.map((a) => a.uri);
        await handleAddPhotosToStaging(uris);
      }
    } catch (err: any) {
      console.error('Error picking from gallery:', err);
      Alert.alert('Gagal Membuka Galeri', err.message || 'Terjadi kesalahan.');
    }
  };

  // Remove photo from staging
  const handleRemovePhoto = async (id: string) => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    setStagedPhotos((prev) => prev.filter((p) => p.id !== id));
    if (previewPhotoUri) setPreviewPhotoUri(null);
  };

  // Empty staging
  const handleClearStaging = () => {
    Alert.alert(
      'Kosongkan Tumpukan?',
      'Semua foto yang belum diproses akan dihapus dari tumpukan saat ini.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Kosongkan',
          style: 'destructive',
          onPress: () => {
            setStagedPhotos([]);
          },
        },
      ]
    );
  };

  // 3. Process All: Save to SQLite as pending + trigger background queue + jump to Home
  const handleProcessAll = async () => {
    if (stagedPhotos.length === 0) return;

    setIsProcessingBatch(true);
    try {
      await saveBatchCapturedNotes(
        db,
        stagedPhotos.map((p) => ({
          imageUri: p.uri,
          subjectId: selectedSubjectId,
          dateTaken: p.dateTaken,
        }))
      );

      // Trigger background worker
      triggerQueueProcessing();

      if (Platform.OS !== 'web') {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }

      setStagedPhotos([]);
      // Instantly return to Home feed, AI operates seamlessly in background
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('Error saving batch notes:', err);
      Alert.alert('Gagal Menyimpan', err.message || 'Terjadi kesalahan saat memproses batch.');
    } finally {
      setIsProcessingBatch(false);
    }
  };

  const selectedSubject = existingSubjects.find((s) => s.id === selectedSubjectId);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Header Title */}
        <View style={styles.header}>
          <Text style={[styles.screenTitle, { color: theme.text }]}>
            Kamera & Galeri Catatan
          </Text>
          <Text style={[styles.screenSubtitle, { color: theme.subtext }]}>
            Tumpuk foto binder, papan tulis, atau slide kuliah (maksimal 12 lembar per batch). AI akan menganalisis di latar belakang.
          </Text>
        </View>

        {/* Subject Binder Selector */}
        <View style={styles.sectionBlock}>
          <View style={styles.subjectHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Simpan ke Binder:
            </Text>
            <TouchableOpacity
              style={styles.addSubjectBtn}
              activeOpacity={0.7}
              onPress={() => setShowAddSubjectModal(true)}>
              <Ionicons name="add-circle" size={16} color={theme.tint} />
              <Text style={[styles.addSubjectBtnText, { color: theme.tint }]}>
                + Matkul
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subjectScrollContent}>
            {/* Option: Umum / Unassigned */}
            <TouchableOpacity
              style={[
                styles.subjectChip,
                {
                  backgroundColor: selectedSubjectId === null ? theme.tint : theme.card,
                  borderColor: selectedSubjectId === null ? theme.tint : theme.border,
                },
              ]}
              onPress={() => setSelectedSubjectId(null)}>
              <Text
                style={[
                  styles.subjectChipText,
                  { color: selectedSubjectId === null ? '#FFFFFF' : theme.text },
                ]}>
                Umum
              </Text>
            </TouchableOpacity>

            {existingSubjects.map((sub) => {
              const isSelected = selectedSubjectId === sub.id;
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
                  onPress={() => setSelectedSubjectId(sub.id)}>
                  <View
                    style={[
                      styles.colorDot,
                      { backgroundColor: isSelected ? '#FFFFFF' : sub.color },
                    ]}
                  />
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
          </ScrollView>
        </View>

        {/* Viewfinder Card */}
        <View
          style={[
            styles.viewfinderCard,
            {
              backgroundColor: colorScheme === 'dark' ? '#252019' : '#fffcf6',
              borderColor: theme.border,
            },
          ]}>
          <View style={styles.viewfinderFrame}>
            <View style={[styles.corner, styles.topLeft, { borderColor: theme.tint }]} />
            <View style={[styles.corner, styles.topRight, { borderColor: theme.tint }]} />
            <View style={[styles.corner, styles.bottomLeft, { borderColor: theme.tint }]} />
            <View style={[styles.corner, styles.bottomRight, { borderColor: theme.tint }]} />

            <Ionicons name="scan-circle-outline" size={60} color={theme.tint} />
            <Text style={[styles.viewfinderTitle, { color: theme.text }]}>
              {stagedPhotos.length > 0
                ? `${stagedPhotos.length} / ${MAX_BATCH_SIZE} Lembar Ditumpuk`
                : 'Siap Mengambil Foto Catatan'}
            </Text>
            <Text style={[styles.viewfinderDesc, { color: theme.subtext }]}>
              {selectedSubject
                ? `Foto akan dimasukkan ke binder: ${selectedSubject.name}`
                : 'Foto akan disimpan ke binder Umum'}
            </Text>

            {/* Capacity Progress Bar */}
            <View
              style={[
                styles.capacityTrack,
                { backgroundColor: colorScheme === 'dark' ? '#372f24' : '#e7dece' },
              ]}>
              <View
                style={[
                  styles.capacityFill,
                  {
                    width: `${(stagedPhotos.length / MAX_BATCH_SIZE) * 100}%`,
                    backgroundColor:
                      stagedPhotos.length >= MAX_BATCH_SIZE ? theme.amber : theme.primary,
                  },
                ]}
              />
            </View>
          </View>

          {/* Action Buttons: Camera & Gallery */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.primaryActionBtn, { backgroundColor: theme.primary }]}
              activeOpacity={0.8}
              onPress={handleTakePhoto}>
              <Ionicons name="camera" size={22} color="#FFFFFF" />
              <Text style={styles.primaryActionBtnText}>Foto (Kamera)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.secondaryActionBtn,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              activeOpacity={0.8}
              onPress={handlePickFromGallery}>
              <Ionicons name="images-outline" size={20} color={theme.tint} />
              <Text style={[styles.secondaryActionBtnText, { color: theme.text }]}>
                Pilih Galeri
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Staged Queue Bar (Tumpukan Foto) */}
        {stagedPhotos.length > 0 && (
          <View style={styles.stagedSection}>
            <View style={styles.stagedHeaderRow}>
              <View style={styles.stagedTitleBadge}>
                <Ionicons name="layers-outline" size={16} color={theme.primary} />
                <Text style={[styles.stagedSectionTitle, { color: theme.text }]}>
                  Tumpukan Lembar ({stagedPhotos.length}/{MAX_BATCH_SIZE})
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleClearStaging}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={[styles.clearBtnText, { color: theme.destructive || '#DC2626' }]}>
                  Kosongkan
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailsScroll}>
              {stagedPhotos.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.thumbnailWrapper,
                    { borderColor: theme.border, backgroundColor: theme.card },
                  ]}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setPreviewPhotoUri(item.uri)}>
                    <Image source={{ uri: item.uri }} style={styles.thumbnailImg} />
                    <View style={styles.thumbnailIndexBadge}>
                      <Text style={styles.thumbnailIndexText}>#{index + 1}</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Remove button */}
                  <TouchableOpacity
                    style={styles.removeBtn}
                    activeOpacity={0.7}
                    onPress={() => handleRemovePhoto(item.id)}>
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add more button tile inside queue */}
              {stagedPhotos.length < MAX_BATCH_SIZE && (
                <TouchableOpacity
                  style={[
                    styles.addMoreTile,
                    { borderColor: theme.border, backgroundColor: theme.card },
                  ]}
                  activeOpacity={0.7}
                  onPress={handleTakePhoto}>
                  <Ionicons name="add" size={24} color={theme.tint} />
                  <Text style={[styles.addMoreText, { color: theme.subtext }]}>
                    + Foto
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        )}

        {/* Tip Box */}
        <View
          style={[
            styles.tipCard,
            {
              backgroundColor: colorScheme === 'dark' ? '#252019' : '#fffcf6',
              borderColor: theme.border,
            },
          ]}>
          <Text style={[styles.tipTitle, { color: theme.text }]}>
            💡 Alur Batch & Background AI:
          </Text>
          <Text style={[styles.tipText, { color: theme.subtext }]}>
            • Ambil lembar demi lembar dengan crop yang rapi.
          </Text>
          <Text style={[styles.tipText, { color: theme.subtext }]}>
            • Tekan "Proses Semua" untuk langsung menyimpan ke ponsel. Kamu tidak perlu menunggu di layar ini.
          </Text>
          <Text style={[styles.tipText, { color: theme.subtext }]}>
            • AI Groq akan menganalisis tulisan satu per satu di latar belakang secara otomatis.
          </Text>
        </View>
      </ScrollView>

      {/* Fixed Bottom Action Bar */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: theme.card,
            borderTopColor: theme.border,
          },
        ]}>
        <TouchableOpacity
          style={[
            styles.processAllBtn,
            {
              backgroundColor:
                stagedPhotos.length === 0 || isProcessingBatch ? theme.subtext : theme.primary,
              opacity: stagedPhotos.length === 0 ? 0.5 : 1,
            },
          ]}
          disabled={stagedPhotos.length === 0 || isProcessingBatch}
          activeOpacity={0.8}
          onPress={handleProcessAll}>
          {isProcessingBatch ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.processAllBtnText}>
                {stagedPhotos.length === 0
                  ? 'Pilih Foto untuk Memulai'
                  : `Proses Semua (${stagedPhotos.length} Lembar)`}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Add Subject Modal */}
      <AddSubjectModal
        visible={showAddSubjectModal}
        onClose={() => setShowAddSubjectModal(false)}
        onSubjectCreated={(newSub) => {
          loadSubjects();
          setSelectedSubjectId(newSub.id);
        }}
      />

      {/* Fullscreen Photo Preview Modal */}
      <Modal
        visible={!!previewPhotoUri}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewPhotoUri(null)}>
        <View style={styles.previewModalOverlay}>
          <View style={[styles.previewModalContent, { backgroundColor: theme.card }]}>
            <View style={styles.previewModalHeader}>
              <Text style={[styles.previewModalTitle, { color: theme.text }]}>
                Pratinjau Lembar
              </Text>
              <TouchableOpacity
                onPress={() => setPreviewPhotoUri(null)}
                style={styles.closePreviewBtn}>
                <Ionicons name="close" size={22} color={theme.text} />
              </TouchableOpacity>
            </View>

            {previewPhotoUri && (
              <Image
                source={{ uri: previewPhotoUri }}
                style={styles.previewLargeImg}
                resizeMode="contain"
              />
            )}

            <View style={styles.previewModalActions}>
              <TouchableOpacity
                style={[styles.previewCloseBtn, { borderColor: theme.border }]}
                onPress={() => setPreviewPhotoUri(null)}>
                <Text style={[styles.previewCloseBtnText, { color: theme.text }]}>
                  Tutup
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 110,
  },
  header: {
    marginTop: 8,
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 22,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontWeight: '700',
    marginBottom: 4,
  },
  screenSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionBlock: {
    marginBottom: 16,
  },
  subjectHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  addSubjectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addSubjectBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  subjectScrollContent: {
    gap: 8,
    paddingRight: 16,
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  subjectChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  viewfinderCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  viewfinderFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    maxHeight: 180,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(128, 128, 128, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: 12,
    marginBottom: 16,
  },
  corner: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderWidth: 2.5,
  },
  topLeft: {
    top: -1,
    left: -1,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderTopLeftRadius: 4,
  },
  topRight: {
    top: -1,
    right: -1,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopRightRadius: 4,
  },
  bottomLeft: {
    bottom: -1,
    left: -1,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: 4,
  },
  bottomRight: {
    bottom: -1,
    right: -1,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: 4,
  },
  viewfinderTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  viewfinderDesc: {
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
  capacityTrack: {
    width: '60%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 10,
  },
  capacityFill: {
    height: '100%',
    borderRadius: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  primaryActionBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  secondaryActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  stagedSection: {
    marginBottom: 16,
  },
  stagedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  stagedTitleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stagedSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  thumbnailsScroll: {
    gap: 10,
    paddingRight: 16,
  },
  thumbnailWrapper: {
    width: 82,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
    borderRadius: 7,
  },
  thumbnailIndexBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  thumbnailIndexText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  removeBtn: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(220, 38, 38, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreTile: {
    width: 82,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addMoreText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tipCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  tipTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  tipText: {
    fontSize: 11,
    lineHeight: 16,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    paddingBottom: Platform.select({ ios: 28, android: 16 }),
    borderTopWidth: 1,
  },
  processAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  processAllBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  previewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  previewModalContent: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 14,
    padding: 16,
  },
  previewModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewModalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  closePreviewBtn: {
    padding: 4,
  },
  previewLargeImg: {
    width: '100%',
    height: 320,
    borderRadius: 8,
  },
  previewModalActions: {
    marginTop: 14,
    alignItems: 'center',
  },
  previewCloseBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  previewCloseBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
