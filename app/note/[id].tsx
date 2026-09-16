import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { getNoteById, deleteNote } from '@/src/db/database';
import { NoteWithSubject } from '@/src/types';

export default function NoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [note, setNote] = useState<NoteWithSubject | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadNote() {
      if (!id) return;
      try {
        const found = await getNoteById(db, id);
        setNote(found);
      } catch (err) {
        console.error('Failed to load note:', err);
      } finally {
        setLoading(false);
      }
    }
    loadNote();
  }, [id, db]);

  const handleDeleteConfirm = () => {
    if (!note) return;
    Alert.alert(
      'Hapus Catatan Kuliah?',
      'Apakah Anda yakin ingin menghapus foto dan catatan ini secara permanen dari perangkat?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteNote(db, note.id);
              router.back();
            } catch (err) {
              console.error('Failed to delete note:', err);
              Alert.alert('Gagal Menghapus', 'Terjadi kesalahan saat menghapus catatan.');
            }
          },
        },
      ]
    );
  };

  const handleCopyText = async () => {
    if (!note?.extracted_text) return;
    try {
      await Clipboard.setStringAsync(note.extracted_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleShare = async () => {
    if (!note?.extracted_text) return;
    try {
      await Share.share({
        message: `📚 [Notia - ${note.subject_name || 'Catatan Kuliah'}]\nTanggal: ${note.date_taken}\n\n${note.extracted_text}`,
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

      {/* Image Preview Container */}
      <View
        style={[
          styles.imageContainer,
          { backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#EEF2FF' },
        ]}>
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
      </View>

      {/* Extracted Text Section */}
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
              { backgroundColor: copied ? '#10B981' : theme.tint },
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

        <Text style={[styles.extractedBody, { color: theme.text }]}>
          {note.extracted_text || 'Tidak ada teks terdeteksi.'}
        </Text>
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
            { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
          ]}
          onPress={handleDeleteConfirm}>
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
          <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>
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
    lineHeight: 22,
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
});
