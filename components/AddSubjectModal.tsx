import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { findOrCreateSubject, SUBJECT_PALETTE } from '@/src/db/database';
import { Subject } from '@/src/types';

interface AddSubjectModalProps {
  visible: boolean;
  onClose: () => void;
  onSubjectCreated?: (subject: Subject) => void;
}

const PRESET_SUGGESTIONS = [
  'Hukum Pidana',
  'Hukum Perdata',
  'Pancasila',
  'Kewarganegaraan',
  'Hukum Tata Negara',
  'Hukum Administrasi Negara',
  'Hukum Acara Pidana',
  'Pengantar Ilmu Hukum',
  'Kalkulus',
  'Basis Data',
  'Sistem Operasi',
];

export default function AddSubjectModal({
  visible,
  onClose,
  onSubjectCreated,
}: AddSubjectModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const db = useSQLiteContext();

  const [subjectName, setSubjectName] = useState('');
  const [selectedColor, setSelectedColor] = useState(SUBJECT_PALETTE[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    const trimmed = subjectName.trim();
    if (!trimmed) {
      Alert.alert('Nama Kosong', 'Harap masukkan nama mata kuliah.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (Platform.OS !== 'web') {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }

      const created = await findOrCreateSubject(db, trimmed, selectedColor);

      setSubjectName('');
      onClose();
      if (onSubjectCreated) {
        onSubjectCreated(created);
      }
    } catch (err: any) {
      Alert.alert('Gagal', err.message || 'Gagal menambahkan mata kuliah.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.dialogContainer,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}>
          <View style={styles.dialogHeader}>
            <View style={styles.titleRow}>
              <Ionicons name="school-outline" size={22} color={theme.tint} />
              <Text style={[styles.dialogTitle, { color: theme.text }]}>
                Tambah Mata Kuliah
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={theme.subtext} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.inputLabel, { color: theme.subtext }]}>
            Nama Mata Kuliah:
          </Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: theme.background,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            placeholder="Contoh: Hukum Pidana, Pancasila..."
            placeholderTextColor={theme.subtext}
            value={subjectName}
            onChangeText={setSubjectName}
            autoFocus
          />

          {/* Preset Suggestions */}
          <Text style={[styles.presetsLabel, { color: theme.subtext }]}>
            Pilihan Populer:
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetsScroll}>
            {PRESET_SUGGESTIONS.map((preset, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor:
                      subjectName === preset ? theme.tint : theme.background,
                    borderColor:
                      subjectName === preset ? theme.tint : theme.border,
                  },
                ]}
                onPress={() => setSubjectName(preset)}>
                <Text
                  style={[
                    styles.presetChipText,
                    { color: subjectName === preset ? '#FFFFFF' : theme.text },
                  ]}>
                  {preset}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.dialogActions}>
            <TouchableOpacity
              style={[
                styles.cancelBtn,
                { backgroundColor: theme.background, borderColor: theme.border },
              ]}
              onPress={onClose}>
              <Text style={[styles.cancelBtnText, { color: theme.subtext }]}>
                Batal
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: theme.tint }]}
              onPress={handleSave}
              disabled={isSubmitting}>
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>
                {isSubmitting ? 'Menyimpan...' : 'Simpan Matkul'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogContainer: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 14,
  },
  presetsLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  presetsScroll: {
    gap: 6,
    paddingBottom: 16,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
