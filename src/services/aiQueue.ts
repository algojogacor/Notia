import { type SQLiteDatabase } from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import {
  getPendingNotes,
  updateNoteAiStatus,
  updateNoteAiResult,
  getSubjects,
  findOrCreateSubject,
} from '../db/database';
import { analyzeLectureNote, isGroqConfigured } from './groq';
import { NoteWithSubject, AiStatus } from '../types';

/**
 * Persistent Background AI Queue Processor for Notia
 * Handles batch OCR processing, rate limiting, and exponential retry backoff:
 * - Retry 1: wait 2 minutes (120s)
 * - Retry 2: wait 5 minutes (300s)
 * - Retry 3+: wait 10 minutes (600s)
 * - After 10 retries: marks as 'failed_permanent'
 */

type QueueListener = (updatedNoteId?: string) => void;
const listeners = new Set<QueueListener>();

let dbInstance: SQLiteDatabase | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let isWorkerRunning = false;

export function subscribeQueue(listener: QueueListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(noteId?: string) {
  for (const listener of listeners) {
    try {
      listener(noteId);
    } catch (e) {
      console.warn('Queue listener error:', e);
    }
  }
}

/**
 * Calculate backoff delay in seconds based on retry count
 */
export function getRetryBackoffSeconds(retryCount: number): number {
  if (retryCount <= 0) return 0;
  if (retryCount === 1) return 120; // 2 mins
  if (retryCount === 2) return 300; // 5 mins
  return 600; // 10 mins
}

/**
 * Check if a note is ready to be processed or retried
 */
export function isNoteReadyForProcessing(note: NoteWithSubject, nowSeconds: number): boolean {
  if (note.ai_status === 'failed_permanent' || note.ai_status === 'done') {
    return false;
  }
  const retries = note.retry_count || 0;
  if (retries === 0) {
    return true;
  }
  if (!note.last_attempted_at) {
    return true;
  }
  const backoff = getRetryBackoffSeconds(retries);
  return nowSeconds - note.last_attempted_at >= backoff;
}

/**
 * Process a single pending note through Groq Vision OCR
 */
async function processNote(db: SQLiteDatabase, note: NoteWithSubject): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  const currentRetries = note.retry_count || 0;

  // Mark as processing
  await updateNoteAiStatus(db, note.id, 'processing');
  notifyListeners(note.id);

  try {
    if (!note.image_path) {
      // Manual note without image, mark done
      await updateNoteAiStatus(db, note.id, 'done', nowSec, 0);
      notifyListeners(note.id);
      return;
    }

    // Read local image file as base64
    let base64Data: string;
    try {
      base64Data = await FileSystem.readAsStringAsync(note.image_path, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch (readErr: any) {
      console.warn(`Could not read image file for note ${note.id}:`, readErr);
      throw new Error(`File foto catatan tidak ditemukan: ${readErr.message}`);
    }

    // Load active subjects for contextual classification
    const allSubjects = await getSubjects(db);
    const subjectNames = allSubjects.map((s) => s.name);

    // Call Groq Vision API
    const analysis = await analyzeLectureNote({
      imageBase64: base64Data,
      existingSubjects: subjectNames,
    });

    // Resolve or match subject
    let finalSubjectId = note.subject_id;
    if (!finalSubjectId && analysis.suggested_subject) {
      const matched = await findOrCreateSubject(db, analysis.suggested_subject);
      finalSubjectId = matched.id;
    }

    // Save OCR text, summary, and keywords
    await updateNoteAiResult(db, note.id, {
      extractedText: analysis.extracted_text,
      summary: analysis.summary,
      keyPoints: analysis.keywords,
      subjectId: finalSubjectId,
    });

    notifyListeners(note.id);
  } catch (err: any) {
    console.warn(`AI Queue: Error processing note ${note.id}:`, err?.message || err);
    const nextRetry = currentRetries + 1;
    const nextStatus: AiStatus = nextRetry > 10 ? 'failed_permanent' : 'pending';

    await updateNoteAiStatus(db, note.id, nextStatus, nowSec, nextRetry);
    notifyListeners(note.id);
  }
}

/**
 * Step through pending items in the queue
 */
export async function stepQueue(): Promise<void> {
  if (!dbInstance || isWorkerRunning) return;
  if (!isGroqConfigured()) return;

  isWorkerRunning = true;
  try {
    const pending = await getPendingNotes(dbInstance);
    if (pending.length === 0) {
      return;
    }

    const nowSec = Math.floor(Date.now() / 1000);

    // Filter ready notes according to backoff timing
    const readyNotes: NoteWithSubject[] = [];
    for (const note of pending) {
      if ((note.retry_count || 0) > 10) {
        // Escalate to failed_permanent
        await updateNoteAiStatus(dbInstance, note.id, 'failed_permanent', note.last_attempted_at, note.retry_count);
        notifyListeners(note.id);
        continue;
      }
      if (isNoteReadyForProcessing(note, nowSec)) {
        readyNotes.push(note);
      }
    }

    // Process one note per tick to prevent overwhelming rate limit
    if (readyNotes.length > 0) {
      const noteToProcess = readyNotes[0];
      await processNote(dbInstance, noteToProcess);

      // If there are more ready items, immediately schedule next step
      if (readyNotes.length > 1) {
        setTimeout(() => {
          stepQueue().catch(() => {});
        }, 1000);
      }
    }
  } catch (err) {
    console.warn('Queue worker step error:', err);
  } finally {
    isWorkerRunning = false;
  }
}

/**
 * Start the AI background queue processor
 */
export function startAiQueue(db: SQLiteDatabase): void {
  dbInstance = db;

  // Run immediately on startup
  stepQueue().catch((err) => console.warn('Initial queue step error:', err));

  // Ticker checks every 15 seconds for backoff-ready notes
  if (!intervalId) {
    intervalId = setInterval(() => {
      stepQueue().catch(() => {});
    }, 15000);
  }
}

/**
 * Trigger immediate queue processing (e.g. after adding batch photos)
 */
export function triggerQueueProcessing(): void {
  stepQueue().catch(() => {});
}

/**
 * Stop queue processor (for cleanup)
 */
export function stopAiQueue(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  dbInstance = null;
}
