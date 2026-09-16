import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import EmptyStateIllustration from '@/components/EmptyStateIllustration';
import { getFlashcardsByNote, getFlashcardsBySubject, getNoteById, SUBJECT_PALETTE } from '@/src/db/database';
import { NoteWithSubject } from '@/src/types';

const { width } = Dimensions.get('window');

export default function PracticeScreen() {
  const { noteId, subjectId } = useLocalSearchParams<{ noteId?: string; subjectId?: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [parentNote, setParentNote] = useState<NoteWithSubject | null>(null);

  const flipAnim = useSharedValue(0); // 0 = front, 180 = back

  useEffect(() => {
    loadData();
  }, [noteId, subjectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (noteId) {
        const fcs = await getFlashcardsByNote(db, noteId);
        setCards(fcs);
        const n = await getNoteById(db, noteId);
        if (n) setParentNote(n);
      } else if (subjectId) {
        const fcs = await getFlashcardsBySubject(db, subjectId);
        setCards(fcs);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleFlip = () => {
    setFlipped(!flipped);
    flipAnim.value = withSpring(flipped ? 0 : 180, { damping: 15, stiffness: 120 });
  };

  const handleNext = () => {
    if (pos < cards.length - 1) {
      setFlipped(false);
      flipAnim.value = 0;
      setPos(pos + 1);
    } else {
      setPos(cards.length); // End state
    }
  };

  const handlePrev = () => {
    if (pos > 0) {
      setFlipped(false);
      flipAnim.value = 0;
      setPos(pos - 1);
    }
  };

  const handleShuffle = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setPos(0);
    setFlipped(false);
    flipAnim.value = 0;
  };

  const handleRestart = () => {
    setPos(0);
    setFlipped(false);
    flipAnim.value = 0;
  };

  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipAnim.value, [0, 180], [0, 180]);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: 'hidden',
    };
  });

  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipAnim.value, [0, 180], [180, 360]);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: 'hidden',
      position: 'absolute',
      top: 0, bottom: 0, left: 0, right: 0,
    };
  });

  const isPending = parentNote?.flashcard_status === 'pending' || parentNote?.flashcard_status === 'processing';
  const color = parentNote?.subject_id ? ((SUBJECT_PALETTE[parentNote.subject_id as keyof typeof SUBJECT_PALETTE] as string) || theme.tint) : theme.tint;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Latihan Flashcard', headerBackTitle: 'Kembali' }} />

      {/* Progress Hairline */}
      <View style={{ height: 3, width: '100%', backgroundColor: theme.border, position: 'absolute', top: 0, zIndex: 10 }}>
        <View style={{ height: '100%', width: `${cards.length > 0 ? (Math.min(pos, cards.length) / cards.length) * 100 : 0}%`, backgroundColor: color }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.tint} />
        </View>
      ) : cards.length === 0 ? (
        <View style={styles.center}>
          {isPending ? (
            <>
              <ActivityIndicator size="large" color={theme.tint} style={{ marginBottom: 16 }} />
              <Text style={[styles.text, { color: theme.text }]}>Kartu belajar sedang disiapkan AI...</Text>
              <Text style={[styles.subText, { color: theme.tabIconDefault, marginTop: 8 }]}>Harap tunggu beberapa saat.</Text>
            </>
          ) : (
            <EmptyStateIllustration
              variant="flashcard"
              message="Belum Ada Flashcard"
              subMessage="Flashcard akan otomatis dibuat saat AI memproses transkripsi catatan kuliahmu."
              action={{
                label: 'Kembali ke Catatan',
                onPress: () => router.back(),
              }}
            />
          )}
        </View>
      ) : pos >= cards.length ? (
        <View style={styles.center}>
          <View style={[styles.stamp, { borderColor: color }]}>
            <Text style={[styles.stampText, { color }]}>LATIHAN SELESAI</Text>
          </View>
          <Text style={[styles.text, { color: theme.text, marginTop: 24, textAlign: 'center' }]}>
            {cards.length} kartu sudah kamu pelajari.
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 32 }}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: color }]} onPress={handleRestart}>
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.btnText}>Ulangi dari Awal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { backgroundColor: color }]} onPress={handleShuffle}>
              <Ionicons name="shuffle" size={20} color="#fff" />
              <Text style={styles.btnText}>Acak & Ulangi</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.main}>
          <View style={styles.cardContainer}>
            {/* Depth effect behind card */}
            {pos < cards.length - 1 && (
              <View style={[styles.cardBg, { backgroundColor: theme.card, borderColor: theme.border, top: 12, transform: [{ scale: 0.95 }] }]} />
            )}
            {pos < cards.length - 2 && (
              <View style={[styles.cardBg, { backgroundColor: theme.card, borderColor: theme.border, top: 24, transform: [{ scale: 0.9 }] }]} />
            )}
            
            {/* Active Card */}
            <TouchableOpacity activeOpacity={1} onPress={handleFlip} style={styles.flipWrapper}>
              <Animated.View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, frontAnimatedStyle]}>
                <Text style={[styles.cardLabel, { color: theme.tabIconDefault }]}>PERTANYAAN</Text>
                <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
                  <Text style={[styles.cardText, { color: theme.text }]}>{cards[pos].question}</Text>
                </ScrollView>
                <Text style={[styles.hint, { color: theme.tabIconDefault }]}>Ketuk untuk membalik</Text>
              </Animated.View>

              <Animated.View style={[styles.card, { backgroundColor: '#f0f9ff', borderColor: '#b6e3f4' }, backAnimatedStyle]}>
                <Text style={[styles.cardLabel, { color: '#0284c7' }]}>JAWABAN</Text>
                <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
                  <Text style={[styles.cardText, { color: '#0f172a' }]}>{cards[pos].answer}</Text>
                </ScrollView>
              </Animated.View>
            </TouchableOpacity>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity style={[styles.ctrlBtn, { borderColor: theme.border }]} onPress={handlePrev} disabled={pos === 0}>
              <Ionicons name="chevron-back" size={24} color={pos === 0 ? theme.tabIconDefault : theme.text} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ctrlBtn, { borderColor: theme.border }]} onPress={handleShuffle}>
              <Ionicons name="shuffle" size={24} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ctrlBtn, { borderColor: theme.border }]} onPress={handleNext}>
              <Ionicons name="chevron-forward" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  main: { flex: 1, alignItems: 'center', paddingTop: 60, paddingHorizontal: 20 },
  text: { fontSize: 16 },
  subText: { fontSize: 14 },
  cardContainer: { width: '100%', height: width * 1.2, alignItems: 'center' },
  cardBg: { position: 'absolute', width: '100%', height: '100%', borderRadius: 16, borderWidth: 1, zIndex: 1 },
  flipWrapper: { width: '100%', height: '100%', zIndex: 10 },
  card: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 24, justifyContent: 'space-between' },
  cardLabel: { fontSize: 12, fontWeight: 'bold', letterSpacing: 1, marginBottom: 16, textAlign: 'center' },
  cardText: { fontSize: 22, lineHeight: 32, textAlign: 'center', fontFamily: 'serif' },
  hint: { fontSize: 13, textAlign: 'center', marginTop: 16 },
  controls: { flexDirection: 'row', gap: 16, marginTop: 40 },
  ctrlBtn: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  stamp: { paddingHorizontal: 24, paddingVertical: 12, borderWidth: 3, borderRadius: 8, transform: [{ rotate: '-10deg' }] },
  stampText: { fontSize: 24, fontWeight: '900', letterSpacing: 2 },
});
