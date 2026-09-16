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
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
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

  const handleDelete = async () => {
    if (!note) return;
    try {
      await deleteNote(db, note.id);
      router.back();
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  const handleShare = async () => {
    if (!note?.extracted_text) return;
    try {
      await Share.share({
        message: `[Notia - ${note.subject_name || 'Catatan Kuliah'}]\n\n${note.extracted_text}`,
      });
    } catch (err) {
      console.error('Error sharing:', err);
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
          ID Catatan: {id}
        </Text>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: theme.tint }]}
          onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Kembali ke Beranda</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
              <TouchableOpacity onPress={handleDelete} style={styles.headerBtn}>
                <Ionicons name="trash-outline" size={22} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {/* Subject & Date Header */}
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
        <Text style={[styles.dateText, { color: theme.subtext }]}>
          {note.date_taken}
        </Text>
      </View>

      {/* Image Preview Container */}
      <View
        style={[
          styles.imageContainer,
          { backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#EEF2FF' },
        ]}>
        {note.image_path.startsWith('file:') ||
        note.image_path.startsWith('http') ||
        note.image_path.startsWith('content:') ||
        note.image_path.startsWith('data:') ? (
          <Image
            source={{ uri: note.image_path }}
            style={styles.fullImage}
            resizeMode="cover"
          />
        ) : (
          <>
            <Ionicons name="image-outline" size={48} color={theme.tint} />
            <Text style={[styles.imagePathText, { color: theme.subtext }]}>
              Path: {note.image_path}
            </Text>
          </>
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
              Hasil Transkripsi Teks (AI Vision)
            </Text>
          </View>
        </View>

        <Text style={[styles.extractedBody, { color: theme.text }]}>
          {note.extracted_text || 'Tidak ada teks terdeteksi.'}
        </Text>
      </View>

      {/* Note Metadata Footer */}
      <View
        style={[
          styles.footerCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}>
        <Text style={[styles.footerTitle, { color: theme.subtext }]}>
          METADATA LOKAL (SQLite)
        </Text>
        <Text style={[styles.footerText, { color: theme.subtext }]}>
          ID: {note.id}
        </Text>
        <Text style={[styles.footerText, { color: theme.subtext }]}>
          Dibuat: {note.created_at}
        </Text>
        <Text style={[styles.footerText, { color: theme.subtext }]}>
          Penyimpanan: On-device (Privasi Terjamin)
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
    paddingBottom: 36,
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
    padding: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  dateText: {
    fontSize: 13,
  },
  imageContainer: {
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  imagePathText: {
    fontSize: 11,
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
    marginBottom: 12,
  },
  textHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  extractedBody: {
    fontSize: 14,
    lineHeight: 22,
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
  },
});
