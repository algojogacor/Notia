import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { searchNotes } from '@/src/db/database';
import { NoteWithSubject } from '@/src/types';

export default function SearchScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const router = useRouter();
  const db = useSQLiteContext();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NoteWithSubject[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const found = await searchNotes(db, query);
        setResults(found);
        setHasSearched(true);
      } catch (err) {
        console.error('Error during search:', err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, db]);

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
            placeholder="Cari kata kunci, rumus, atau konsep..."
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
      </View>

      {/* Content Area */}
      {query.trim().length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          showsVerticalScrollIndicator={false}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="search-outline" size={36} color={theme.tint} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            Pencarian Cepat Catatan Kuliah
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.subtext }]}>
            Ketik kata kunci, definisi rumus, atau materi penting. SQLite
            akan mencari teks di seluruh transkripsi foto catatan kuliahmu.
          </Text>

          <View style={styles.featureBox}>
            <Text style={[styles.featureBoxTitle, { color: theme.text }]}>
              Tips Pencarian:
            </Text>
            <Text style={[styles.featureBoxItem, { color: theme.subtext }]}>
              • Ketik nama topik, contoh: "Dijkstra", "Normalisasi", "ERD"
            </Text>
            <Text style={[styles.featureBoxItem, { color: theme.subtext }]}>
              • Ketik nama mata kuliah, contoh: "Sistem Operasi"
            </Text>
            <Text style={[styles.featureBoxItem, { color: theme.subtext }]}>
              • Fitur pencarian teks full-text (FTS) dioptimalkan di Phase 3
            </Text>
          </View>
        </ScrollView>
      ) : hasSearched && results.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={40} color={theme.subtext} />
          <Text style={[styles.emptyTitle, { color: theme.text, marginTop: 12 }]}>
            Tidak ada catatan yang cocok
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.subtext }]}>
            Tidak ditemukan catatan dengan kata kunci "{query}".
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.resultsList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.resultCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
              onPress={() => router.push(`/note/${item.id}`)}>
              <View style={styles.resultHeader}>
                <View
                  style={[
                    styles.subjectBadge,
                    { backgroundColor: item.subject_color || theme.tint },
                  ]}>
                  <Text style={styles.subjectBadgeText}>
                    {item.subject_name || 'Umum'}
                  </Text>
                </View>
                <Text style={[styles.resultDate, { color: theme.subtext }]}>
                  {item.date_taken}
                </Text>
              </View>
              <Text
                numberOfLines={3}
                style={[styles.resultText, { color: theme.text }]}>
                {item.extracted_text}
              </Text>
            </TouchableOpacity>
          )}
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
    paddingBottom: 8,
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
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
    marginTop: 20,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
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
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  featureBoxTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  featureBoxItem: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  resultsList: {
    padding: 16,
    gap: 12,
  },
  resultCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  subjectBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  resultDate: {
    fontSize: 11,
  },
  resultText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
