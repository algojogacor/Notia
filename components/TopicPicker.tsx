import React, { useState, useEffect, useCallback } from 'react';
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
import { useSQLiteContext } from 'expo-sqlite';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import {
  getTopicsBySubject,
  createTopic,
  renameTopic,
  deleteTopic,
} from '@/src/db/database';
import { Topic } from '@/src/types';

interface TopicPickerProps {
  visible: boolean;
  onClose: () => void;
  subjectId: string | null;
  subjectName?: string | null;
  subjectColor?: string | null;
  selectedTopicId: string | null;
  onSelectTopic: (topicId: string | null, topicName?: string | null) => void;
}

export default function TopicPicker({
  visible,
  onClose,
  subjectId,
  subjectName,
  subjectColor,
  selectedTopicId,
  onSelectTopic,
}: TopicPickerProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const db = useSQLiteContext();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(false);

  // New topic inline form
  const [isCreating, setIsCreating] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  // Rename topic inline form
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isSubmittingRename, setIsSubmittingRename] = useState(false);

  const loadTopics = useCallback(async () => {
    if (!subjectId) {
      setTopics([]);
      return;
    }
    setLoading(true);
    try {
      const data = await getTopicsBySubject(db, subjectId);
      setTopics(data);
    } catch (err) {
      console.error('Error loading topics:', err);
    } finally {
      setLoading(false);
    }
  }, [db, subjectId]);

  useEffect(() => {
    if (visible) {
      setIsCreating(false);
      setNewTopicName('');
      setEditingTopicId(null);
      setEditingName('');
      loadTopics();
    }
  }, [visible, loadTopics]);

  const handleSelect = (topicId: string | null, name: string | null) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.selectionAsync();
      } catch {}
    }
    onSelectTopic(topicId, name);
    onClose();
  };

  const handleCreate = async () => {
    const trimmed = newTopicName.trim();
    if (!trimmed || !subjectId) return;

    setIsSubmittingNew(true);
    try {
      const created = await createTopic(db, subjectId, trimmed);
      if (Platform.OS !== 'web') {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }
      setNewTopicName('');
      setIsCreating(false);
      await loadTopics();
      // Automatically select created topic
      onSelectTopic(created.id, created.name);
      onClose();
    } catch (err: any) {
      Alert.alert('Gagal Membuat Topik', err.message || 'Terjadi kesalahan.');
    } finally {
      setIsSubmittingNew(false);
    }
  };

  const handleStartRename = (topic: Topic) => {
    setEditingTopicId(topic.id);
    setEditingName(topic.name);
  };

  const handleSaveRename = async (topicId: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) return;

    setIsSubmittingRename(true);
    try {
      await renameTopic(db, topicId, trimmed);
      setEditingTopicId(null);
      setEditingName('');
      await loadTopics();
      if (selectedTopicId === topicId) {
        onSelectTopic(topicId, trimmed);
      }
    } catch (err: any) {
      Alert.alert('Gagal Mengubah Nama', err.message || 'Terjadi kesalahan.');
    } finally {
      setIsSubmittingRename(false);
    }
  };

  const handleDelete = (topic: Topic) => {
    Alert.alert(
      'Hapus Topik',
      `Hapus topik "${topic.name}"? Catatan di dalamnya tidak akan terhapus, tetapi akan menjadi "Tanpa Topik".`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTopic(db, topic.id);
              if (selectedTopicId === topic.id) {
                onSelectTopic(null, null);
              }
              await loadTopics();
            } catch (err: any) {
              Alert.alert('Gagal Menghapus', err.message || 'Terjadi kesalahan.');
            }
          },
        },
      ]
    );
  };

  const accentColor = subjectColor || theme.tint;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View
          style={[
            styles.sheetContainer,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}>
          {/* Header Indicator */}
          <View style={styles.dragHandleContainer}>
            <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />
          </View>

          {/* Title Row */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.titleWithBadge}>
                <Ionicons name="folder-open" size={18} color={accentColor} />
                <Text style={[styles.sheetTitle, { color: theme.text }]}>
                  Pilih Topik
                </Text>
              </View>
              {subjectName && (
                <Text style={[styles.subjectSubtitle, { color: theme.subtext }]}>
                  Mata Kuliah: <Text style={{ color: accentColor, fontWeight: '600' }}>{subjectName}</Text>
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={theme.subtext} />
            </TouchableOpacity>
          </View>

          {!subjectId ? (
            <View style={styles.emptySubjectContainer}>
              <Ionicons name="school-outline" size={40} color={theme.subtext} />
              <Text style={[styles.emptySubjectText, { color: theme.subtext }]}>
                Pilih mata kuliah terlebih dahulu untuk mengelola topik.
              </Text>
            </View>
          ) : (
            <>
              {/* Topics List */}
              <ScrollView style={styles.topicsScroll} contentContainerStyle={styles.topicsListContent}>
                {/* 1. Opsi "Tanpa Topik" Selalu Paling Atas */}
                <TouchableOpacity
                  style={[
                    styles.topicItem,
                    selectedTopicId === null && {
                      backgroundColor: colorScheme === 'dark' ? '#2c251d' : '#fef8ee',
                      borderColor: accentColor,
                    },
                    { borderColor: theme.border },
                  ]}
                  onPress={() => handleSelect(null, null)}>
                  <View style={styles.topicItemLeft}>
                    <Ionicons
                      name="remove-circle-outline"
                      size={18}
                      color={selectedTopicId === null ? accentColor : theme.subtext}
                    />
                    <Text
                      style={[
                        styles.topicName,
                        { color: selectedTopicId === null ? accentColor : theme.text },
                        selectedTopicId === null && { fontWeight: '700' },
                      ]}>
                      Tanpa Topik
                    </Text>
                  </View>
                  {selectedTopicId === null && (
                    <Ionicons name="checkmark-circle" size={20} color={accentColor} />
                  )}
                </TouchableOpacity>

                {/* Loading indicator */}
                {loading && (
                  <View style={{ paddingVertical: 16 }}>
                    <ActivityIndicator size="small" color={accentColor} />
                  </View>
                )}

                {/* 2. List Topik Mata Kuliah */}
                {topics.map((topic) => {
                  const isSelected = selectedTopicId === topic.id;
                  const isEditingThis = editingTopicId === topic.id;

                  if (isEditingThis) {
                    return (
                      <View
                        key={topic.id}
                        style={[
                          styles.editInlineRow,
                          { backgroundColor: theme.background, borderColor: accentColor },
                        ]}>
                        <TextInput
                          style={[styles.editInlineInput, { color: theme.text }]}
                          value={editingName}
                          onChangeText={setEditingName}
                          autoFocus
                          placeholder="Nama topik..."
                          placeholderTextColor={theme.subtext}
                        />
                        <TouchableOpacity
                          style={[styles.miniActionBtn, { backgroundColor: accentColor }]}
                          disabled={isSubmittingRename}
                          onPress={() => handleSaveRename(topic.id)}>
                          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.miniActionBtn, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}
                          onPress={() => setEditingTopicId(null)}>
                          <Ionicons name="close" size={16} color={theme.subtext} />
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  return (
                    <TouchableOpacity
                      key={topic.id}
                      style={[
                        styles.topicItem,
                        isSelected && {
                          backgroundColor: colorScheme === 'dark' ? '#2c251d' : '#fef8ee',
                          borderColor: accentColor,
                        },
                        { borderColor: theme.border },
                      ]}
                      onPress={() => handleSelect(topic.id, topic.name)}>
                      <View style={styles.topicItemLeft}>
                        <Ionicons
                          name="folder"
                          size={18}
                          color={isSelected ? accentColor : theme.subtext}
                        />
                        <Text
                          style={[
                            styles.topicName,
                            { color: isSelected ? accentColor : theme.text },
                            isSelected && { fontWeight: '700' },
                          ]}>
                          {topic.name}
                        </Text>
                      </View>

                      <View style={styles.topicItemRight}>
                        {/* Edit & Delete Action Buttons */}
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() => handleStartRename(topic)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="pencil-outline" size={16} color={theme.subtext} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() => handleDelete(topic)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>

                        {isSelected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color={accentColor}
                            style={{ marginLeft: 4 }}
                          />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* 3. Inline Input "+ Buat Topik Baru" */}
              <View style={[styles.footerContainer, { borderTopColor: theme.border }]}>
                {isCreating ? (
                  <View style={styles.newTopicForm}>
                    <TextInput
                      style={[
                        styles.newTopicInput,
                        {
                          backgroundColor: theme.background,
                          color: theme.text,
                          borderColor: theme.border,
                        },
                      ]}
                      placeholder="Masukkan nama topik baru..."
                      placeholderTextColor={theme.subtext}
                      value={newTopicName}
                      onChangeText={setNewTopicName}
                      autoFocus
                    />
                    <View style={styles.newTopicActions}>
                      <TouchableOpacity
                        style={[styles.cancelBtn, { borderColor: theme.border }]}
                        onPress={() => {
                          setIsCreating(false);
                          setNewTopicName('');
                        }}>
                        <Text style={[styles.cancelBtnText, { color: theme.subtext }]}>
                          Batal
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.submitBtn,
                          { backgroundColor: accentColor },
                          (!newTopicName.trim() || isSubmittingNew) && { opacity: 0.5 },
                        ]}
                        disabled={!newTopicName.trim() || isSubmittingNew}
                        onPress={handleCreate}>
                        {isSubmittingNew ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.submitBtnText}>Simpan</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.addTopicBtn, { borderColor: accentColor }]}
                    onPress={() => setIsCreating(true)}>
                    <Ionicons name="add" size={18} color={accentColor} />
                    <Text style={[styles.addTopicBtnText, { color: accentColor }]}>
                      Buat Topik Baru
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 20,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  subjectSubtitle: {
    fontSize: 13,
    marginTop: 3,
  },
  closeBtn: {
    padding: 4,
  },
  emptySubjectContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptySubjectText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  topicsScroll: {
    maxHeight: 320,
  },
  topicsListContent: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  topicItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  topicItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  topicItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topicName: {
    fontSize: 15,
    flex: 1,
  },
  iconBtn: {
    padding: 6,
  },
  editInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  editInlineInput: {
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  miniActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addTopicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addTopicBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  newTopicForm: {
    gap: 10,
  },
  newTopicInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  newTopicActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  submitBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});