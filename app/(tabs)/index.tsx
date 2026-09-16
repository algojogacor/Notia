import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  SectionList,
  Image,
  RefreshControl,
  Platform,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import OnboardingModal from '@/components/OnboardingModal';
import {
  getSubjectsWithCount,
  getNotes,
  getNotesGroupedBySubject,
  getDatabaseStats,
} from '@/src/db/database';
import {
  SubjectWithCount,
  NoteWithSubject,
  SubjectSection,
  DatabaseStats,
} from '@/src/types';

type ViewMode = 'GROUPED' | 'TIMELINE';
const ONBOARDING_KEY = '@notia_has_seen_onboarding';

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const db = useSQLiteContext();

  const [stats, setStats] = useState<DatabaseStats>({
    notesCount: 0,
    subjectsCount: 0,
  });
  const [subjectsWithCount, setSubjectsWithCount] = useState<SubjectWithCount[]>([]);
  const [allNotes, setAllNotes] = useState<NoteWithSubject[]>([]);
  const [groupedSections, setGroupedSections] = useState<SubjectSection[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('GROUPED');
  const [refreshing, setRefreshing] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check first-time onboarding
  useEffect(() => {
    async function checkOnboarding() {
      try {
        const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (!seen) {
          setShowOnboarding(true);
        }
      } catch {}
    }
    checkOnboarding();
  }, []);

  const handleCloseOnboarding = async () => {
    setShowOnboarding(false);
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {}
  };

  const loadData = useCallback(async () => {
    try {
      const [loadedStats, loadedSubs, loadedNotes, loadedGrouped] =
        await Promise.all([
          getDatabaseStats(db),
          getSubjectsWithCount(db),
          getNotes(db),
          getNotesGroupedBySubject(db),
        ]);
      setStats(loadedStats);
      setSubjectsWithCount(loadedSubs);
      setAllNotes(loadedNotes);
      setGroupedSections(loadedGrouped);
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

  // Filtered Notes for Timeline
  const filteredTimelineNotes = useMemo(() => {
    if (!selectedSubjectId) return allNotes;
    return allNotes.filter((n) => n.subject_id === selectedSubjectId);
  }, [allNotes, selectedSubjectId]);

  // Filtered Sections for Grouped View
  const filteredGroupedSections = useMemo(() => {
    if (!selectedSubjectId) return groupedSections;
    return groupedSections.filter((s) => s.subjectId === selectedSubjectId);
  }, [groupedSections, selectedSubjectId]);

  const selectedSubjectObj = useMemo(() => {
    if (!selectedSubjectId) return null;
    return subjectsWithCount.find((s) => s.id === selectedSubjectId) || null;
  }, [subjectsWithCount, selectedSubjectId]);

  // Render Note Card
  const renderNoteCard = useCallback(
    ({ item }: { item: NoteWithSubject }) => {
      const hasValidImage =
        item.image_path &&
        (item.image_path.startsWith('file:') ||
          item.image_path.startsWith('http') ||
          item.image_path.startsWith('content:') ||
          item.image_path.startsWith('data:'));

      return (
        <TouchableOpacity
          style={[
            styles.noteCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
          activeOpacity={0.7}
          onPress={() => router.push(`/note/${item.id}`)}>
          <View style={styles.cardContentRow}>
            {/* Thumbnail */}
            <View
              style={[
                styles.thumbnailContainer,
                { backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#EEF2FF' },
              ]}>
              {hasValidImage ? (
                <Image
                  source={{ uri: item.image_path }}
                  style={styles.thumbnailImage}
                  resizeMode="cover"
                />
              ) : (
                <Ionicons name="document-text" size={28} color={theme.tint} />
              )}
            </View>

            {/* Note Details */}
            <View style={styles.cardTextCol}>
              <View style={styles.cardMetaRow}>
                <View
                  style={[
                    styles.subjectBadge,
                    { backgroundColor: item.subject_color || theme.tint },
                  ]}>
                  <Text style={styles.subjectBadgeText}>
                    {item.subject_name || 'Umum'}
                  </Text>
                </View>
                <Text style={[styles.dateText, { color: theme.subtext }]}>
                  {item.date_taken}
                </Text>
              </View>

              <Text
                numberOfLines={2}
                style={[styles.noteExcerpt, { color: theme.text }]}>
                {item.extracted_text || 'Tidak ada teks terdeteksi.'}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={theme.tabIconDefault}
              style={{ alignSelf: 'center' }}
            />
          </View>
        </TouchableOpacity>
      );
    },
    [theme, colorScheme, router]
  );

  // List Header Component
  const ListHeader = (
    <View style={styles.headerSection}>
      {/* Brand & Greeting Banner */}
      <View style={[styles.headerBanner, { backgroundColor: theme.tint }]}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.badgeText}>SMART LECTURE NOTES</Text>
          <Text style={styles.appName}>Notia</Text>
          <Text style={styles.appTagline}>
            Semua catatan kuliah terorganisir rapi untuk UTS & UAS.
          </Text>
        </View>
        <Ionicons name="sparkles" size={32} color="#FDE047" />
      </View>

      {/* Quick Search Bar Shortcut */}
      <TouchableOpacity
        style={[
          styles.searchBarShortcut,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
        activeOpacity={0.8}
        onPress={() => router.push('/search')}>
        <Ionicons name="search" size={20} color={theme.tabIconDefault} />
        <Text style={[styles.searchPlaceholder, { color: theme.subtext }]}>
          Cari rumus, definisi, atau catatan...
        </Text>
      </TouchableOpacity>

      {/* Stats Summary */}
      <View style={styles.statsRow}>
        <View
          style={[
            styles.statCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}>
          <Ionicons name="documents" size={20} color={theme.tint} />
          <Text style={[styles.statValue, { color: theme.text }]}>
            {stats.notesCount}
          </Text>
          <Text style={[styles.statLabel, { color: theme.subtext }]}>
            Total Catatan
          </Text>
        </View>

        <View
          style={[
            styles.statCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}>
          <Ionicons name="school" size={20} color="#10B981" />
          <Text style={[styles.statValue, { color: theme.text }]}>
            {stats.subjectsCount}
          </Text>
          <Text style={[styles.statLabel, { color: theme.subtext }]}>
            Mata Kuliah
          </Text>
        </View>

        <View
          style={[
            styles.statCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}>
          <Ionicons name="shield-checkmark" size={20} color="#F59E0B" />
          <Text style={[styles.statValue, { color: theme.text }]}>100%</Text>
          <Text style={[styles.statLabel, { color: theme.subtext }]}>
            Local-First
          </Text>
        </View>
      </View>

      {/* Mata Kuliah Filter Carousel */}
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Filter Mata Kuliah
        </Text>
        {selectedSubjectId && (
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== 'web') {
                try {
                  Haptics.selectionAsync();
                } catch {}
              }
              setSelectedSubjectId(null);
            }}>
            <Text style={[styles.resetFilterText, { color: theme.tint }]}>
              Reset Filter
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        horizontal
        data={[
          {
            id: 'ALL',
            name: 'Semua',
            color: theme.tint,
            notes_count: stats.notesCount,
          },
          ...subjectsWithCount,
        ]}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsScroll}
        renderItem={({ item }) => {
          const isAll = item.id === 'ALL';
          const isSelected = isAll
            ? selectedSubjectId === null
            : selectedSubjectId === item.id;

          return (
            <TouchableOpacity
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? item.color : theme.card,
                  borderColor: isSelected ? item.color : theme.border,
                },
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  try {
                    Haptics.selectionAsync();
                  } catch {}
                }
                setSelectedSubjectId(isAll ? null : item.id);
              }}>
              <View
                style={[
                  styles.chipDot,
                  { backgroundColor: isSelected ? '#FFFFFF' : item.color },
                ]}
              />
              <Text
                style={[
                  styles.chipText,
                  { color: isSelected ? '#FFFFFF' : theme.text },
                ]}>
                {item.name}
              </Text>
              <View
                style={[
                  styles.chipCountBadge,
                  {
                    backgroundColor: isSelected
                      ? 'rgba(255,255,255,0.3)'
                      : theme.border,
                  },
                ]}>
                <Text
                  style={[
                    styles.chipCountText,
                    { color: isSelected ? '#FFFFFF' : theme.subtext },
                  ]}>
                  {item.notes_count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* View Mode Toggle */}
      <View style={styles.viewModeRow}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          {selectedSubjectObj
            ? selectedSubjectObj.name
            : viewMode === 'GROUPED'
            ? 'Catatan per Mata Kuliah'
            : 'Semua Catatan (Kronologis)'}
        </Text>

        {!selectedSubjectId && (
          <View
            style={[
              styles.segmentedToggle,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                viewMode === 'GROUPED' && { backgroundColor: theme.tint },
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  try {
                    Haptics.selectionAsync();
                  } catch {}
                }
                setViewMode('GROUPED');
              }}>
              <Ionicons
                name="grid-outline"
                size={16}
                color={viewMode === 'GROUPED' ? '#FFFFFF' : theme.subtext}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.toggleBtn,
                viewMode === 'TIMELINE' && { backgroundColor: theme.tint },
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  try {
                    Haptics.selectionAsync();
                  } catch {}
                }
                setViewMode('TIMELINE');
              }}>
              <Ionicons
                name="list-outline"
                size={16}
                color={viewMode === 'TIMELINE' ? '#FFFFFF' : theme.subtext}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  // Global Empty State
  const renderGlobalEmpty = () => (
    <View
      style={[
        styles.emptyCard,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="camera" size={36} color={theme.tint} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        Belum ada catatan kuliah tersimpan
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.subtext }]}>
        Ambil foto binder tulisan tangan, papan tulis kelas, atau slide dosen.
        Notia AI akan otomatis mengkategorikan dan menyimpannya di sini!
      </Text>

      <TouchableOpacity
        style={[styles.emptyActionBtn, { backgroundColor: theme.tint }]}
        onPress={() => router.push('/camera')}>
        <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
        <Text style={styles.emptyActionBtnText}>Foto Catatan Sekarang</Text>
      </TouchableOpacity>
    </View>
  );

  // Filter Empty State
  const renderFilterEmpty = () => (
    <View
      style={[
        styles.emptyCard,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}>
      <Ionicons name="folder-open-outline" size={36} color={theme.subtext} />
      <Text style={[styles.emptyTitle, { color: theme.text, marginTop: 12 }]}>
        Belum ada catatan untuk "{selectedSubjectObj?.name}"
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.subtext }]}>
        Foto materi kuliah ini sekarang agar tersimpan otomatis dalam folder mata kuliah ini.
      </Text>

      <TouchableOpacity
        style={[styles.emptyActionBtn, { backgroundColor: theme.tint }]}
        onPress={() => router.push('/camera')}>
        <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
        <Text style={styles.emptyActionBtnText}>Ambil Foto Catatan</Text>
      </TouchableOpacity>
    </View>
  );

  const isGlobalEmpty = allNotes.length === 0;
  const isFilterEmpty = !isGlobalEmpty && selectedSubjectId !== null && filteredTimelineNotes.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {viewMode === 'GROUPED' && !selectedSubjectId ? (
        <SectionList
          sections={filteredGroupedSections}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={isGlobalEmpty ? renderGlobalEmpty : renderFilterEmpty}
          renderItem={renderNoteCard}
          renderSectionHeader={({ section }) => (
            <View
              style={[
                styles.sectionHeaderBar,
                { backgroundColor: theme.background },
              ]}>
              <View
                style={[
                  styles.sectionColorAccent,
                  { backgroundColor: section.subjectColor },
                ]}
              />
              <Text style={[styles.sectionHeaderText, { color: theme.text }]}>
                {section.subjectName}
              </Text>
              <View style={styles.sectionBadge}>
                <Text style={[styles.sectionBadgeText, { color: theme.subtext }]}>
                  {section.data.length} catatan
                </Text>
              </View>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          stickySectionHeadersEnabled={false}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      ) : (
        <FlatList
          data={filteredTimelineNotes}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={isGlobalEmpty ? renderGlobalEmpty : renderFilterEmpty}
          renderItem={renderNoteCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      )}

      <OnboardingModal
        visible={showOnboarding}
        onClose={handleCloseOnboarding}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerSection: {
    marginBottom: 8,
  },
  headerBanner: {
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
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
    fontSize: 26,
    fontWeight: '800',
  },
  appTagline: {
    color: '#E0E7FF',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  searchBarShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 16,
  },
  searchPlaceholder: {
    fontSize: 13,
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
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  resetFilterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipsScroll: {
    gap: 8,
    paddingBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
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
    fontSize: 12,
    fontWeight: '600',
  },
  chipCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  chipCountText: {
    fontSize: 10,
    fontWeight: '700',
  },
  viewModeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 6,
  },
  segmentedToggle: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 2,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  noteCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  cardContentRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  thumbnailContainer: {
    width: 68,
    height: 68,
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  cardTextCol: {
    flex: 1,
    gap: 4,
  },
  cardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subjectBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  subjectBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 11,
  },
  noteExcerpt: {
    fontSize: 12,
    lineHeight: 17,
  },
  sectionHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 10,
    marginBottom: 6,
    gap: 8,
  },
  sectionColorAccent: {
    width: 4,
    height: 18,
    borderRadius: 2,
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  sectionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    marginTop: 12,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
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
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
