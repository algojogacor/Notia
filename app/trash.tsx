import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import {
  getTrashNotes,
  restoreNote,
  permanentlyDeleteNote,
  emptyTrash,
} from '@/src/db/database';
import { NoteWithSubject } from '@/src/types';

export default function TrashScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [trashNotes, setTrashNotes] = useState<NoteWithSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadTrash = useCallback(async () => {
    try {
      setLoading(true);
      const notes = await getTrashNotes(db);
      setTrashNotes(notes);
    } catch (err) {
      console.error('Failed to load trash notes:', err);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

  const handleRestore = async (note: NoteWithSubject) => {
    try {
      setBusyId(note.id);
      if (Platform.OS !== 'web') {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }
      await restoreNote(db, note.id);
      await loadTrash();
      Alert.alert(
        'Lembar Dikembalikan',
        `Catatan "${note.subject_name || 'Catatan'}" telah dikembalikan ke bindernya.`
      );
    } catch (err) {
      console.error('Failed to restore note:', err);
      Alert.alert('Gagal', 'Tidak dapat mengembalikan catatan.');
    } finally {
      setBusyId(null);
    }
  };

  const handlePermanentDelete = (note: NoteWithSubject) => {
    Alert.alert(
      'Hapus Permanen?',
      'Catatan ini beserta foto dokumen aslinya akan dihapus selamanya dari memori perangkat. Tindakan ini tidak dapat dibatalkan.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Buang Selamanya',
          style: 'destructive',
          onPress: async () => {
            try {
              setBusyId(note.id);
              if (Platform.OS !== 'web') {
                try {
                  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                } catch {}
              }
              await permanentlyDeleteNote(db, note.id);
              await loadTrash();
            } catch (err) {
              console.error('Failed to permanently delete note:', err);
              Alert.alert('Gagal', 'Tidak dapat menghapus catatan secara permanen.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  const handleEmptyTrash = () => {
    if (trashNotes.length === 0) return;
    Alert.alert(
      'Kosongkan Keranjang?',
      `Semua ${trashNotes.length} lembar catatan di keranjang akan dihapus permanen beserta file gambarnya. Tindakan ini tidak dapat dibatalkan.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Kosongkan',
          style: 'destructive',
          onPress: async () => {
            try {
              if (Platform.OS !== 'web') {
                try {
                  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                } catch {}
              }
              const removed = await emptyTrash(db);
              await loadTrash();
              Alert.alert(
                'Keranjang Dibersihkan',
                `${removed} catatan telah dibuang permanen dari memori.`
              );
            } catch (err) {
              console.error('Failed to empty trash:', err);
              Alert.alert('Gagal', 'Tidak dapat mengosongkan keranjang.');
            }
          },
        },
      ]
    );
  };

  const renderTrashItem = ({ item }: { item: NoteWithSubject }) => {
    const hasValidImage =
      item.image_path &&
      (item.image_path.startsWith('file:') ||
        item.image_path.startsWith('http') ||
        item.image_path.startsWith('content:') ||
        item.image_path.startsWith('data:'));

    const lines = item.extracted_text
      ? item.extracted_text.split('\n').map((l) => l.trim()).filter(Boolean)
      : [];
    const noteTitle = lines[0] || item.subject_name || 'Catatan Kuliah';
    const isBusy = busyId === item.id;

    return (
      <View
        style={[
          styles.trashRow,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
          },
        ]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push(`/note/${item.id}`)}
          style={styles.thumbContainer}>
          {hasValidImage ? (
            <Image
              source={{ uri: item.image_path }}
              style={styles.thumbImage}
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="document-text-outline" size={24} color={theme.subtext} />
          )}
        </TouchableOpacity>

        <View style={styles.infoCol}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push(`/note/${item.id}`)}>
            <Text
              numberOfLines={1}
              style={[styles.noteTitle, { color: theme.text }]}>
              {noteTitle}
            </Text>
          </TouchableOpacity>

          <View style={styles.metaRow}>
            <View style={styles.subjectChip}>
              <View
                style={[
                  styles.subjectDot,
                  { backgroundColor: item.subject_color || theme.tint },
                ]}
              />
              <Text style={[styles.subjectName, { color: theme.subtext }]}>
                {item.subject_name || 'Umum'}
              </Text>
            </View>
            <Text style={[styles.dateLabel, { color: theme.subtext }]}>
              {item.date_taken}
            </Text>
          </View>

          {/* Action buttons: Kembalikan & Buang */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.restoreBtn,
                { backgroundColor: theme.secondary, borderColor: theme.border },
              ]}
              disabled={isBusy}
              onPress={() => handleRestore(item)}>
              {isBusy ? (
                <ActivityIndicator size="small" color={theme.tint} />
              ) : (
                <>
                  <Ionicons name="arrow-undo-outline" size={13} color={theme.success} />
                  <Text style={[styles.restoreBtnText, { color: theme.text }]}>
                    Kembalikan
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.deleteBtn,
                { backgroundColor: colorScheme === 'dark' ? '#3d2520' : '#f9ebe6' },
              ]}
              disabled={isBusy}
              onPress={() => handlePermanentDelete(item)}>
              <Ionicons
                name="trash-outline"
                size={13}
                color={colorScheme === 'dark' ? '#d97b62' : '#b5472f'}
              />
              <Text
                style={[
                  styles.deleteBtnText,
                  { color: colorScheme === 'dark' ? '#d97b62' : '#b5472f' },
                ]}>
                Buang
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const ListHeader = (
    <View style={styles.headerArea}>
      <Text style={[styles.overline, { color: theme.subtext }]}>
        NOTIA · KERANJANG LEMBAR
      </Text>
      <Text style={[styles.screenTitle, { color: theme.text }]}>
        Keranjang
      </Text>
      <View style={[styles.inkLine, { backgroundColor: theme.border }]} />
      <Text style={[styles.description, { color: theme.subtext }]}>
        Lembar yang dilepas dari binder disimpan di sini selama 30 hari. Anda
        dapat memulihkannya sewaktu-waktu atau mengosongkannya untuk menghemat memori.
      </Text>

      {trashNotes.length > 0 && (
        <TouchableOpacity
          style={[
            styles.emptyAllBtn,
            {
              backgroundColor: colorScheme === 'dark' ? '#3d2520' : '#f9ebe6',
              borderColor: colorScheme === 'dark' ? '#5a3028' : '#ecd3ca',
            },
          ]}
          onPress={handleEmptyTrash}>
          <Ionicons
            name="trash"
            size={14}
            color={colorScheme === 'dark' ? '#d97b62' : '#b5472f'}
          />
          <Text
            style={[
              styles.emptyAllBtnText,
              { color: colorScheme === 'dark' ? '#d97b62' : '#b5472f' },
            ]}>
            Kosongkan Keranjang ({trashNotes.length})
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      ) : (
        <FlatList
          data={trashNotes}
          keyExtractor={(item) => item.id}
          renderItem={renderTrashItem}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View
                style={[
                  styles.emptyIconCircle,
                  { backgroundColor: colorScheme === 'dark' ? '#302a21' : '#f1eadd' },
                ]}>
                <Ionicons name="trash-outline" size={32} color={theme.subtext} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                Keranjang Bersih
              </Text>
              <Text style={[styles.emptySub, { color: theme.subtext }]}>
                Tidak ada lembar catatan yang dilepas. Semua catatan kuliahmu
                aman tersimpan di bendelnya.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerArea: {
    marginBottom: 20,
  },
  overline: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginBottom: 6,
  },
  inkLine: {
    height: 1,
    width: 44,
    marginBottom: 10,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  emptyAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  emptyAllBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  trashRow: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 12,
    marginBottom: 10,
  },
  thumbContainer: {
    width: 64,
    height: 76,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.8,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  infoCol: {
    flex: 1,
    justifyContent: 'space-between',
  },
  noteTitle: {
    fontSize: 14.5,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginBottom: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  subjectDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  subjectName: {
    fontSize: 11,
    fontWeight: '500',
  },
  dateLabel: {
    fontSize: 11,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  restoreBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deleteBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});
