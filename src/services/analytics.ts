import { Share } from 'react-native';
import { type SQLiteDatabase } from 'expo-sqlite';
import { AcademicImpactStats } from '../types';

/**
 * Minutes estimated to search for a disorganized photo note in smartphone gallery
 * during exam prep (UTS/UAS) based on student surveys.
 */
const MINUTES_SAVED_PER_NOTE = 6;

/**
 * Calculate local-only academic impact metrics
 * Completely on-device, zero external telemetry
 */
export async function calculateAcademicImpact(
  db: SQLiteDatabase
): Promise<AcademicImpactStats> {
  try {
    const notesRes = await db.getFirstAsync<{
      notesCount: number;
      activeDays: number;
    }>(
      'SELECT COUNT(*) as notesCount, COUNT(DISTINCT date(date_taken)) as activeDays FROM notes'
    );

    const subjectsRes = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM subjects'
    );

    const notesCount = notesRes?.notesCount ?? 0;
    const subjectsCount = subjectsRes?.count ?? 0;
    const activeDaysCount = notesRes?.activeDays ?? 0;

    const minutesSaved = notesCount * MINUTES_SAVED_PER_NOTE;
    const hoursSaved = (minutesSaved / 60).toFixed(1);

    return {
      notesCount,
      subjectsCount,
      minutesSaved,
      hoursSaved,
      activeDaysCount,
    };
  } catch (error) {
    console.error('Failed to calculate academic impact:', error);
    return {
      notesCount: 0,
      subjectsCount: 0,
      minutesSaved: 0,
      hoursSaved: '0.0',
      activeDaysCount: 0,
    };
  }
}

/**
 * Generate viral referral text for student word-of-mouth
 */
export function getViralShareText(stats?: AcademicImpactStats): string {
  const hoursText = stats && parseFloat(stats.hoursSaved) > 0
    ? `⚡ Udah hemat ~${stats.hoursSaved} jam waktu belajar UTS/UAS!`
    : '⚡ Bebas panik waktu UTS & UAS!';

  const notesText = stats && stats.notesCount > 0
    ? `Gue udah rapihin ${stats.notesCount} foto catatan kuliah otomatis pakai Notia.`
    : 'Catatan kuliah lo masih berceceran di galeri HP? Cobain Notia deh!';

  return `📚 ${notesText}
${hoursText}

Foto catatan langsung dibaca AI Vision, auto-kategorisasi ke mata kuliah, dan 100% aman di HP tanpa ribet.

Download Notia (Gratis & Open Source):
https://github.com/aryarizky/notia`;
}

/**
 * Trigger native OS share sheet to share Notia with classmates
 */
export async function shareNotiaApp(
  stats?: AcademicImpactStats
): Promise<boolean> {
  try {
    const message = getViralShareText(stats);
    const result = await Share.share({
      title: 'Notia — Asisten Catatan Kuliah Pintar Mahasiswa',
      message,
    });

    return result.action === Share.sharedAction;
  } catch (error) {
    console.error('Error sharing Notia:', error);
    return false;
  }
}
