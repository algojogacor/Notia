import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Share,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import Colors from '@/constants/Colors';
import { StudyStreakStats } from '@/src/types';
import { generateRecapCardSvg } from '@/src/services/recapCardSvg';

interface StreakCardProps {
  stats: StudyStreakStats;
  colorScheme: 'light' | 'dark';
  totalNotesCount?: number;
  totalSubjectsCount?: number;
  subjects?: Array<{name: string, color: string, notes_count: number}>;
}

const WEEKDAY_LETTERS = ['S', 'S', 'R', 'K', 'J', 'S', 'M']; // Sen, Sel, Rab, Kam, Jum, Sab, Min

export default function StreakCard({
  stats,
  colorScheme,
  totalNotesCount = 0,
  totalSubjectsCount = 0,
  subjects = [],
}: StreakCardProps) {
  const theme = Colors[colorScheme];
  const [showWrappedModal, setShowWrappedModal] = useState(false);

  // Group 35 cells into 5 rows (weeks) × 7 days
  const rows: typeof stats.heatmap[] = [];
  for (let r = 0; r < 5; r++) {
    rows.push(stats.heatmap.slice(r * 7, (r + 1) * 7));
  }

  const getCellColor = (count: number, isFuture: boolean) => {
    if (isFuture) {
      return colorScheme === 'dark' ? '#1f1b16' : '#f3ede2';
    }
    if (count === 0) {
      return colorScheme === 'dark' ? '#2c261e' : '#ede4d3';
    }
    if (count === 1) {
      return colorScheme === 'dark' ? '#5a4320' : '#f3db9f';
    }
    if (count === 2) {
      return colorScheme === 'dark' ? '#8c6522' : '#dfaf48';
    }
    return colorScheme === 'dark' ? '#d5a24a' : '#b07c24';
  };

  const handleShare = async () => {
    try {
      if (Platform.OS !== 'web') {
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {}
      }
      
      const svgContent = generateRecapCardSvg(stats, totalNotesCount, totalSubjectsCount, subjects);
      const filename = `Notia_Rekap_${new Date().toISOString().split('T')[0]}.svg`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      
      await FileSystem.writeAsStringAsync(fileUri, svgContent, { encoding: FileSystem.EncodingType.UTF8 });
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'image/svg+xml',
          dialogTitle: 'Bagikan Rekap Belajar Notia',
          UTI: 'public.svg-image',
        });
      } else {
        Alert.alert('Gagal', 'Fitur berbagi tidak tersedia di perangkat ini.');
      }
    } catch (err) {
      console.error('Error sharing streak:', err);
      Alert.alert('Gagal', 'Terjadi kesalahan saat membuat kartu rekap.');
    }
  };

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
        },
      ]}>
      {/* Washi Tape Accent — translucent paper tape holding the card */}
      <View
        style={[
          styles.washiTape,
          {
            backgroundColor:
              colorScheme === 'dark' ? 'rgba(213, 162, 74, 0.4)' : 'rgba(176, 124, 36, 0.35)',
            borderColor:
              colorScheme === 'dark' ? 'rgba(213, 162, 74, 0.6)' : 'rgba(176, 124, 36, 0.5)',
          },
        ]}
      />

      {/* Header Row: Flame Icon + Title + Share Button */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons name="flame" size={19} color={theme.amber} />
          <Text style={[styles.cardHeading, { color: theme.text }]}>
            Rekam Belajar
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.shareIconBtn,
            {
              backgroundColor: colorScheme === 'dark' ? '#302a21' : '#f1eadd',
              borderColor: theme.border,
            },
          ]}
          activeOpacity={0.7}
          onPress={() => setShowWrappedModal(true)}>
          <Ionicons name="sparkles" size={13} color={theme.amber} />
          <Text style={[styles.shareIconBtnText, { color: theme.text }]}>
            Rekap Wrapped
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Stats + Heatmap Row */}
      <View style={styles.bodyRow}>
        {/* Left Col: Duolingo-style Streak */}
        <View style={styles.streakCol}>
          <View style={styles.streakNumberRow}>
            <Text style={[styles.streakNumber, { color: theme.amber }]}>
              {stats.streak}
            </Text>
            <Text style={[styles.streakUnit, { color: theme.subtext }]}>
              HARI BERUNTUN
            </Text>
          </View>

          <Text style={[styles.streakDetail, { color: theme.subtext }]}>
            {stats.heatmapTotal} lembar dalam 5 minggu terakhir
          </Text>
          <Text style={[styles.streakRecord, { color: theme.subtext }]}>
            Rekor terbaik: <Text style={{ fontWeight: '700', color: theme.text }}>{stats.bestStreak} hari</Text>
          </Text>
        </View>

        {/* Right Col: GitHub-style Heatmap */}
        <View
          style={[
            styles.heatmapContainer,
            {
              backgroundColor: colorScheme === 'dark' ? '#1c1814' : '#faf7f2',
              borderColor: theme.border,
            },
          ]}>
          {/* 5 Rows of Weeks */}
          {rows.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.heatmapRow}>
              {row.map((cell, cellIdx) => (
                <View
                  key={cellIdx}
                  style={[
                    styles.heatmapCell,
                    {
                      backgroundColor: getCellColor(cell.count, cell.isFuture),
                      borderColor: cell.isToday
                        ? theme.amber
                        : 'transparent',
                      borderWidth: cell.isToday ? 1 : 0,
                    },
                  ]}
                />
              ))}
            </View>
          ))}

          {/* Weekday letters header/footer */}
          <View style={styles.weekdayRow}>
            {WEEKDAY_LETTERS.map((letter, i) => (
              <Text
                key={i}
                style={[
                  styles.weekdayLetter,
                  { color: theme.subtext },
                ]}>
                {letter}
              </Text>
            ))}
          </View>
        </View>
      </View>

      {/* Spotify Wrapped-style Recap Modal */}
      <Modal
        visible={showWrappedModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWrappedModal(false)}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.wrappedCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}>
            {/* Washi tape on modal card */}
            <View
              style={[
                styles.modalWashiTape,
                {
                  backgroundColor:
                    colorScheme === 'dark' ? 'rgba(213, 162, 74, 0.4)' : 'rgba(176, 124, 36, 0.35)',
                },
              ]}
            />

            <View style={styles.wrappedHeader}>
              <Text style={[styles.wrappedOverline, { color: theme.amber }]}>
                NOTIA · KARTU REKAP BELAJAR
              </Text>
              <Text style={[styles.wrappedTitle, { color: theme.text }]}>
                Konsistensi Belajar
              </Text>
              <Text style={[styles.wrappedSubtitle, { color: theme.subtext }]}>
                Catatan perkuliahan yang kamu kumpulkan hingga hari ini.
              </Text>
            </View>

            {/* Metrics highlight */}
            <View style={styles.wrappedMetricsRow}>
              <View
                style={[
                  styles.wrappedMetricBox,
                  { backgroundColor: colorScheme === 'dark' ? '#302a21' : '#f1eadd' },
                ]}>
                <Ionicons name="flame" size={24} color={theme.amber} />
                <Text style={[styles.wrappedMetricNum, { color: theme.amber }]}>
                  {stats.streak}
                </Text>
                <Text style={[styles.wrappedMetricLabel, { color: theme.subtext }]}>
                  Hari Beruntun
                </Text>
              </View>

              <View
                style={[
                  styles.wrappedMetricBox,
                  { backgroundColor: colorScheme === 'dark' ? '#302a21' : '#f1eadd' },
                ]}>
                <Ionicons name="trophy" size={24} color={theme.amber} />
                <Text style={[styles.wrappedMetricNum, { color: theme.amber }]}>
                  {stats.bestStreak}
                </Text>
                <Text style={[styles.wrappedMetricLabel, { color: theme.subtext }]}>
                  Rekor Terbaik
                </Text>
              </View>

              <View
                style={[
                  styles.wrappedMetricBox,
                  { backgroundColor: colorScheme === 'dark' ? '#302a21' : '#f1eadd' },
                ]}>
                <Ionicons name="documents" size={24} color={theme.amber} />
                <Text style={[styles.wrappedMetricNum, { color: theme.amber }]}>
                  {stats.heatmapTotal}
                </Text>
                <Text style={[styles.wrappedMetricLabel, { color: theme.subtext }]}>
                  Lembar (5 Mgg)
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.wrappedNoteBox,
                { backgroundColor: theme.background, borderColor: theme.border },
              ]}>
              <Text style={[styles.wrappedNoteText, { color: theme.text }]}>
                💡 &ldquo;Setiap lembar materi yang kamu rapihkan hari ini adalah kemudahan saat UTS dan UAS nanti.&rdquo;
              </Text>
            </View>

            {/* Action buttons */}
            <View style={styles.wrappedActions}>
              <TouchableOpacity
                style={[styles.modalShareBtn, { backgroundColor: theme.tint }]}
                activeOpacity={0.8}
                onPress={handleShare}>
                <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
                <Text style={styles.modalShareBtnText}>
                  Bagikan ke Status / Teman
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalCloseBtn, { borderColor: theme.border }]}
                activeOpacity={0.8}
                onPress={() => setShowWrappedModal(false)}>
                <Text style={[styles.modalCloseBtnText, { color: theme.subtext }]}>
                  Tutup
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
    position: 'relative' as const,
    overflow: 'visible',
    ...Platform.select({
      ios: {
        shadowColor: '#1a1410',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  washiTape: {
    position: 'absolute' as const,
    top: -8,
    right: 20,
    width: 68,
    height: 14,
    transform: [{ rotate: '-2deg' }],
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardHeading: {
    fontSize: 15.5,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  shareIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  shareIconBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  streakCol: {
    flex: 1,
    justifyContent: 'center',
  },
  streakNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 4,
  },
  streakNumber: {
    fontSize: 32,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    lineHeight: 36,
  },
  streakUnit: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  streakDetail: {
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 2,
  },
  streakRecord: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  heatmapContainer: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    gap: 3,
  },
  heatmapRow: {
    flexDirection: 'row',
    gap: 3,
  },
  heatmapCell: {
    width: 13,
    height: 13,
    borderRadius: 2.5,
  },
  weekdayRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 2,
  },
  weekdayLetter: {
    width: 13,
    textAlign: 'center',
    fontSize: 8,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  wrappedCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    position: 'relative' as const,
  },
  modalWashiTape: {
    position: 'absolute' as const,
    top: -8,
    alignSelf: 'center',
    width: 90,
    height: 16,
    transform: [{ rotate: '1deg' }],
    borderRadius: 2,
  },
  wrappedHeader: {
    alignItems: 'center',
    marginBottom: 18,
    marginTop: 4,
  },
  wrappedOverline: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  wrappedTitle: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginBottom: 4,
  },
  wrappedSubtitle: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 17,
  },
  wrappedMetricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  wrappedMetricBox: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  wrappedMetricNum: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  wrappedMetricLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  wrappedNoteBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 18,
  },
  wrappedNoteText: {
    fontSize: 12.5,
    lineHeight: 18,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  wrappedActions: {
    gap: 8,
  },
  modalShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalShareBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13.5,
  },
  modalCloseBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalCloseBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
