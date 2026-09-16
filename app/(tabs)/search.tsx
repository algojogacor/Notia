import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Image,
  Platform,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { searchNotesAdvanced, getSubjects } from '@/src/db/database';
import { NoteWithSubject, Subject } from '@/src/types';

export default function SearchScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const db = useSQLiteContext();

  const [query, setQuery] = useState('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [results, setResults] = useState<NoteWithSubject[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Load available subjects
  const loadSubjects = useCallback(async () => {
    try {
      const subs = await getSubjects(db);
      setSubjects(subs);
    } catch (err) {
      console.error('Error loading subjects:', err);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadSubjects();
    }, [loadSubjects])
  );

  // Perform search query
  useEffect(() => {
    const hasQuery = query.trim().length > 0;
    const hasFilter = Boolean(selectedSubjectId);

    if (!hasQuery && !hasFilter) {
      setResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await searchNotesAdvanced(db, query, selectedSubjectId);
        setResults(found);
        setHasSearched(true);
      } catch (err) {
        console.error('Error during search:', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, selectedSubjectId, db]);

  const clearSearch = () => {
    setQuery('');
    setSelectedSubjectId(null);
    setResults([]);
    setHasSearched(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Search Input Bar */}
      <View style={styles.searchBarContainer}>
        <View
          style={[
            styles.inputWrapper,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}>
          <Ionicons name="search" size={20} color={theme.tabIconDefault} />
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Cari rumus, materi, atau kata kunci..."
            placeholderTextColor={theme.subtext}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons
                name="close-circle"
                size={18}
                color={theme.tabIconDefault}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Scope Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsScroll}>
          <TouchableOpacity
            style={[
              styles.filterChip,
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
                styles.filterChipText,
                { color: selectedSubjectId === null ? '#FFFFFF' : theme.text },
              ]}>
              Semua Matkul
            </Text>
          </TouchableOpacity>

          {subjects.map((sub) => {
            const isSelected = selectedSubjectId === sub.id;
            return (
              <TouchableOpacity
                key={sub.id}
                style={[
                  styles.filterChip,
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
                    { backgroundColor: isSelected ? '#FFFFFF' : sub.color },
                  ]}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    { color: isSelected ? '#FFFFFF' : theme.text },
                  ]}>
                  {sub.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Results Counter Bar */}
        {hasSearched && (
          <View style={styles.resultsInfoRow}>
            <Text style={[styles.resultsInfoText, { color: theme.subtext }]}>
              {results.length} catatan ditemukan
              {query ? ` untuk "${query}"` : ''}
            </Text>
            {(query.length > 0 || selectedSubjectId !== null) && (
              <TouchableOpacity onPress={clearSearch}>
                <Text style={[styles.clearFilterText, { color: theme.tint }]}>
                  Reset
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Main Content Area */}
      {!hasSearched ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          showsVerticalScrollIndicator={false}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="search-outline" size={38} color={theme.tint} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            Pencarian Cepat Catatan Kuliah
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.subtext }]}>
            Ketik kata kunci, definisi rumus, atau materi penting. SQLite
            akan mencari secara instan di seluruh transkripsi foto catatan kuliahmu.
          </Text>

          <View
            style={[
              styles.featureBox,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}>
            <Text style={[styles.featureBoxTitle, { color: theme.text }]}>
              💡 Tips Pencarian Cepat UTS/UAS:
            </Text>
            <Text style={[styles.featureBoxItem, { color: theme.subtext }]}>
              • Ketik istilah algoritma: "Dijkstra", "Kruskal", "Binary Search"
            </Text>
            <Text style={[styles.featureBoxItem, { color: theme.subtext }]}>
              • Ketik topik spesifik: "Normalisasi 3NF", "Process Threading"
            </Text>
            <Text style={[styles.featureBoxItem, { color: theme.subtext }]}>
              • Pilih filter chip mata kuliah di atas untuk menyaring per mata kuliah
            </Text>
          </View>
        </ScrollView>
      ) : results.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={44} color={theme.subtext} />
          <Text style={[styles.emptyTitle, { color: theme.text, marginTop: 12 }]}>
            Tidak ada catatan yang cocok
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.subtext }]}>
            Tidak ditemukan catatan dengan kata kunci "{query}". Coba cari kata kunci lain atau pilih filter mata kuliah yang berbeda.
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.resultsList}
          renderItem={({ item }) => {
            const hasValidImage =
              item.image_path &&
              (item.image_path.startsWith('file:') ||
                item.image_path.startsWith('http') ||
                item.image_path.startsWith('content:') ||
                item.image_path.startsWith('data:'));

            return (
              <TouchableOpacity
                style={[
                  styles.resultCard,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
                activeOpacity={0.7}
                onPress={() => router.push(`/note/${item.id}`)}>
                <View style={styles.cardContentRow}>
                  {/* Thumbnail */}
                  <View
                    style={[
                      styles.thumbnailContainer,
                      {
                        backgroundColor:
                          colorScheme === 'dark' ? '#1E293B' : '#EEF2FF',
                      },
                    ]}>
                    {hasValidImage ? (
                      <Image
                        source={{ uri: item.image_path }}
                        style={styles.thumbnailImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons
                        name="document-text"
                        size={28}
                        color={theme.tint}
                      />
                    )}
                  </View>

                  {/* Details */}
                  <View style={styles.cardTextCol}>
                    <View style={styles.cardMetaRow}>
                      <View
                        style={[
                          styles.subjectBadge,
                          {
                            backgroundColor:
                              item.subject_color || theme.tint,
                          },
                        ]}>
                        <Text style={styles.subjectBadgeText}>
                          {item.subject_name || 'Umum'}
                        </Text>
                      </View>
                      <Text
                        style={[styles.resultDate, { color: theme.subtext }]}>
                        {item.date_taken}
                      </Text>
                    </View>

                    <Text
                      numberOfLines={2}
                      style={[styles.resultText, { color: theme.text }]}>
                      {item.extracted_text}
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={theme.tabIconDefault}
                    style={{ alignSelf: 'center' }}
                  />
                </View>
              </TouchableOpacity>
            );
          }}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBarContainer: {
    padding: 16,
    paddingBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  filterChipsScroll: {
    gap: 8,
    paddingVertical: 12,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resultsInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 8,
  },
  resultsInfoText: {
    fontSize: 12,
    fontWeight: '600',
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  featureBox: {
    width: '100%',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  featureBoxTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  featureBoxItem: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  resultsList: {
    padding: 16,
    paddingTop: 4,
    gap: 10,
  },
  resultCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  cardContentRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  thumbnailContainer: {
    width: 64,
    height: 64,
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
  resultDate: {
    fontSize: 11,
  },
  resultText: {
    fontSize: 12,
    lineHeight: 17,
  },
});
