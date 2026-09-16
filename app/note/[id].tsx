import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Image,
  Alert,
  Platform,
  PanResponder,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { getNoteById, getNotes, softDeleteNote, updateNoteSummaryAndKeyPoints } from '@/src/db/database';
import { generateSummaryAndKeyPointsForText } from '@/src/services/groq';
import { NoteWithSubject } from '@/src/types';

export default function NoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [note, setNote] = useState<NoteWithSubject | null>(null);
  const [allNotes, setAllNotes] = useState<NoteWithSubject[]>([]);
  const [currentId, setCurrentId] = useState<string>(id || '');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // Parse key_points JSON array
  const keyPoints: string[] = useMemo(() => {
    if (!note?.key_points) return [];
    try {
      const parsed = JSON.parse(note.key_points);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [note?.key_points]);

  const handleGenerateSummary = async () => {
    if (!note?.extracted_text?.trim()) {
      Alert.alert('Teks Belum Ada', 'Catatan ini belum memiliki transkripsi teks untuk dirangkum.');
      return;
    }
    setIsGeneratingSummary(true);
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      const res = await generateSummaryAndKeyPointsForText(note.extracted_text);
      await updateNoteSummaryAndKeyPoints(db, note.id, res.summary, res.key_points);
      const updated = await getNoteById(db, note.id);
      setNote(updated);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch (err: any) {
      Alert.alert('Gagal Membuat Rangkuman', err.message || 'Terjadi kesalahan saat memproses AI.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  useEffect(() => {
    if (id && id !== currentId) {
      setCurrentId(id);
    }
  }, [id]);

  useEffect(() => {
    async function loadData() {
      if (!currentId) return;
      try {
        const found = await getNoteById(db, currentId);
        setNote(found);

        const list = await getNotes(db);
        setAllNotes(list);
      } catch (err) {
        console.error('Failed to load note:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentId, db]);

  // Compute number of ruled lines to cover the entire note reading area
  const ruleLineCount = useMemo(() => {
    if (!note?.extracted_text) return 20;
    const explicitLines = note.extracted_text.split('\n');
    let estimated = 0;
    for (const line of explicitLines) {
      estimated += Math.max(1, Math.ceil(line.length / 38));
    }
    return Math.max(estimated + 4, 20);
  }, [note?.extracted_text]);

  // If there are multiple notes in the same subject, browse within that subject; else browse all notes
  // Urutan dari kiri ke kanan: Kiri = Terlama (ASC), Semakin ke Kanan = Terbaru (ASC)
  const activeList = useMemo(() => {
    if (!note) return allNotes;
    let baseList = allNotes;
    if (note.subject_id) {
      const subjectNotes = allNotes.filter((n) => n.subject_id === note.subject_id);
      if (subjectNotes.length > 1) {
        baseList = subjectNotes;
      }
    }

    return [...baseList].sort((a, b) => {
      const dateCmp = (a.date_taken || '').localeCompare(b.date_taken || '');
      if (dateCmp !== 0) return dateCmp;
      const createdCmp = (a.created_at || '').localeCompare(b.created_at || '');
      if (createdCmp !== 0) return createdCmp;
      return a.id.localeCompare(b.id);
    });
  }, [note, allNotes]);

  const currentIndex = useMemo(() => {
    if (!note || activeList.length === 0) return -1;
    return activeList.findIndex((n) => n.id === note.id);
  }, [note, activeList]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < activeList.length - 1;

  const navigateToPrev = useCallback(() => {
    if (hasPrev) {
      if (Platform.OS !== 'web') {
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {}
      }
      const prevNote = activeList[currentIndex - 1];
      setNote(prevNote);
      setCurrentId(prevNote.id);
      router.setParams({ id: prevNote.id });
    }
  }, [hasPrev, activeList, currentIndex, router]);

  const navigateToNext = useCallback(() => {
    if (hasNext) {
      if (Platform.OS !== 'web') {
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {}
      }
      const nextNote = activeList[currentIndex + 1];
      setNote(nextNote);
      setCurrentId(nextNote.id);
      router.setParams({ id: nextNote.id });
    }
  }, [hasNext, activeList, currentIndex, router]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Trigger when intentional horizontal swipe (at least 20px, dx > dy * 1.4)
          return (
            Math.abs(gestureState.dx) > 20 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.4
          );
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx < -45) {
            // Swipe Left -> Foto Selanjutnya
            navigateToNext();
          } else if (gestureState.dx > 45) {
            // Swipe Right -> Foto Sebelumnya
            navigateToPrev();
          }
        },
      }),
    [navigateToNext, navigateToPrev]
  );

  const handleDeleteConfirm = () => {
    if (!note) return;
    Alert.alert(
      'Pindahkan ke Keranjang?',
      'Catatan ini akan dilepas dari binder dan disimpan di Keranjang selama 30 hari. Anda dapat memulihkannya kembali dari menu Pengaturan.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Pindahkan ke Keranjang',
          style: 'destructive',
          onPress: async () => {
            try {
              if (Platform.OS !== 'web') {
                try {
                  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                } catch {}
              }
              await softDeleteNote(db, note.id);
              router.back();
            } catch (err) {
              console.error('Failed to soft delete note:', err);
              Alert.alert('Gagal Menghapus', 'Terjadi kesalahan saat memindahkan catatan ke keranjang.');
            }
          },
        },
      ]
    );
  };

  const handleCopyText = async () => {
    if (!note?.extracted_text) return;
    try {
      if (Platform.OS !== 'web') {
        try {
          await Haptics.selectionAsync();
        } catch {}
      }
      await Clipboard.setStringAsync(note.extracted_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleShare = async () => {
    if (!note) return;

    try {
      const isSharingAvailable = await Sharing.isAvailableAsync();
      const hasLocalImage =
        note.image_path &&
        (note.image_path.startsWith('file:') || note.image_path.startsWith('/'));

      if (isSharingAvailable && hasLocalImage) {
        Alert.alert('Bagikan Catatan', 'Pilih format yang ingin Anda bagikan:', [
          {
            text: '📸 Bagikan Foto Catatan (WA/Aplikasi)',
            onPress: async () => {
              try {
                await Sharing.shareAsync(note.image_path, {
                  mimeType: 'image/jpeg',
                  dialogTitle: `Bagikan Foto ${note.subject_name || 'Catatan'}`,
                });
              } catch (err) {
                console.error('Error sharing image:', err);
              }
            },
          },
          {
            text: '📝 Bagikan Teks Catatan Saja',
            onPress: async () => {
              try {
                await Share.share({
                  message: `📚 [Notia - ${note.subject_name || 'Catatan Kuliah'}]\nTanggal: ${note.date_taken}\n\n${note.extracted_text || '(Foto belum diekstrak)'}`,
                });
              } catch (err) {
                console.error('Error sharing text:', err);
              }
            },
          },
          { text: 'Batal', style: 'cancel' },
        ]);
        return;
      }

      // Fallback to text share
      await Share.share({
        message: `📚 [Notia - ${note.subject_name || 'Catatan Kuliah'}]\nTanggal: ${note.date_taken}\n\n${note.extracted_text || '(Foto belum diekstrak)'}`,
      });
    } catch (err) {
      console.error('Error sharing note:', err);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  if (!note) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={[styles.notFoundTitle, { color: theme.text }]}>
          Catatan Tidak Ditemukan
        </Text>
        <Text style={[styles.notFoundDesc, { color: theme.subtext }]}>
          ID: {id}
        </Text>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: theme.tint }]}
          onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Kembali ke Beranda</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasValidImage =
    note.image_path &&
    (note.image_path.startsWith('file:') ||
      note.image_path.startsWith('http') ||
      note.image_path.startsWith('content:') ||
      note.image_path.startsWith('data:'));

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}>
      <Stack.Screen
        options={{
          title: note.subject_name || 'Detail Catatan',
          headerRight: () => (
            <View style={styles.headerButtons}>
              <TouchableOpacity onPress={handleShare} style={styles.headerBtn}>
                <Ionicons name="share-outline" size={22} color={theme.tint} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDeleteConfirm} style={styles.headerBtn}>
                <Ionicons name="trash-outline" size={22} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {/* Meta Bar */}
      <View style={styles.metaRow}>
        <View
          style={[
            styles.subjectBadge,
            { backgroundColor: note.subject_color || theme.tint },
          ]}>
          <Ionicons name="school" size={14} color="#FFFFFF" />
          <Text style={styles.subjectBadgeText}>
            {note.subject_name || 'Umum'}
          </Text>
        </View>
        <View style={styles.dateBadge}>
          <Ionicons name="calendar-outline" size={14} color={theme.subtext} />
          <Text style={[styles.dateText, { color: theme.subtext }]}>
            {note.date_taken}
          </Text>
        </View>
      </View>

      {/* Image Preview Container with Swipe Gesture */}
      <View
        style={[
          styles.imageContainer,
          {
            backgroundColor: colorScheme === 'dark' ? '#252019' : '#f1eadd',
            borderColor: colorScheme === 'dark' ? '#372f24' : '#e7dece',
          },
        ]}
        {...panResponder.panHandlers}>
        {hasValidImage ? (
          <Image
            source={{ uri: note.image_path }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={48} color={theme.tint} />
            <Text style={[styles.imagePathText, { color: theme.subtext }]}>
              {note.image_path}
            </Text>
          </View>
        )}

        {/* Previous Button Overlay */}
        {hasPrev && (
          <TouchableOpacity
            style={[styles.arrowNavBtn, styles.arrowNavLeft]}
            onPress={navigateToPrev}
            activeOpacity={0.7}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {/* Next Button Overlay */}
        {hasNext && (
          <TouchableOpacity
            style={[styles.arrowNavBtn, styles.arrowNavRight]}
            onPress={navigateToNext}
            activeOpacity={0.7}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
            <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {/* Paging / Swipe Indicator Badge */}
        {activeList.length > 1 && currentIndex !== -1 && (
          <View style={styles.pagingBadge}>
            <Ionicons name="swap-horizontal" size={13} color="#FFFFFF" />
            <Text style={styles.pagingText}>
              {currentIndex + 1} / {activeList.length} • Geser foto
            </Text>
          </View>
        )}
      </View>

      {/* Background AI Queue Status Banner */}
      {note.ai_status === 'pending' && (
        <View
          style={[
            styles.statusBanner,
            { backgroundColor: 'rgba(176, 124, 36, 0.12)', borderColor: theme.amber },
          ]}>
          <Ionicons name="time-outline" size={16} color={theme.amber} />
          <Text style={[styles.statusBannerText, { color: theme.amber }]}>
            {(note.retry_count || 0) > 0
              ? 'Catatan ini sedang dalam antrean retry AI...'
              : 'Catatan ini sedang dalam antrean pemrosesan AI...'}
          </Text>
        </View>
      )}

      {note.ai_status === 'processing' && (
        <View
          style={[
            styles.statusBanner,
            { backgroundColor: 'rgba(76, 70, 137, 0.12)', borderColor: theme.primary },
          ]}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={[styles.statusBannerText, { color: theme.primary }]}>
            Sedang membaca dan mentranskripsi foto dengan AI...
          </Text>
        </View>
      )}

      {/* AI Summary Blockquote with Amber Accent */}
      {note.summary ? (
        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderLeftColor: theme.amber,
            },
          ]}>
          <View style={styles.summaryHeaderRow}>
            <Ionicons name="bulb" size={15} color={theme.amber} />
            <Text style={[styles.summaryHeaderLabel, { color: theme.amber }]}>
              RINGKASAN AI
            </Text>
          </View>
          <Text style={[styles.summaryBodyText, { color: theme.text }]}>
            {note.summary}
          </Text>
        </View>
      ) : null}

      {/* AI Key Points with Stabilo Highlighter style */}
      {keyPoints.length > 0 ? (
        <View
          style={[
            styles.keyPointsCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}>
          <View style={styles.keyPointsHeaderRow}>
            <Ionicons name="bookmark" size={15} color={theme.amber} />
            <Text style={[styles.keyPointsHeaderLabel, { color: theme.amber }]}>
              POIN PENTING
            </Text>
          </View>
          <View style={styles.keyPointsList}>
            {keyPoints.map((point, index) => (
              <View key={index} style={styles.keyPointRow}>
                <View style={[styles.keyPointDot, { backgroundColor: theme.amber }]} />
                <View
                  style={[
                    styles.highlighterWrapper,
                    {
                      backgroundColor:
                        colorScheme === 'dark'
                          ? 'rgba(176, 124, 36, 0.22)'
                          : 'rgba(176, 124, 36, 0.15)',
                    },
                  ]}>
                  <Text style={[styles.highlighterText, { color: theme.text }]}>
                    {point}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Generate Rangkuman Button (for older notes) */}
      {!note.summary && keyPoints.length === 0 && Boolean(note.extracted_text?.trim()) && (
        <TouchableOpacity
          style={[
            styles.generateSummaryBtn,
            { backgroundColor: theme.card, borderColor: theme.amber },
          ]}
          onPress={handleGenerateSummary}
          disabled={isGeneratingSummary}>
          {isGeneratingSummary ? (
            <ActivityIndicator size="small" color={theme.amber} />
          ) : (
            <Ionicons name="sparkles" size={16} color={theme.amber} />
          )}
          <Text style={[styles.generateSummaryBtnText, { color: theme.amber }]}>
            {isGeneratingSummary
              ? 'Menganalisis Rangkuman...'
              : 'Generate Rangkuman & Poin Penting'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Extracted Text Section — Lined Paper Notebook feel */}
      <View
        style={[
          styles.textCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}>
        <View style={styles.textCardHeader}>
          <View style={styles.textHeaderLeft}>
            <Ionicons name="sparkles" size={18} color={theme.tint} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Transkripsi Materi (AI Vision)
            </Text>
          </View>

          {/* Copy Button */}
          <TouchableOpacity
            style={[
              styles.copyBtn,
              { backgroundColor: copied ? theme.success : theme.tint },
            ]}
            onPress={handleCopyText}>
            <Ionicons
              name={copied ? 'checkmark' : 'copy-outline'}
              size={14}
              color="#FFFFFF"
            />
            <Text style={styles.copyBtnText}>
              {copied ? 'Tersalin!' : 'Salin Teks'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Lined paper area with margin */}
        <View style={styles.linedPaperContainer}>
          {/* Vertical margin line (notebook left margin) */}
          <View
            style={[styles.marginLine, { backgroundColor: theme.margin }]}
            pointerEvents="none"
          />

          {/* Horizontal ruled lines rendered dynamically based on note length */}
          {Array.from({ length: ruleLineCount }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.ruleLine,
                { backgroundColor: theme.rule, top: (i + 1) * 25.5 },
              ]}
              pointerEvents="none"
            />
          ))}

          {/* Text content, indented past the margin */}
          <Text style={[styles.extractedBody, { color: theme.text }]}>
            {note.extracted_text || 'Tidak ada teks terdeteksi.'}
          </Text>
        </View>
      </View>

      {/* Action Buttons Row */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
          onPress={handleShare}>
          <Ionicons name="share-social-outline" size={18} color={theme.tint} />
          <Text style={[styles.actionBtnText, { color: theme.text }]}>
            Bagikan Catatan
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: colorScheme === 'dark' ? '#3d2520' : '#f9ebe6', borderColor: colorScheme === 'dark' ? '#5a3028' : '#ecd3ca' },
          ]}
          onPress={handleDeleteConfirm}>
          <Ionicons name="trash-outline" size={18} color={colorScheme === 'dark' ? '#d97b62' : '#b5472f'} />
          <Text style={[styles.actionBtnText, { color: colorScheme === 'dark' ? '#d97b62' : '#b5472f' }]}>
            Hapus Catatan
          </Text>
        </TouchableOpacity>
      </View>

      {/* Local SQLite Metadata */}
      <View
        style={[
          styles.footerCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}>
        <Text style={[styles.footerTitle, { color: theme.subtext }]}>
          PENYIMPANAN LOKAL (SQLite On-Device)
        </Text>
        <Text style={[styles.footerText, { color: theme.subtext }]}>
          • ID Dokumen: {note.id}
        </Text>
        <Text style={[styles.footerText, { color: theme.subtext }]}>
          • Tanggal Pengambilan: {note.date_taken}
        </Text>
        <Text style={[styles.footerText, { color: theme.subtext }]}>
          • Waktu Input: {note.created_at}
        </Text>
        <Text style={[styles.footerText, { color: theme.subtext }]}>
          • Privasi: 100% tersimpan offline di ponsel Anda
        </Text>
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
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  notFoundDesc: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 20,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  headerBtn: {
    padding: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  subjectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  subjectBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '500',
  },
  imageContainer: {
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  arrowNavBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  arrowNavLeft: {
    left: 10,
  },
  arrowNavRight: {
    right: 10,
  },
  pagingBadge: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  pagingText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  imagePlaceholder: {
    alignItems: 'center',
    gap: 8,
    padding: 16,
  },
  imagePathText: {
    fontSize: 11,
    textAlign: 'center',
    fontFamily: 'SpaceMono',
  },
  textCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  textCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  textHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  copyBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  extractedBody: {
    fontSize: 14,
    lineHeight: 25.5,  // 1.7 × ~15px — generous reading rhythm
    paddingLeft: 48,   // indented past the margin line
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  linedPaperContainer: {
    position: 'relative' as const,
    overflow: 'hidden',
    paddingTop: 4,
    paddingBottom: 12,
  },
  marginLine: {
    position: 'absolute' as const,
    top: 0,
    bottom: 0,
    left: 42,
    width: 1.5,
    opacity: 0.6,
  },
  ruleLine: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.5,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  footerCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  footerTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  footerText: {
    fontSize: 12,
    lineHeight: 18,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    marginBottom: 14,
  },
  statusBannerText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  summaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 14,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  summaryHeaderLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  summaryBodyText: {
    fontSize: 13.5,
    lineHeight: 21,
    fontStyle: 'italic',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  keyPointsCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  keyPointsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  keyPointsHeaderLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  keyPointsList: {
    gap: 8,
  },
  keyPointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  keyPointDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  highlighterWrapper: {
    flex: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  highlighterText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  generateSummaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 8,
    marginBottom: 14,
  },
  generateSummaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
