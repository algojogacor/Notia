
import React, { useEffect, useState, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';

import * as Haptics from 'expo-haptics';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import EmptyStateIllustration from '@/components/EmptyStateIllustration';
import { getSubjectById, getNotesBySubject, getTopicsBySubject, SUBJECT_PALETTE, softDeleteNote, deleteSubject } from '@/src/db/database';
import { NoteWithSubject, Subject, Topic } from '@/src/types';
import { exportSubjectBookletToPdf } from '@/src/services/pdfBooklet';

export default function SubjectArchiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [subject, setSubject] = useState<Subject | null>(null);
  const [notes, setNotes] = useState<NoteWithSubject[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [activeTopicFilter, setActiveTopicFilter] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    const subj = await getSubjectById(db, id);
    if (subj) setSubject(subj);
    const [n, tops] = await Promise.all([
      getNotesBySubject(db, id),
      getTopicsBySubject(db, id),
    ]);
    setNotes(n);
    setTopics(tops);
  };

  const subjectColor = subject ? (((SUBJECT_PALETTE as any)[subject.id] as string) || subject.color) : theme.tint;

  // Derived data
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
  const monthsPresent = useMemo(() => {
    const s = new Set<string>();
    notes.forEach(n => {
      const d = new Date(n.date_taken);
      s.add(`${d.getFullYear()}-${d.getMonth()}`);
    });
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [notes]);

  const displayedNotes = useMemo(() => {
    let result = notes;
    if (activeMonth) {
      result = result.filter(n => {
        const d = new Date(n.date_taken);
        return `${d.getFullYear()}-${d.getMonth()}` === activeMonth;
      });
    }
    if (activeTopicFilter !== null) {
      if (activeTopicFilter === 'none') {
        result = result.filter(n => !n.topic_id);
      } else {
        result = result.filter(n => n.topic_id === activeTopicFilter);
      }
    }
    return result;
  }, [notes, activeMonth, activeTopicFilter]);

  // Heatmap calculation (last 35 days)
  const heatmap = useMemo(() => {
    const days = 35;
    const result = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = notes.filter(n => n.date_taken.startsWith(dateStr)).length;
      result.push({ date: dateStr, count });
    }
    return result;
  }, [notes]);

  const toggleSelect = (noteId: string) => {
    const next = new Set(selected);
    if (next.has(noteId)) next.delete(noteId);
    else next.add(noteId);
    setSelected(next);
    if (next.size === 0) setSelectMode(false);
  };

  const handleLongPress = (noteId: string) => {
    setSelectMode(true);
    setSelected(new Set([noteId]));
  };

  const handlePressNote = (noteId: string) => {
    if (selectMode) {
      toggleSelect(noteId);
    } else {
      router.push(`/note/${noteId}`);
    }
  };

  const handleDeleteSelected = () => {
    Alert.alert('Pindah ke Keranjang', `Hapus sementara ${selected.size} catatan?`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: async () => {
        for (const nid of selected) {
          await softDeleteNote(db, nid);
        }
        setSelectMode(false);
        setSelected(new Set());
        loadData();
      }}
    ]);
  };

  const handleDeleteSubject = () => {
    if (!subject) return;

    Alert.alert(
      `Hapus Mata Kuliah ${subject.name}?`,
      `Seluruh lembar catatan (${notes.length} lembar) tidak akan dihapus, melainkan dipindahkan secara aman ke 'Catatan Umum'.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus Seksi',
          style: 'destructive',
          onPress: async () => {
            try {
              if (Platform.OS !== 'web') {
                try {
                  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch {}
              }
              await deleteSubject(db, subject.id);
              router.replace('/(tabs)');
            } catch (err: any) {
              Alert.alert('Gagal Menghapus', err.message || 'Terjadi kesalahan saat menghapus mata kuliah.');
            }
          },
        },
      ]
    );
  };

  if (!subject) return <View style={[styles.container, { backgroundColor: theme.background }]} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen 
        options={{ 
          title: 'Arsip Seksi', 
          headerBackTitle: 'Beranda',
          headerRight: () => (
            <TouchableOpacity 
              onPress={handleDeleteSubject}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ padding: 4 }}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          )
        }} 
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* Tab Divider Hero */}
        <View style={[styles.hero, { borderColor: theme.border }]}>
          <View style={[styles.tabEdge, { backgroundColor: subjectColor }]} />
          <View style={{ padding: 24, paddingLeft: 32 }}>
            <Text style={[styles.heroInitial, { color: subjectColor }]}>{subject.name.substring(0, 2).toUpperCase()}</Text>
            <Text style={[styles.heroTitle, { color: theme.text }]}>{subject.name}</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.text }]}>{notes.length}</Text>
                <Text style={[styles.statLabel, { color: theme.subtext }]}>Lembar</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.text }]}>{notes.filter(n => n.ai_status === 'done').length}</Text>
                <Text style={[styles.statLabel, { color: theme.subtext }]}>Diproses</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <TouchableOpacity 
                style={[styles.btn, { backgroundColor: subjectColor }]}
                onPress={() => exportSubjectBookletToPdf(subject, notes)}
              >
                <Ionicons name="book" size={16} color="#fff" />
                <Text style={styles.btnText}>Ekspor Booklet PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.btn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: subjectColor }]}
                onPress={() => router.push(`/practice?subjectId=${subject.id}` as any)}
              >
                <Ionicons name="albums" size={16} color={subjectColor} />
                <Text style={[styles.btnText, { color: subjectColor }]}>Latihan AI</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Heatmap */}
        <View style={styles.heatmapContainer}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Ritme Seksi Ini</Text>
          <View style={styles.heatmapGrid}>
            {heatmap.map((cell, i) => (
              <View 
                key={i} 
                style={[
                  styles.heatmapCell, 
                  { backgroundColor: cell.count > 0 ? subjectColor : theme.border, opacity: cell.count > 0 ? Math.min(1, 0.4 + cell.count * 0.2) : 0.3 }
                ]} 
              />
            ))}
          </View>
        </View>

        {/* Month Index Tabs */}
        {monthsPresent.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll} contentContainerStyle={{ paddingHorizontal: 20 }}>
            <TouchableOpacity 
              style={[styles.monthTab, !activeMonth && { backgroundColor: subjectColor, borderColor: subjectColor }]} 
              onPress={() => setActiveMonth(null)}
            >
              <Text style={[styles.monthText, !activeMonth ? { color: '#fff' } : { color: theme.subtext }]}>Semua</Text>
            </TouchableOpacity>
            {monthsPresent.map(m => {
              const [yyyy, mm] = m.split('-');
              const label = `${monthNames[parseInt(mm)]} ${yyyy}`;
              const active = activeMonth === m;
              return (
                <TouchableOpacity 
                  key={m} 
                  style={[styles.monthTab, { borderColor: theme.border }, active && { backgroundColor: subjectColor, borderColor: subjectColor }]}
                  onPress={() => setActiveMonth(m)}
                >
                  <Text style={[styles.monthText, active ? { color: '#fff' } : { color: theme.subtext }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Topic Filter Tabs */}
        <View style={styles.filterSectionContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
            <TouchableOpacity 
              style={[
                styles.topicTab, 
                activeTopicFilter === null && { backgroundColor: subjectColor, borderColor: subjectColor },
                { borderColor: theme.border }
              ]} 
              onPress={() => setActiveTopicFilter(null)}
            >
              <Text style={[styles.topicTabText, activeTopicFilter === null ? { color: '#fff' } : { color: theme.subtext }]}>Semua Topik</Text>
            </TouchableOpacity>
            {topics.map(t => {
              const isActive = activeTopicFilter === t.id;
              return (
                <TouchableOpacity 
                  key={t.id} 
                  style={[
                    styles.topicTab, 
                    isActive && { backgroundColor: subjectColor, borderColor: subjectColor },
                    { borderColor: theme.border }
                  ]}
                  onPress={() => setActiveTopicFilter(isActive ? null : t.id)}
                >
                  <Ionicons name="folder-outline" size={13} color={isActive ? '#fff' : theme.subtext} />
                  <Text style={[styles.topicTabText, isActive ? { color: '#fff' } : { color: theme.subtext }]}>{t.name}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity 
              style={[
                styles.topicTab, 
                activeTopicFilter === 'none' && { backgroundColor: subjectColor, borderColor: subjectColor },
                { borderColor: theme.border }
              ]}
              onPress={() => setActiveTopicFilter(activeTopicFilter === 'none' ? null : 'none')}
            >
              <Ionicons name="remove-circle-outline" size={13} color={activeTopicFilter === 'none' ? '#fff' : theme.subtext} />
              <Text style={[styles.topicTabText, activeTopicFilter === 'none' ? { color: '#fff' } : { color: theme.subtext }]}>Tanpa Topik</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Notes List */}
        <View style={styles.listContainer}>
          {displayedNotes.length === 0 ? (
            <EmptyStateIllustration
              variant="notes"
              message={`Belum ada lembar catatan di seksi ${subject?.name || ''}`}
              subMessage="Ambil foto materi kuliah atau binder tulisan tanganmu untuk menambahkannya ke sini."
              action={{
                label: 'Foto Catatan Sekarang',
                onPress: () => router.push('/camera'),
              }}
            />
          ) : (
            displayedNotes.map((note) => {
            const isSelected = selected.has(note.id);
            return (
              <TouchableOpacity
                key={note.id}
                activeOpacity={0.7}
                onPress={() => handlePressNote(note.id)}
                onLongPress={() => handleLongPress(note.id)}
                style={[
                  styles.noteCard, 
                  { backgroundColor: theme.card, borderColor: theme.border },
                  selectMode && isSelected && { borderColor: '#F59E0B', borderStyle: 'dashed', borderWidth: 2 }
                ]}
              >
                <View style={[styles.noteSpine, { backgroundColor: subjectColor }]} />
                <View style={styles.noteContent}>
                  <Text style={[styles.noteTitle, { color: theme.text }]} numberOfLines={1}>{note.title || 'Tanpa Judul'}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, marginBottom: 4 }}>
                    <Ionicons 
                      name={note.topic_id ? "folder" : "remove-circle-outline"} 
                      size={11} 
                      color={note.topic_id ? subjectColor : theme.subtext} 
                    />
                    <Text 
                      style={[
                        styles.noteTopicChipText, 
                        { 
                          color: note.topic_id ? subjectColor : theme.subtext,
                          fontStyle: note.topic_id ? 'normal' : 'italic'
                        }
                      ]}>
                      {note.topic_name || 'Tanpa Topik'}
                    </Text>
                  </View>
                  <Text style={[styles.noteDate, { color: theme.subtext }]}>
                    {new Date(note.date_taken).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </Text>
                  {note.summary && <Text style={[styles.noteSummary, { color: theme.subtext }]} numberOfLines={2}>{note.summary}</Text>}
                </View>
                {selectMode && (
                  <View style={[styles.checkCircle, { borderColor: isSelected ? '#F59E0B' : theme.border, backgroundColor: isSelected ? '#F59E0B' : 'transparent' }]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                )}
              </TouchableOpacity>
            );
          })
          )}
        </View>
      </ScrollView>

      {/* Bulk Action Bar */}
      {selectMode && (
        <Animated.View entering={FadeInUp} exiting={FadeOutDown} style={[styles.actionBar, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
          <Text style={[styles.actionText, { color: theme.text }]}>{`${selected.size} dipilih`}</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => { setSelectMode(false); setSelected(new Set()); }}>
              <Text style={{ color: theme.subtext, fontWeight: 'bold' }}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#EF4444' }]} onPress={handleDeleteSelected}>
              <Ionicons name="trash" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Hapus</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { margin: 20, borderWidth: 1, borderRadius: 16, backgroundColor: '#fff', overflow: 'hidden' },
  tabEdge: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 12 },
  heroInitial: { fontSize: 48, fontWeight: '900', opacity: 0.1, position: 'absolute', right: 20, top: 20 },
  heroTitle: { fontSize: 24, fontWeight: 'bold', fontFamily: 'serif', marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 24 },
  statItem: { alignItems: 'flex-start' },
  statValue: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { fontSize: 12 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  btnText: { fontSize: 13, fontWeight: 'bold', color: '#fff' },
  heatmapContainer: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 12 },
  heatmapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  heatmapCell: { width: 10, flexGrow: 1, height: 12, borderRadius: 2 },
  monthScroll: { marginBottom: 20 },
  monthTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  monthText: { fontSize: 13, fontWeight: 'bold' },
  listContainer: { paddingHorizontal: 20, gap: 12 },
  noteCard: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, overflow: 'hidden', paddingRight: 16, paddingVertical: 12, alignItems: 'center' },
  noteSpine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6 },
  noteContent: { flex: 1, paddingLeft: 20 },
  noteTitle: { fontSize: 16, fontWeight: 'bold', fontFamily: 'serif', marginBottom: 4 },
  noteDate: { fontSize: 12, marginBottom: 6 },
  noteSummary: { fontSize: 13, fontStyle: 'italic', lineHeight: 18 },
  checkCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 40, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 10 },
  actionText: { fontSize: 16, fontWeight: 'bold' },
  actionButtons: { flexDirection: 'row', gap: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f1f5f9' },
  filterSectionContainer: {
    marginBottom: 16,
  },
  topicTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  topicTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  noteTopicChipText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
