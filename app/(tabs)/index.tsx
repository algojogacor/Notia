import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { getSubjects, getNotes, getDatabaseStats } from '@/src/db/database';
import { Subject, NoteWithSubject, DatabaseStats } from '@/src/types';

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const db = useSQLiteContext();

  const [stats, setStats] = useState<DatabaseStats>({
    notesCount: 0,
    subjectsCount: 0,
  });
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [recentNotes, setRecentNotes] = useState<NoteWithSubject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [loadedStats, loadedSubjects, loadedNotes] = await Promise.all([
        getDatabaseStats(db),
        getSubjects(db),
        getNotes(db),
      ]);
      setStats(loadedStats);
      setSubjects(loadedSubjects);
      setRecentNotes(loadedNotes);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const filteredNotes = selectedSubjectId
    ? recentNotes.filter((n) => n.subject_id === selectedSubjectId)
    : recentNotes;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }>
      {/* Header Banner */}
      <View style={[styles.headerBanner, { backgroundColor: theme.tint }]}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.badgeText}>PHASE 1 • FOUNDATION</Text>
          <Text style={styles.appName}>Notia</Text>
          <Text style={styles.appTagline}>
            Asisten cerdas foto catatan kuliah mahasiswa Indonesia
          </Text>
        </View>
        <Ionicons name="sparkles" size={32} color="#FDE047" />
      </View>

      {/* Database Quick Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="documents" size={22} color={theme.tint} />
          <Text style={[styles.statValue, { color: theme.text }]}>
            {stats.notesCount}
          </Text>
          <Text style={[styles.statLabel, { color: theme.subtext }]}>
            Total Catatan
          </Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="school" size={22} color="#10B981" />
          <Text style={[styles.statValue, { color: theme.text }]}>
            {stats.subjectsCount}
          </Text>
          <Text style={[styles.statLabel, { color: theme.subtext }]}>
            Mata Kuliah
          </Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="server" size={22} color="#F59E0B" />
          <Text style={[styles.statValue, { color: theme.text }]}>SQLite</Text>
          <Text style={[styles.statLabel, { color: theme.subtext }]}>
            Local-First
          </Text>
        </View>
      </View>

      {/* Mata Kuliah Filter Chips */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Mata Kuliah ({subjects.length})
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsScroll}>
        <TouchableOpacity
          style={[
            styles.chip,
            {
              backgroundColor:
                selectedSubjectId === null ? theme.tint : theme.card,
              borderColor:
                selectedSubjectId === null ? theme.tint : theme.border,
            },
          ]}
          onPress={() => setSelectedSubjectId(null)}>
          <Text
            style={[
              styles.chipText,
              {
                color: selectedSubjectId === null ? '#FFFFFF' : theme.text,
              },
            ]}>
            Semua
          </Text>
        </TouchableOpacity>

        {subjects.map((sub) => {
          const isSelected = selectedSubjectId === sub.id;
          return (
            <TouchableOpacity
              key={sub.id}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? sub.color : theme.card,
                  borderColor: isSelected ? sub.color : theme.border,
                },
              ]}
              onPress={() =>
                setSelectedSubjectId(isSelected ? null : sub.id)
              }>
              <View
                style={[
                  styles.chipDot,
                  {
                    backgroundColor: isSelected ? '#FFFFFF' : sub.color,
                  },
                ]}
              />
              <Text
                style={[
                  styles.chipText,
                  {
                    color: isSelected ? '#FFFFFF' : theme.text,
                  },
                ]}>
                {sub.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Catatan Kuliah Section */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Catatan Terbaru
        </Text>
        {filteredNotes.length > 0 && (
          <Text style={{ color: theme.subtext, fontSize: 13 }}>
            {filteredNotes.length} item
          </Text>
        )}
      </View>

      {filteredNotes.length === 0 ? (
        <View
          style={[
            styles.emptyCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="camera" size={32} color={theme.tint} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            Belum ada catatan tersimpan
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.subtext }]}>
            Foto catatan kuliahmu (tulisan tangan, papan tulis, atau slide)
            agar AI otomatis mengkategorikan ke mata kuliah yang pas!
          </Text>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.tint }]}
            onPress={() => router.push('/camera')}>
            <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Buka Kamera (Phase 2)</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.notesList}>
          {filteredNotes.map((note) => (
            <TouchableOpacity
              key={note.id}
              style={[
                styles.noteCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              onPress={() => router.push(`/note/${note.id}`)}>
              <View style={styles.noteHeader}>
                <View
                  style={[
                    styles.subjectBadge,
                    {
                      backgroundColor:
                        note.subject_color || theme.tint,
                    },
                  ]}>
                  <Text style={styles.subjectBadgeText}>
                    {note.subject_name || 'Umum'}
                  </Text>
                </View>
                <Text style={[styles.noteDate, { color: theme.subtext }]}>
                  {note.date_taken}
                </Text>
              </View>
              <Text
                numberOfLines={2}
                style={[styles.noteExcerpt, { color: theme.text }]}>
                {note.extracted_text || 'Tidak ada teks terdeteksi.'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
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
  headerBanner: {
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  headerTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  badgeText: {
    color: '#E0E7FF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  appTagline: {
    color: '#E0E7FF',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  chipsScroll: {
    gap: 8,
    paddingBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  notesList: {
    gap: 12,
  },
  noteCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  subjectBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  noteDate: {
    fontSize: 12,
  },
  noteExcerpt: {
    fontSize: 13,
    lineHeight: 18,
  },
});
