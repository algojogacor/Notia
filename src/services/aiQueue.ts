import { type SQLiteDatabase } from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import {
  getPendingNotes,
  updateNoteAiStatus,
  updateNoteAiResult,
  updateNoteFlashcardStatus,
  saveFlashcards,
  getSubjects,
  findOrCreateSubject,
} from '../db/database';
import { analyzeLectureNote, generateFlashcards, isGroqConfigured } from './groq';
import { NoteWithSubject, AiStatus } from '../types';

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
    } catch (e) {}
  }
}

export function getRetryBackoffSeconds(retryCount: number): number {
  if (retryCount <= 0) return 0;
  if (retryCount === 1) return 120;
  if (retryCount === 2) return 300;
  return 600;
}

export function isNoteReadyForProcessing(note: NoteWithSubject, nowSeconds: number): boolean {
  if (note.ai_status === 'failed_permanent' || note.ai_status === 'done') {
    return false;
  }
  const retries = note.retry_count || 0;
  if (retries === 0) return true;
  if (!note.last_attempted_at) return true;
  const backoff = getRetryBackoffSeconds(retries);
  return nowSeconds - note.last_attempted_at >= backoff;
}

async function processOcrNote(db: SQLiteDatabase, note: NoteWithSubject): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  const currentRetries = note.retry_count || 0;
  await updateNoteAiStatus(db, note.id, 'processing');
  notifyListeners(note.id);
  try {
    if (!note.image_path) {
      await updateNoteAiStatus(db, note.id, 'done', nowSec, 0);
      notifyListeners(note.id);
      return;
    }

    // Fast-fail if image file is permanently missing from disk
    const fileInfo = await FileSystem.getInfoAsync(note.image_path);
    if (!fileInfo.exists) {
      console.warn(`[aiQueue] File foto tidak ditemukan di storage: ${note.image_path}`);
      await updateNoteAiStatus(db, note.id, 'failed_permanent', nowSec, 11);
      notifyListeners(note.id);
      return;
    }

    let base64Data: string;
    try {
      base64Data = await FileSystem.readAsStringAsync(note.image_path, { encoding: FileSystem.EncodingType.Base64 });
    } catch (readErr: any) {
      throw new Error(`File foto catatan tidak ditemukan: ${readErr.message}`);
    }
    const allSubjects = await getSubjects(db);
    const subjectNames = allSubjects.map((s) => s.name);
    const analysis = await analyzeLectureNote({ imageBase64: base64Data, existingSubjects: subjectNames });
    let finalSubjectId = note.subject_id;
    if (!finalSubjectId && analysis.suggested_subject) {
      const matched = await findOrCreateSubject(db, analysis.suggested_subject);
      finalSubjectId = matched.id;
    }
    await updateNoteAiResult(db, note.id, {
      extractedText: analysis.extracted_text,
      summary: analysis.summary,
      keyPoints: analysis.keywords,
      subjectId: finalSubjectId,
    });
    notifyListeners(note.id);
  } catch (err: any) {
    const nextRetry = currentRetries + 1;
    const nextStatus: AiStatus = nextRetry > 10 ? 'failed_permanent' : 'pending';
    await updateNoteAiStatus(db, note.id, nextStatus, nowSec, nextRetry);
    notifyListeners(note.id);
  }
}

async function processFlashcardNote(db: SQLiteDatabase, note: NoteWithSubject): Promise<void> {
  const currentRetries = note.flashcard_retry_count || 0;
  await updateNoteFlashcardStatus(db, note.id, 'processing');
  notifyListeners(note.id);
  try {
    if (!note.extracted_text) {
      await updateNoteFlashcardStatus(db, note.id, 'done', 0);
      notifyListeners(note.id);
      return;
    }
    const flashcards = await generateFlashcards(note.extracted_text);
    await saveFlashcards(db, note.id, flashcards);
    notifyListeners(note.id);
  } catch (err: any) {
    const nextRetry = currentRetries + 1;
    const nextStatus: AiStatus = nextRetry > 10 ? 'failed_permanent' : 'pending';
    await updateNoteFlashcardStatus(db, note.id, nextStatus, nextRetry);
    notifyListeners(note.id);
  }
}

export async function stepQueue(): Promise<void> {
  if (!dbInstance || isWorkerRunning) return;
  if (!isGroqConfigured()) return;
  isWorkerRunning = true;
  try {
    const pending = await getPendingNotes(dbInstance);
    if (pending.length === 0) return;
    const nowSec = Math.floor(Date.now() / 1000);
    
    let noteToOcr: NoteWithSubject | null = null;
    let noteToFlashcard: NoteWithSubject | null = null;

    for (const note of pending) {
      if (note.ai_status === 'pending') {
        if ((note.retry_count || 0) > 10) {
          await updateNoteAiStatus(dbInstance, note.id, 'failed_permanent', note.last_attempted_at, note.retry_count);
          notifyListeners(note.id);
          continue;
        }
        if (isNoteReadyForProcessing(note, nowSec)) {
          noteToOcr = note;
          break;
        }
      }
    }

    if (!noteToOcr) {
      for (const note of pending) {
        if (note.ai_status === 'done' && note.flashcard_status === 'pending') {
          if ((note.flashcard_retry_count || 0) > 10) {
            await updateNoteFlashcardStatus(dbInstance, note.id, 'failed_permanent', note.flashcard_retry_count);
            notifyListeners(note.id);
            continue;
          }
          noteToFlashcard = note;
          break;
        }
      }
    }

    if (noteToOcr) {
      await processOcrNote(dbInstance, noteToOcr);
    } else if (noteToFlashcard) {
      await processFlashcardNote(dbInstance, noteToFlashcard);
    }

    if (noteToOcr || noteToFlashcard) {
      setTimeout(() => { stepQueue().catch(() => {}); }, 1000);
    }
  } catch (err) {} finally {
    isWorkerRunning = false;
  }
}

export async function recoverStuckProcessingNotes(db: SQLiteDatabase): Promise<void> {
  try {
    await db.runAsync("UPDATE notes SET ai_status = 'pending' WHERE ai_status = 'processing' AND deleted_at IS NULL;");
    await db.runAsync("UPDATE notes SET flashcard_status = 'pending' WHERE flashcard_status = 'processing' AND deleted_at IS NULL;");
  } catch (err) {
    console.warn('[aiQueue] Zombie recovery warning:', err);
  }
}

export function startAiQueue(db: SQLiteDatabase): void {
  dbInstance = db;
  // Recover any notes stuck in 'processing' due to prior app crashes
  recoverStuckProcessingNotes(db).then(() => {
    stepQueue().catch(() => {});
  });
  if (!intervalId) {
    intervalId = setInterval(() => { stepQueue().catch(() => {}); }, 15000);
  }
}

export function triggerQueueProcessing(): void {
  stepQueue().catch(() => {});
}

export function stopAiQueue(): void {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
  dbInstance = null;
}
