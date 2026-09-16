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
import AddSubjectModal from '@/components/AddSubjectModal';
import StreakCard from '@/components/StreakCard';
import ManualNoteSheet from '@/components/ManualNoteSheet';
import {
  getSubjectsWithCount,
  getNotes,
  getNotesGroupedBySubject,
  getNotesGroupedByTopic,
  getDatabaseStats,
  getStudyHeatmapAndStreak,
  resetNoteRetry,
  toggleFavorite,
} from '@/src/db/database';
import EmptyStateIllustration from '@/components/EmptyStateIllustration';
import { subscribeQueue, triggerQueueProcessing } from '@/src/services/aiQueue';
import {
  calculateAcademicImpact,
  shareNotiaApp,
} from '@/src/services/analytics';
import {
  SubjectWithCount,
  NoteWithSubject,
  SubjectSection,
  TopicGroupSection,
  DatabaseStats,
  AcademicImpactStats,
  StudyStreakStats,
} from '@/src/types';

type ViewMode = 'GROUPED' | 'TOPIC' | 'TIMELINE';
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
  const [streakStats, setStreakStats] = useState<StudyStreakStats>({
    streak: 0,
    bestStreak: 0,
    heatmap: [],
    heatmapTotal: 0,
  });
  const [academicStats, setAcademicStats] = useState<AcademicImpactStats>({
    notesCount: 0,
    subjectsCount: 0,
    minutesSaved: 0,
    hoursSaved: '0.0',
    activeDaysCount: 0,
  });
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [subjectsWithCount, setSubjectsWithCount] = useState<SubjectWithCount[]>([]);
  const [allNotes, setAllNotes] = useState<NoteWithSubject[]>([]);
  const [groupedSections, setGroupedSections] = useState<SubjectSection[]>([]);
  const [topicSections, setTopicSections] = useState<TopicGroupSection[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('GROUPED');
  const [refreshing, setRefreshing] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showManualNote, setShowManualNote] = useState(false);

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
      const [
        loadedStats,
        loadedSubs,
        loadedNotes,
        loadedGrouped,
        loadedTopicGrouped,
        loadedImpact,
        loadedStreak,
      ] = await Promise.all([
        getDatabaseStats(db),
        getSubjectsWithCount(db),
        getNotes(db),
        getNotesGroupedBySubject(db),
        getNotesGroupedByTopic(db),
        calculateAcademicImpact(db),
        getStudyHeatmapAndStreak(db),
      ]);
      setStats(loadedStats);
      setSubjectsWithCount(loadedSubs);
      setAllNotes(loadedNotes);
      setGroupedSections(loadedGrouped);
      setTopicSections(loadedTopicGrouped);
      setAcademicStats(loadedImpact);
      setStreakStats(loadedStreak);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
  }, [db]);

  // Subscribe to background AI queue updates
  useEffect(() => {
    const unsubscribe = subscribeQueue(() => {
      loadData();
    });
    return unsubscribe;
  }, [loadData]);

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

  // Count total favorite notes
  const favoriteCount = useMemo(() => {
    return allNotes.filter((n) => n.is_favorite === 1).length;
  }, [allNotes]);

  // Filtered Notes for Timeline
  const filteredTimelineNotes = useMemo(() => {
    if (!selectedSubjectId) return allNotes;
    if (selectedSubjectId === 'FAVORITES') {
      return allNotes.filter((n) => n.is_favorite === 1);
    }
    return allNotes.filter((n) => n.subject_id === selectedSubjectId);
  }, [allNotes, selectedSubjectId]);

  // Filtered Sections for Topic View
  const filteredTopicSections = useMemo(() => {
    if (!selectedSubjectId) return topicSections;
    if (selectedSubjectId === 'FAVORITES') {
      return topicSections
        .map((s) => ({
          ...s,
          data: s.data.filter((n) => n.is_favorite === 1),
        }))
        .filter((s) => s.data.length > 0);
    }
    return topicSections.filter((s) => s.subjectId === selectedSubjectId);
  }, [topicSections, selectedSubjectId]);

  // Filtered Sections for Grouped View
  const filteredGroupedSections = useMemo(() => {
    if (!selectedSubjectId) return groupedSections;
    if (selectedSubjectId === 'FAVORITES') {
      return groupedSections
        .map((s) => ({
          ...s,
          data: s.data.filter((n) => n.is_favorite === 1),
        }))
        .filter((s) => s.data.length > 0);
    }
    return groupedSections.filter((s) => s.subjectId === selectedSubjectId);
  }, [groupedSections, selectedSubjectId]);

  const selectedSubjectObj = useMemo(() => {
    if (!selectedSubjectId) return null;
    if (selectedSubjectId === 'FAVORITES') {
      return {
        id: 'FAVORITES',
        name: 'Catatan Ditandai',
        color: '#F59E0B',
        notes_count: favoriteCount,
      };
    }
    return subjectsWithCount.find((s) => s.id === selectedSubjectId) || null;
  }, [subjectsWithCount, selectedSubjectId, favoriteCount]);

  // Render Note Card — Living Notebook style
  const renderNoteCard = useCallback(
    ({ item }: { item: NoteWithSubject }) => {
      const hasValidImage =
        item.image_path &&
        (item.image_path.startsWith('file:') ||
          item.image_path.startsWith('http') ||
          item.image_path.startsWith('content:') ||
          item.image_path.startsWith('data:'));

      const spineColor = item.subject_color || theme.tint;
      const dogEarBehind = theme.background;
      const dogEarFlap = colorScheme === 'dark' ? '#302a21' : '#ece4d3';

      // Extract first line as title if available (e.g. "Sumber Hukum Formil")
      const lines = item.extracted_text
        ? item.extracted_text.split('\n').map((l) => l.trim()).filter(Boolean)
        : [];
      const noteTitle = item.title || lines[0] || item.subject_name || 'Catatan Kuliah';
      const snippetText = lines.length > 1
        ? lines.slice(1).join(' ')
        : (item.extracted_text || 'Belum ada transkripsi materi.');

      const isPending = item.ai_status === 'pending';
      const isProcessing = item.ai_status === 'processing';
      const isFailedPermanent = item.ai_status === 'failed_permanent';

      return (
        <TouchableOpacity
          style={[
            styles.noteCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
          activeOpacity={0.7}
          onPress={() => router.push(`/note/${item.id}`)}>
          {/* Subject spine — colored tape on notebook edge */}
          <View
            style={[
              styles.spineStrip,
              { backgroundColor: spineColor },
            ]}
          />

          {/* Dog-ear fold in top-right: amber if is_favorite, muted if 0 */}
          <TouchableOpacity
            style={styles.dogEarContainer}
            activeOpacity={0.7}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            onPress={async () => {
              if (Platform.OS !== 'web') {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                } catch {}
              }
              await toggleFavorite(db, item.id);
              loadData();
            }}>
            <View
              style={[
                styles.dogEarCutout,
                {
                  borderTopColor: dogEarBehind,
                  borderLeftColor: item.is_favorite === 1 ? '#F59E0B' : dogEarFlap,
                },
              ]}
            />
          </TouchableOpacity>

          <View style={styles.cardContentRow}>
            {/* Thumbnail — slightly taller, portrait feel */}
            <View
              style={[
                styles.thumbnailContainer,
                { backgroundColor: colorScheme === 'dark' ? '#302a21' : '#f1eadd' },
              ]}>
              {hasValidImage ? (
                <Image
                  source={{ uri: item.image_path }}
                  style={styles.thumbnailImage}
                  resizeMode="cover"
                />
              ) : item.source === 'manual' ? (
                <Ionicons name="pencil" size={24} color={theme.primary} />
              ) : (
                <Ionicons name="document-text" size={28} color={theme.tint} />
              )}
            </View>

            {/* Note Details */}
            <View style={styles.cardTextCol}>
              {/* Title — serif feel, slightly larger */}
              <Text
                numberOfLines={1}
                style={[styles.noteTitle, { color: theme.text }]}>
                {noteTitle}
              </Text>

              {/* Status Badge if in AI queue */}
              {isPending && (
                <View
                  style={[
                    styles.aiStatusBadge,
                    { backgroundColor: 'rgba(176, 124, 36, 0.12)', borderColor: theme.amber },
                  ]}>
                  <Ionicons name="time-outline" size={11} color={theme.amber} />
                  <Text style={[styles.aiStatusBadgeText, { color: theme.amber }]}>
                    {(item.retry_count || 0) > 0
                      ? 'Sedang menunggu AI, akan dicoba lagi...'
                      : 'Sedang menunggu AI...'}
                  </Text>
                </View>
              )}

              {isProcessing && (
                <View
                  style={[
                    styles.aiStatusBadge,
                    { backgroundColor: 'rgba(76, 70, 137, 0.12)', borderColor: theme.primary },
                  ]}>
                  <Ionicons name="sync" size={11} color={theme.primary} />
                  <Text style={[styles.aiStatusBadgeText, { color: theme.primary }]}>
                    Sedang menganalisis tulisan...
                  </Text>
                </View>
              )}

              {isFailedPermanent && (
                <TouchableOpacity
                  style={[
                    styles.aiStatusBadge,
                    { backgroundColor: 'rgba(220, 38, 38, 0.12)', borderColor: '#DC2626' },
                  ]}
                  onPress={async () => {
                    await resetNoteRetry(db, item.id);
                    triggerQueueProcessing();
                    loadData();
                  }}>
                  <Ionicons name="alert-circle-outline" size={11} color="#DC2626" />
                  <Text style={[styles.aiStatusBadgeText, { color: '#DC2626' }]}>
                    Gagal diproses · Coba Lagi Manual
                  </Text>
                </TouchableOpacity>
              )}

              {/* Snippet — italic serif feel, like a librarian's pencil note */}
              <Text
                numberOfLines={isPending || isProcessing ? 1 : 2}
                style={[styles.noteExcerpt, { color: theme.subtext }]}>
                {snippetText}
              </Text>

              {/* Bottom meta row */}
              <View style={styles.cardMetaRow}>
                <View style={styles.chipBadge}>
                  <View
                    style={[styles.chipDotSmall, { backgroundColor: spineColor }]}
                  />
                  <Text style={[styles.chipBadgeText, { color: theme.subtext }]}>
                    {item.subject_name || 'Umum'}
                  </Text>
                </View>
                <Text style={[styles.dateText, { color: theme.subtext }]}>
                  {item.date_taken}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [theme, colorScheme, router, db, loadData]
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
        <Ionicons name="sparkles" size={32} color="#d5a24a" />
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
          <Ionicons name="school" size={20} color={theme.success} />
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

      {/* Rekam Belajar StreakCard (Heatmap, Flame Streak, Spotify Wrapped Share) */}
      <StreakCard
        stats={streakStats}
        colorScheme={colorScheme}
        totalNotesCount={stats.notesCount}
        totalSubjectsCount={stats.subjectsCount}
        subjects={subjectsWithCount}
      />

      {/* Mata Kuliah Filter Carousel */}
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Mata Kuliah
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
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

          <TouchableOpacity
            style={[
              styles.addSubjectBtn,
              { backgroundColor: theme.primary, borderColor: theme.primary },
            ]}
            onPress={() => {
              if (Platform.OS !== 'web') {
                try {
                  Haptics.selectionAsync();
                } catch {}
              }
              setShowManualNote(true);
            }}>
            <Ionicons name="pencil" size={13} color="#FFFFFF" />
            <Text style={[styles.addSubjectBtnText, { color: '#FFFFFF' }]}>
              Tulis Lembar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.addSubjectBtn,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
            onPress={() => {
              if (Platform.OS !== 'web') {
                try {
                  Haptics.selectionAsync();
                } catch {}
              }
              setShowAddSubjectModal(true);
            }}>
            <Ionicons name="add-circle" size={15} color={theme.tint} />
            <Text style={[styles.addSubjectBtnText, { color: theme.tint }]}>
              + Matkul
            </Text>
          </TouchableOpacity>
        </View>
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
          {
            id: 'FAVORITES',
            name: 'Ditandai',
            color: '#F59E0B',
            notes_count: favoriteCount,
          },
          ...subjectsWithCount,
        ]}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsScroll}
        renderItem={({ item }) => {
          const isAll = item.id === 'ALL';
          const isFav = item.id === 'FAVORITES';
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
              {isFav ? (
                <Ionicons
                  name={isSelected ? 'bookmark' : 'bookmark-outline'}
                  size={13}
                  color={isSelected ? '#FFFFFF' : '#F59E0B'}
                  style={{ marginRight: 2 }}
                />
              ) : (
                <View
                  style={[
                    styles.chipDot,
                    { backgroundColor: isSelected ? '#FFFFFF' : item.color },
                  ]}
                />
              )}
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
            : viewMode === 'TOPIC'
            ? 'Catatan per Topik'
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
                viewMode === 'TOPIC' && { backgroundColor: theme.tint },
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  try {
                    Haptics.selectionAsync();
                  } catch {}
                }
                setViewMode('TOPIC');
              }}>
              <Ionicons
                name="folder-outline"
                size={16}
                color={viewMode === 'TOPIC' ? '#FFFFFF' : theme.subtext}
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
      <EmptyStateIllustration
        variant="notes"
        message="Belum ada catatan kuliah tersimpan"
        subMessage="Ambil foto binder tulisan tangan, papan tulis kelas, atau slide dosen. Notia AI akan otomatis menyusun dan menyimpannya di sini!"
        action={{
          label: 'Foto Catatan Sekarang',
          onPress: () => router.push('/camera'),
        }}
      />
    </View>
  );

  // Filter Empty State
  const renderFilterEmpty = () => (
    <View
      style={[
        styles.emptyCard,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}>
      <EmptyStateIllustration
        variant={selectedSubjectId === 'FAVORITES' ? 'notes' : 'topic'}
        message={
          selectedSubjectId === 'FAVORITES'
            ? 'Belum ada catatan yang ditandai'
            : `Belum ada catatan untuk "${selectedSubjectObj?.name || 'Kategori ini'}"`
        }
        subMessage={
          selectedSubjectId === 'FAVORITES'
            ? 'Tandai catatan kuliah penting dengan mengetuk lipatan kertas (dog-ear) di sudut kartu catatan.'
            : 'Foto materi kuliah ini sekarang agar tersimpan otomatis dalam folder mata kuliah ini.'
        }
        action={
          selectedSubjectId === 'FAVORITES'
            ? undefined
            : {
                label: 'Ambil Foto Catatan',
                onPress: () => router.push('/camera'),
              }
        }
      />
    </View>
  );

  const isGlobalEmpty = allNotes.length === 0;
  const isFilterEmpty = !isGlobalEmpty && selectedSubjectId !== null && filteredTimelineNotes.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {viewMode === 'TOPIC' && !selectedSubjectId ? (
        <SectionList
          sections={filteredTopicSections}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={isGlobalEmpty ? renderGlobalEmpty : renderFilterEmpty}
          renderItem={renderNoteCard}
          renderSectionHeader={({ section }) => {
            const isFirstInSubject = filteredTopicSections.findIndex((s) => s.subjectId === section.subjectId) === filteredTopicSections.indexOf(section);
            return (
              <View style={[styles.topicGroupHeaderContainer, { backgroundColor: theme.background }]}>
                {isFirstInSubject && (
                  <TouchableOpacity
                    style={styles.sectionHeaderBar}
                    activeOpacity={0.7}
                    onPress={() => section.subjectId !== 'unassigned' && router.push(`/subject/${section.subjectId}`)}>
                    <View
                      style={[
                        styles.sectionColorAccent,
                        { backgroundColor: section.subjectColor },
                      ]}
                    />
                    <Text style={[styles.sectionHeaderText, { color: theme.text }]}>
                      {section.subjectName}
                    </Text>
                    {section.subjectId !== 'unassigned' && (
                      <Ionicons name="chevron-forward" size={16} color={theme.subtext} style={{ marginLeft: 4 }} />
                    )}
                  </TouchableOpacity>
                )}

                {/* Sub-header Topik */}
                <View style={[styles.topicSubHeaderBar, isFirstInSubject ? { marginTop: 4 } : { marginTop: 12 }]}>
                  <Ionicons
                    name={section.topicId ? "folder-outline" : "remove-circle-outline"}
                    size={14}
                    color={section.topicId ? section.subjectColor : theme.subtext}
                  />
                  <Text
                    style={[
                      styles.topicSubHeaderText,
                      {
                        color: section.topicId ? theme.text : theme.subtext,
                        fontStyle: section.topicId ? 'normal' : 'italic',
                      },
                    ]}>
                    {section.topicName}
                  </Text>
                  <View style={styles.sectionBadge}>
                    <Text style={[styles.sectionBadgeText, { color: theme.subtext }]}>
                      {section.data.length} catatan
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
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
      ) : viewMode === 'GROUPED' && !selectedSubjectId ? (
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

      <AddSubjectModal
        visible={showAddSubjectModal}
        onClose={() => setShowAddSubjectModal(false)}
        onSubjectCreated={() => loadData()}
      />

      <ManualNoteSheet
        visible={showManualNote}
        onClose={() => setShowManualNote(false)}
        onSaved={() => loadData()}
        presetSubjectId={selectedSubjectId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  aiStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
    marginVertical: 4,
  },
  aiStatusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
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
  impactBanner: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  impactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  impactIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  impactTextCol: {
    flex: 1,
  },
  impactTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  impactSub: {
    fontSize: 11,
    lineHeight: 15,
  },
  impactShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  impactShareText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
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
  addSubjectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  addSubjectBtnText: {
    fontSize: 12,
    fontWeight: '700',
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
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    paddingLeft: 15,   // extra room for spine strip
    marginBottom: 10,
    overflow: 'hidden',
    position: 'relative' as const,
    // warm page-on-desk shadow
    ...Platform.select({
      ios: {
        shadowColor: '#1a1410',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  spineStrip: {
    position: 'absolute' as const,
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  dogEarContainer: {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    overflow: 'hidden',
    zIndex: 2,
  },
  dogEarCutout: {
    width: 0,
    height: 0,
    borderStyle: 'solid' as const,
    borderTopWidth: 14,
    borderLeftWidth: 14,
  },
  cardContentRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  thumbnailContainer: {
    width: 72,
    height: 84,    // taller, portrait feel
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  cardTextCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  noteTitle: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: 0.1,
  },
  noteExcerpt: {
    fontSize: 12.5,
    lineHeight: 18,
    fontStyle: 'italic',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  cardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  chipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  chipDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipBadgeText: {
    fontSize: 11,
    fontWeight: '500',
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
  topicGroupHeaderContainer: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  topicSubHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 20,
    paddingRight: 16,
    paddingVertical: 6,
  },
  topicSubHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
});
