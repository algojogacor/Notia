import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSQLiteContext } from 'expo-sqlite';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { getSubjects, saveManualNote, findOrCreateSubject } from '@/src/db/database';
import { requestAiEditorDiff } from '@/src/services/groq';
import { Subject, NoteWithSubject, AiDiffSection, AiEditorResult } from '@/src/types';

interface ManualNoteSheetProps {
  visible: boolean;
  onClose: () => void;
  onSaved: (note: NoteWithSubject) => void;
  presetSubjectId?: string | null;
}

const DRAFT_KEY = '@notia_manual_note_draft';

export default function ManualNoteSheet({
  visible,
  onClose,
  onSaved,
  presetSubjectId,
}: ManualNoteSheetProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const db = useSQLiteContext();

  const [title, setTitle] = useState('');
  const [transcription, setTranscription] = useState('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(presetSubjectId ?? null);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Undo / Redo History
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // AI Targeted Diff Editor State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AiEditorResult | null>(null);
  const [pendingDiffs, setPendingDiffs] = useState<AiDiffSection[]>([]);

  // Selection range for toolbar insertion
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  const recordHistory = useCallback((newText: string) => {
    setHistory((prev) => {
      const upToCurrent = prev.slice(0, historyIndex + 1);
      return [...upToCurrent, newText];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  // Load subjects & draft on mount
  useEffect(() => {
    if (!visible) return;

    async function init() {
      try {
        const subs = await getSubjects(db);
        setSubjects(subs);
        if (!selectedSubjectId && subs.length > 0) {
          setSelectedSubjectId(presetSubjectId ?? subs[0].id);
        }

        // Try load draft
        const savedDraft = await AsyncStorage.getItem(DRAFT_KEY);
        if (savedDraft) {
          try {
            const parsed = JSON.parse(savedDraft);
            if (parsed.title || parsed.transcription) {
              setTitle(parsed.title || '');
              setTranscription(parsed.transcription || '');
              if (parsed.transcription) {
                setHistory([parsed.transcription]);
                setHistoryIndex(0);
              }
            }
          } catch {}
        }
      } catch (err) {
        console.warn('Error loading subjects for manual note:', err);
      }
    }
    init();
  }, [visible, db, presetSubjectId]);

  // Auto-save draft
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      AsyncStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ title, transcription, subjectId: selectedSubjectId })
      ).catch(() => {});
    }, 1000);
    return () => clearTimeout(timer);
  }, [title, transcription, selectedSubjectId, visible]);

  const handleTextChange = (text: string) => {
    setTranscription(text);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevText = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setTranscription(prevText);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    }
  };

  // Rich Text Formatting Actions
  const applyFormat = (prefix: string, suffix: string = '') => {
    recordHistory(transcription);
    const start = selection.start;
    const end = selection.end;
    const selectedText = transcription.substring(start, end);
    const replacement = `${prefix}${selectedText || 'teks'}${suffix}`;
    const nextText =
      transcription.substring(0, start) + replacement + transcription.substring(end);
    setTranscription(nextText);
    recordHistory(nextText);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const applyLinePrefix = (prefix: string) => {
    recordHistory(transcription);
    const start = selection.start;
    // find start of line
    const lastNewline = transcription.lastIndexOf('\n', start - 1);
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
    const nextText =
      transcription.substring(0, lineStart) + prefix + transcription.substring(lineStart);
    setTranscription(nextText);
    recordHistory(nextText);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  // AI Targeted Diff Editor Trigger
  const handleOpenAiEditor = () => {
    if (!transcription.trim()) {
      Alert.alert('Catatan Kosong', 'Tulis materi terlebih dahulu sebelum meminta bantuan editor AI.');
      return;
    }
    setAiPrompt('');
    setAiResult(null);
    setPendingDiffs([]);
    setShowAiModal(true);
  };

  const handleRequestAi = async () => {
    if (!aiPrompt.trim()) {
      Alert.alert('Instruksi Kosong', 'Ketik instruksi apa yang ingin AI perbaiki atau buatkan.');
      return;
    }

    setIsAiLoading(true);
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      const result = await requestAiEditorDiff({
        fullText: transcription,
        userPrompt: aiPrompt.trim(),
        noteTitle: title.trim(),
      });
      setAiResult(result);
      setPendingDiffs(result.diffs);
    } catch (err: any) {
      Alert.alert('Gagal Memproses AI', err.message || 'Terjadi gangguan saat menghubungi AI.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Accept a specific section diff
  const handleAcceptDiff = (diff: AiDiffSection) => {
    recordHistory(transcription);
    let nextText = transcription;

    if (diff.type === 'replace' || diff.type === 'delete') {
      if (diff.original && nextText.includes(diff.original)) {
        nextText = nextText.replace(diff.original, diff.suggested);
      } else {
        // Fallback if verbatim match shifted: append or replace closest
        nextText = nextText ? `${nextText}\n\n${diff.suggested}` : diff.suggested;
      }
    } else if (diff.type === 'insert' || diff.type === 'diagram') {
      nextText = nextText ? `${nextText}\n\n${diff.suggested}` : diff.suggested;
    }

    setTranscription(nextText);
    recordHistory(nextText);

    // Remove accepted diff from active diff list
    setPendingDiffs((prev) => prev.filter((d) => d.id !== diff.id));

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

  // Reject a specific section diff
  const handleRejectDiff = (diffId: string) => {
    setPendingDiffs((prev) => prev.filter((d) => d.id !== diffId));
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  // Save manual note to SQLite
  const handleSaveNote = async () => {
    const cleanTitle = title.trim();
    const cleanText = transcription.trim();

    if (!cleanTitle) {
      Alert.alert('Judul Wajib Diisi', 'Berikan judul catatan lembar ini sebelum menyimpan.');
      return;
    }
    if (!cleanText) {
      Alert.alert('Isi Catatan Kosong', 'Tulis materi atau rumus sebelum menyimpan ke binder.');
      return;
    }

    setIsSaving(true);
    try {
      const saved = await saveManualNote(db, {
        title: cleanTitle,
        transcription: cleanText,
        subjectId: selectedSubjectId,
      });

      // Clear draft
      await AsyncStorage.removeItem(DRAFT_KEY);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      onSaved(saved);
      onClose();
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err.message || 'Terjadi kendala saat menyimpan catatan.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateSubject = async () => {
    if (!newSubjectName.trim()) return;
    try {
      const created = await findOrCreateSubject(db, newSubjectName.trim());
      setSubjects((prev) => [...prev, created]);
      setSelectedSubjectId(created.id);
      setNewSubjectName('');
      setIsCreatingSubject(false);
    } catch (err: any) {
      Alert.alert('Gagal Membuat Mata Kuliah', err.message);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.desk }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.rule, backgroundColor: theme.paper }]}>
          <View style={styles.headerLeft}>
            <Text style={[styles.eyebrow, { color: theme.amber }]}>NOTIA · LEMBAR TULIS</Text>
            <Text style={[styles.headerTitle, { color: theme.ink }]}>Tulis Catatan Manual</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.ink} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Title Input */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: theme.ink }]}>Judul Catatan</Text>
            <TextInput
              style={[
                styles.titleInput,
                { backgroundColor: theme.paper, borderColor: theme.rule, color: theme.ink },
              ]}
              placeholder="cth. Teori Relativitas Khusus & Transformasi Lorentz"
              placeholderTextColor={colorScheme === 'dark' ? '#7A7265' : '#A0988A'}
              value={title}
              onChangeText={setTitle}
              maxLength={120}
            />
          </View>

          {/* Subject Selector */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: theme.ink }]}>Mata Kuliah</Text>
              {!isCreatingSubject && (
                <TouchableOpacity
                  onPress={() => setIsCreatingSubject(true)}
                  style={styles.addSubjectLink}
                >
                  <Ionicons name="add" size={14} color={theme.primary} />
                  <Text style={[styles.addSubjectText, { color: theme.primary }]}>Tambah Matkul</Text>
                </TouchableOpacity>
              )}
            </View>

            {isCreatingSubject && (
              <View style={[styles.createSubjectRow, { backgroundColor: theme.paper, borderColor: theme.rule }]}>
                <TextInput
                  style={[styles.createSubjectInput, { color: theme.ink }]}
                  placeholder="Nama mata kuliah baru..."
                  placeholderTextColor={colorScheme === 'dark' ? '#7A7265' : '#A0988A'}
                  value={newSubjectName}
                  onChangeText={setNewSubjectName}
                  autoFocus
                />
                <TouchableOpacity
                  onPress={handleCreateSubject}
                  style={[styles.createSubjectBtn, { backgroundColor: theme.primary }]}
                >
                  <Text style={styles.createSubjectBtnText}>Pakai</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setIsCreatingSubject(false)}
                  style={styles.createSubjectCancelBtn}
                >
                  <Ionicons name="close" size={18} color={theme.ink} />
                </TouchableOpacity>
              </View>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subjectScroll}>
              {subjects.map((sub) => {
                const isSelected = sub.id === selectedSubjectId;
                return (
                  <TouchableOpacity
                    key={sub.id}
                    onPress={() => setSelectedSubjectId(sub.id)}
                    style={[
                      styles.subjectChip,
                      {
                        backgroundColor: isSelected ? sub.color : theme.paper,
                        borderColor: isSelected ? sub.color : theme.rule,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.subjectDot,
                        { backgroundColor: isSelected ? '#FFFFFF' : sub.color },
                      ]}
                    />
                    <Text
                      style={[
                        styles.subjectChipText,
                        { color: isSelected ? '#FFFFFF' : theme.ink },
                      ]}
                    >
                      {sub.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Rich Text Toolbar */}
          <View style={[styles.toolbar, { backgroundColor: theme.paper, borderColor: theme.rule }]}>
            <TouchableOpacity
              onPress={() => applyFormat('**', '**')}
              style={styles.toolBtn}
              accessibilityLabel="Tebal"
            >
              <Text style={[styles.toolBtnText, { fontWeight: 'bold', color: theme.ink }]}>B</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => applyFormat('*', '*')}
              style={styles.toolBtn}
              accessibilityLabel="Miring"
            >
              <Text style={[styles.toolBtnText, { fontStyle: 'italic', color: theme.ink }]}>I</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => applyLinePrefix('# ')}
              style={styles.toolBtn}
              accessibilityLabel="Heading"
            >
              <Text style={[styles.toolBtnText, { fontWeight: '700', color: theme.ink }]}>H1</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => applyLinePrefix('## ')}
              style={styles.toolBtn}
              accessibilityLabel="Subheading"
            >
              <Text style={[styles.toolBtnText, { fontWeight: '600', color: theme.ink }]}>H2</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => applyLinePrefix('- ')}
              style={styles.toolBtn}
              accessibilityLabel="Bullet list"
            >
              <Ionicons name="list" size={18} color={theme.ink} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleUndo}
              disabled={historyIndex <= 0}
              style={[styles.toolBtn, historyIndex <= 0 && { opacity: 0.3 }]}
              accessibilityLabel="Undo"
            >
              <Ionicons name="arrow-undo" size={18} color={theme.ink} />
            </TouchableOpacity>

            <View style={styles.toolDivider} />

            {/* AI Targeted Editor Button */}
            <TouchableOpacity
              onPress={handleOpenAiEditor}
              style={[styles.aiToolBtn, { backgroundColor: theme.primary }]}
            >
              <Ionicons name="sparkles" size={15} color="#FFFFFF" />
              <Text style={styles.aiToolBtnText}>Edit AI</Text>
            </TouchableOpacity>
          </View>

          {/* Note Body (Paper Lines Texture) */}
          <View style={styles.section}>
            <View style={[styles.paperCard, { backgroundColor: theme.paper, borderColor: theme.rule }]}>
              {/* Margin line accent */}
              <View style={[styles.marginLine, { backgroundColor: theme.margin }]} />

              <TextInput
                style={[styles.bodyInput, { color: theme.ink }]}
                multiline
                scrollEnabled={false}
                placeholder="Mulai tulis materi perkuliahan, teorema, poin dosen, atau rumus di sini..."
                placeholderTextColor={colorScheme === 'dark' ? '#7A7265' : '#A0988A'}
                value={transcription}
                onChangeText={handleTextChange}
                onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                textAlignVertical="top"
              />
            </View>
            <Text style={[styles.charCount, { color: theme.ink }]}>
              {transcription.trim().split(/\s+/).filter(Boolean).length} kata · {transcription.length} karakter
            </Text>
          </View>
        </ScrollView>

        {/* Footer Actions */}
        <View style={[styles.footer, { backgroundColor: theme.paper, borderTopColor: theme.rule }]}>
          <TouchableOpacity onPress={onClose} style={[styles.cancelBtn, { borderColor: theme.rule }]}>
            <Text style={[styles.cancelBtnText, { color: theme.ink }]}>Batal</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSaveNote}
            disabled={isSaving}
            style={[styles.saveBtn, { backgroundColor: theme.primary }]}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>Simpan ke Binder</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ========================================================================= */}
        {/* MODAL: AI TARGETED DIFF EDITOR (Cursor / VS Code Inline Diff Style) */}
        {/* ========================================================================= */}
        <Modal
          visible={showAiModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAiModal(false)}
        >
          <View style={styles.diffModalOverlay}>
            <View style={[styles.diffModalContent, { backgroundColor: theme.paper, borderColor: theme.rule }]}>
              <View style={styles.diffHeader}>
                <View style={styles.diffHeaderTitleRow}>
                  <Ionicons name="sparkles" size={18} color={theme.amber} />
                  <Text style={[styles.diffTitle, { color: theme.ink }]}>Editor AI Terarah (Targeted Diff)</Text>
                </View>
                <TouchableOpacity onPress={() => setShowAiModal(false)}>
                  <Ionicons name="close" size={22} color={theme.ink} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.diffSubtitle, { color: theme.ink }]}>
                AI hanya akan mengedit atau menambahkan bagian yang diminta tanpa mengubah isi lainnya.
              </Text>

              {/* Prompt Input */}
              <View style={[styles.aiPromptContainer, { borderColor: theme.rule, backgroundColor: theme.desk }]}>
                <TextInput
                  style={[styles.aiPromptInput, { color: theme.ink }]}
                  placeholder="Contoh: rapikan alur paragraf 2, buatkan flowchart proses, rangkum poin penting..."
                  placeholderTextColor={colorScheme === 'dark' ? '#7A7265' : '#A0988A'}
                  value={aiPrompt}
                  onChangeText={setAiPrompt}
                  multiline
                />
                <TouchableOpacity
                  onPress={handleRequestAi}
                  disabled={isAiLoading}
                  style={[styles.aiSubmitBtn, { backgroundColor: theme.primary }]}
                >
                  {isAiLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="send" size={14} color="#FFFFFF" />
                      <Text style={styles.aiSubmitBtnText}>Kirim</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Suggestions & Diff List */}
              <ScrollView style={styles.diffScrollView}>
                {aiResult && (
                  <View style={[styles.explanationCard, { backgroundColor: 'rgba(176, 124, 36, 0.12)' }]}>
                    <Text style={[styles.explanationText, { color: theme.amber }]}>
                      💡 {aiResult.explanation}
                    </Text>
                  </View>
                )}

                {pendingDiffs.map((diff) => (
                  <View
                    key={diff.id}
                    style={[styles.diffCard, { borderColor: theme.rule, backgroundColor: theme.desk }]}
                  >
                    <View style={styles.diffTypeBadgeRow}>
                      <Text style={[styles.diffTypeBadge, { color: theme.primary }]}>
                        {diff.diagram_type
                          ? `DIAGRAM: ${diff.diagram_type.toUpperCase()}`
                          : diff.type.toUpperCase()}
                      </Text>
                    </View>

                    {/* Original / Deleted Section (-) */}
                    {diff.original ? (
                      <View style={styles.diffOriginalBox}>
                        <View style={styles.diffTagRow}>
                          <Text style={styles.diffMinusTag}>(-)</Text>
                          <Text style={styles.diffTagLabel}>Bagian yang Dihapus / Diganti</Text>
                        </View>
                        <Text style={styles.diffOriginalText}>{diff.original}</Text>
                      </View>
                    ) : null}

                    {/* Suggested Section (+) */}
                    <View style={styles.diffSuggestedBox}>
                      <View style={styles.diffTagRow}>
                        <Text style={styles.diffPlusTag}>(+)</Text>
                        <Text style={styles.diffTagLabel}>Saran Baru</Text>
                      </View>
                      <Text
                        style={[
                          styles.diffSuggestedText,
                          diff.diagram_type ? styles.diagramFont : undefined,
                        ]}
                      >
                        {diff.suggested}
                      </Text>
                    </View>

                    {/* Per-Section Action Buttons */}
                    <View style={styles.diffActionRow}>
                      <TouchableOpacity
                        onPress={() => handleRejectDiff(diff.id)}
                        style={[styles.rejectBtn, { borderColor: theme.rule }]}
                      >
                        <Ionicons name="close" size={16} color="#DC2626" />
                        <Text style={styles.rejectBtnText}>Tolak</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleAcceptDiff(diff)}
                        style={[styles.acceptBtn, { backgroundColor: theme.sage }]}
                      >
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        <Text style={styles.acceptBtnText}>Terima (Terapkan)</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                {aiResult && pendingDiffs.length === 0 && (
                  <View style={styles.diffEmptyState}>
                    <Ionicons name="checkmark-done-circle" size={32} color={theme.sage} />
                    <Text style={[styles.diffEmptyText, { color: theme.ink }]}>
                      Semua saran diff telah diproses!
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Close Diff Button */}
              <TouchableOpacity
                onPress={() => setShowAiModal(false)}
                style={[styles.diffDoneBtn, { backgroundColor: theme.primary }]}
              >
                <Text style={styles.diffDoneBtnText}>Selesai Meninjau</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  closeButton: {
    padding: 6,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  section: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.8,
    marginBottom: 6,
  },
  addSubjectLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  addSubjectText: {
    fontSize: 12,
    fontWeight: '600',
  },
  titleInput: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '500',
  },
  createSubjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    gap: 8,
  },
  createSubjectInput: {
    flex: 1,
    fontSize: 13,
    height: 36,
  },
  createSubjectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  createSubjectBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  createSubjectCancelBtn: {
    padding: 4,
  },
  subjectScroll: {
    flexDirection: 'row',
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    gap: 6,
  },
  subjectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  subjectChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    gap: 4,
  },
  toolBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  toolBtnText: {
    fontSize: 14,
  },
  toolDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 4,
  },
  aiToolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
    marginLeft: 'auto',
  },
  aiToolBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  paperCard: {
    position: 'relative',
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 260,
    paddingTop: 12,
    paddingBottom: 16,
    paddingRight: 14,
    paddingLeft: 34,
  },
  marginLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 24,
    width: 1.5,
  },
  bodyInput: {
    fontSize: 14,
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    minHeight: 240,
  },
  charCount: {
    fontSize: 11,
    opacity: 0.6,
    textAlign: 'right',
    marginTop: 6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  diffModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  diffModalContent: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
  },
  diffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  diffHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  diffTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  diffSubtitle: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 12,
  },
  aiPromptContainer: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginBottom: 12,
  },
  aiPromptInput: {
    fontSize: 13,
    minHeight: 48,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  aiSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 6,
    gap: 6,
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
  },
  aiSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  diffScrollView: {
    maxHeight: 320,
    marginBottom: 12,
  },
  explanationCard: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  explanationText: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },
  diffCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
  },
  diffTypeBadgeRow: {
    marginBottom: 6,
  },
  diffTypeBadge: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  diffOriginalBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  diffTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  diffMinusTag: {
    color: '#DC2626',
    fontWeight: 'bold',
    fontSize: 12,
  },
  diffPlusTag: {
    color: '#16A34A',
    fontWeight: 'bold',
    fontSize: 12,
  },
  diffTagLabel: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.8,
  },
  diffOriginalText: {
    color: '#DC2626',
    fontSize: 12,
    lineHeight: 18,
    textDecorationLine: 'line-through',
  },
  diffSuggestedBox: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#22C55E',
  },
  diffSuggestedText: {
    color: '#15803D',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  diagramFont: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
  diffActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  rejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  rejectBtnText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '600',
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  diffEmptyState: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  diffEmptyText: {
    fontSize: 13,
    fontWeight: '600',
  },
  diffDoneBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  diffDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
