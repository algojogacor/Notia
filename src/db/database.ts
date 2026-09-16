import { type SQLiteDatabase } from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import {
  CREATE_SUBJECTS_TABLE,
  CREATE_NOTES_TABLE,
  CREATE_INDEXES,
  DEFAULT_SUBJECTS,
} from './schema';
import {
  Subject,
  SubjectWithCount,
  Note,
  NoteWithSubject,
  SubjectSection,
  DatabaseStats,
  StudyStreakStats,
  StudyHeatmapCell,
  AiStatus,
} from '../types';

import { SUBJECT_PALETTE } from '@/constants/Colors';
export { SUBJECT_PALETTE };

export const NOTE_SELECT_FIELDS = `
  n.id, 
  n.image_path, 
  n.subject_id, 
  n.extracted_text, 
  n.date_taken, 
  n.created_at,
  n.deleted_at,
  n.title,
  n.summary,
  n.key_points,
  n.ai_status,
  n.last_attempted_at,
  n.retry_count,
  n.source,
  s.name as subject_name,
  s.color as subject_color
`;

/**
 * Migrate and initialize database tables and seed defaults
 */
export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  // Enable foreign keys
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Create tables
  await db.execAsync(CREATE_SUBJECTS_TABLE);
  await db.execAsync(CREATE_NOTES_TABLE);

  // Ensure all columns exist on existing databases before creating indexes
  try {
    const tableInfo = await db.getAllAsync<{ name: string }>('PRAGMA table_info(notes);');
    const existingColNames = new Set(tableInfo.map((col) => col.name));

    if (!existingColNames.has('deleted_at')) {
      await db.execAsync('ALTER TABLE notes ADD COLUMN deleted_at TEXT;');
    }
    if (!existingColNames.has('title')) {
      await db.execAsync('ALTER TABLE notes ADD COLUMN title TEXT;');
    }
    if (!existingColNames.has('summary')) {
      await db.execAsync('ALTER TABLE notes ADD COLUMN summary TEXT;');
    }
    if (!existingColNames.has('key_points')) {
      await db.execAsync('ALTER TABLE notes ADD COLUMN key_points TEXT;');
    }
    if (!existingColNames.has('ai_status')) {
      await db.execAsync("ALTER TABLE notes ADD COLUMN ai_status TEXT DEFAULT 'done';");
    }
    if (!existingColNames.has('last_attempted_at')) {
      await db.execAsync('ALTER TABLE notes ADD COLUMN last_attempted_at INTEGER;');
    }
    if (!existingColNames.has('retry_count')) {
      await db.execAsync('ALTER TABLE notes ADD COLUMN retry_count INTEGER DEFAULT 0;');
    }
    if (!existingColNames.has('source')) {
      await db.execAsync("ALTER TABLE notes ADD COLUMN source TEXT DEFAULT 'camera';");
    }
  } catch (migErr) {
    console.warn('Migration check error:', migErr);
  }

  // Create indexes safely after all columns exist
  await db.execAsync(CREATE_INDEXES);

  // Check if subjects need seed data
  const existingSubjects = await db.getAllAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM subjects'
  );

  if (existingSubjects[0]?.count === 0) {
    for (const sub of DEFAULT_SUBJECTS) {
      await db.runAsync(
        'INSERT INTO subjects (id, name, color) VALUES (?, ?, ?)',
        [sub.id, sub.name, sub.color]
      );
    }
  }
}

/**
 * Fetch all registered subjects
 */
export async function getSubjects(db: SQLiteDatabase): Promise<Subject[]> {
  return await db.getAllAsync<Subject>(
    'SELECT * FROM subjects ORDER BY name ASC'
  );
}

/**
 * Fetch all subjects along with note count
 */
export async function getSubjectsWithCount(
  db: SQLiteDatabase
): Promise<SubjectWithCount[]> {
  return await db.getAllAsync<SubjectWithCount>(`
    SELECT 
      s.id, 
      s.name, 
      s.color, 
      s.created_at,
      COUNT(n.id) as notes_count
    FROM subjects s
    LEFT JOIN notes n ON s.id = n.subject_id AND n.deleted_at IS NULL
    GROUP BY s.id
    ORDER BY notes_count DESC, s.name ASC
  `);
}

/**
 * Fetch subject by ID
 */
export async function getSubjectById(
  db: SQLiteDatabase,
  id: string
): Promise<Subject | null> {
  const result = await db.getFirstAsync<Subject>(
    'SELECT * FROM subjects WHERE id = ?',
    [id]
  );
  return result ?? null;
}

/**
 * Create a new subject
 */
export async function createSubject(
  db: SQLiteDatabase,
  subject: { id: string; name: string; color: string }
): Promise<Subject> {
  await db.runAsync(
    'INSERT INTO subjects (id, name, color) VALUES (?, ?, ?)',
    [subject.id, subject.name, subject.color]
  );

  const created = await getSubjectById(db, subject.id);
  if (!created) {
    throw new Error(`Gagal membaca mata kuliah yang dibuat: ${subject.id}`);
  }
  return created;
}

/**
 * Find subject by name (case-insensitive) or create a new one with a curated color
 */
export async function findOrCreateSubject(
  db: SQLiteDatabase,
  subjectName: string,
  customColor?: string
): Promise<Subject> {
  const trimmed = (subjectName || 'Umum').trim();

  // Search case-insensitive
  const existing = await db.getFirstAsync<Subject>(
    'SELECT * FROM subjects WHERE LOWER(name) = LOWER(?) LIMIT 1',
    [trimmed]
  );

  if (existing) {
    return existing;
  }

  // Create new subject
  const color =
    customColor ||
    SUBJECT_PALETTE[Math.floor(Math.random() * SUBJECT_PALETTE.length)];
  const newId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return await createSubject(db, {
    id: newId,
    name: trimmed,
    color,
  });
}

/**
 * Fetch all notes with joined subject metadata
 */
export async function getNotes(db: SQLiteDatabase): Promise<NoteWithSubject[]> {
  return await db.getAllAsync<NoteWithSubject>(`
    SELECT 
      ${NOTE_SELECT_FIELDS}
    FROM notes n
    LEFT JOIN subjects s ON n.subject_id = s.id
    WHERE n.deleted_at IS NULL
    ORDER BY n.date_taken DESC, n.created_at DESC
  `);
}

/**
 * Fetch notes grouped by subject for SectionList view
 */
export async function getNotesGroupedBySubject(
  db: SQLiteDatabase
): Promise<SubjectSection[]> {
  const notes = await getNotes(db);

  const groupMap = new Map<string, SubjectSection>();

  for (const note of notes) {
    const key = note.subject_id || 'unassigned';
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        subjectId: key,
        subjectName: note.subject_name || 'Catatan Umum',
        subjectColor: note.subject_color || '#6B7280',
        data: [],
      });
    }
    groupMap.get(key)!.data.push(note);
  }

  return Array.from(groupMap.values());
}

/**
 * Fetch a single note by ID
 */
export async function getNoteById(
  db: SQLiteDatabase,
  id: string
): Promise<NoteWithSubject | null> {
  const result = await db.getFirstAsync<NoteWithSubject>(
    `
    SELECT 
      ${NOTE_SELECT_FIELDS}
    FROM notes n
    LEFT JOIN subjects s ON n.subject_id = s.id
    WHERE n.id = ?
  `,
    [id]
  );
  return result ?? null;
}

/**
 * Advanced multi-criteria search in SQLite:
 * Searches in extracted_text, title, summary, subject name, with optional subject filter
 */
export async function searchNotesAdvanced(
  db: SQLiteDatabase,
  query: string,
  subjectId?: string | null
): Promise<NoteWithSubject[]> {
  // Normalize whitespace: trim and split into separate keyword tokens
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);

  const hasTokens = tokens.length > 0;
  const hasSubject = Boolean(subjectId);

  let sql = `
    SELECT 
      ${NOTE_SELECT_FIELDS}
    FROM notes n
    LEFT JOIN subjects s ON n.subject_id = s.id
  `;

  const whereConditions: string[] = ['n.deleted_at IS NULL'];
  const params: any[] = [];

  // Multi-token matching: each word must match either note text, title, summary or subject name
  if (hasTokens) {
    for (const token of tokens) {
      whereConditions.push('(n.extracted_text LIKE ? OR n.title LIKE ? OR n.summary LIKE ? OR s.name LIKE ?)');
      params.push(`%${token}%`, `%${token}%`, `%${token}%`, `%${token}%`);
    }
  }

  if (hasSubject) {
    whereConditions.push('n.subject_id = ?');
    params.push(subjectId);
  }

  if (whereConditions.length > 0) {
    sql += ' WHERE ' + whereConditions.join(' AND ');
  }

  sql += ' ORDER BY n.date_taken DESC, n.created_at DESC';

  return await db.getAllAsync<NoteWithSubject>(sql, params);
}

/**
 * Basic search notes query (backwards compatibility)
 */
export async function searchNotes(
  db: SQLiteDatabase,
  query: string
): Promise<NoteWithSubject[]> {
  return await searchNotesAdvanced(db, query, null);
}

/**
 * Fetch notes filtered by subject ID
 */
export async function getNotesBySubject(
  db: SQLiteDatabase,
  subjectId: string
): Promise<NoteWithSubject[]> {
  return await db.getAllAsync<NoteWithSubject>(
    `
    SELECT 
      ${NOTE_SELECT_FIELDS}
    FROM notes n
    LEFT JOIN subjects s ON n.subject_id = s.id
    WHERE n.subject_id = ? AND n.deleted_at IS NULL
    ORDER BY n.date_taken DESC, n.created_at DESC
  `,
    [subjectId]
  );
}

/**
 * Insert a new note into the database
 */
export async function createNote(
  db: SQLiteDatabase,
  note: {
    id: string;
    image_path: string;
    subject_id?: string | null;
    extracted_text?: string | null;
    date_taken: string;
  }
): Promise<NoteWithSubject> {
  await db.runAsync(
    `INSERT INTO notes (id, image_path, subject_id, extracted_text, date_taken)
     VALUES (?, ?, ?, ?, ?)`,
    [
      note.id,
      note.image_path,
      note.subject_id || null,
      note.extracted_text || null,
      note.date_taken,
    ]
  );

  const created = await getNoteById(db, note.id);
  if (!created) {
    throw new Error(`Failed to fetch created note ${note.id}`);
  }
  return created;
}

export interface SaveCapturedNoteParams {
  imageUri: string;
  subjectName?: string;
  extractedText?: string;
  dateTaken?: string;
}

/**
 * Save captured lecture note: stores image locally, resolves subject, and saves note to SQLite
 */
export async function saveCapturedNote(
  db: SQLiteDatabase,
  params: SaveCapturedNoteParams
): Promise<NoteWithSubject> {
  const {
    imageUri,
    subjectName = 'Umum',
    extractedText = '',
    dateTaken = new Date().toISOString().split('T')[0],
  } = params;

  // 1. Find or create matching subject
  const subject = await findOrCreateSubject(db, subjectName);

  // 2. Persist image to app documents directory
  let persistentPath = imageUri;
  try {
    const docDir = FileSystem.documentDirectory;
    if (docDir) {
      const notesDir = `${docDir}notes/`;
      const dirInfo = await FileSystem.getInfoAsync(notesDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(notesDir, { intermediates: true });
      }

      const noteUniqueId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const targetUri = `${notesDir}${noteUniqueId}.jpg`;
      await FileSystem.copyAsync({ from: imageUri, to: targetUri });
      persistentPath = targetUri;
    }
  } catch (copyErr) {
    console.warn('Could not copy image to permanent storage, using imageUri:', copyErr);
    persistentPath = imageUri;
  }

  // 3. Create note record
  const noteId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return await createNote(db, {
    id: noteId,
    image_path: persistentPath,
    subject_id: subject.id,
    extracted_text: extractedText,
    date_taken: dateTaken,
  });
}

/**
 * Soft-delete a note (moves to Keranjang / Trash)
 */
export async function softDeleteNote(
  db: SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync(
    "UPDATE notes SET deleted_at = datetime('now') WHERE id = ?",
    [id]
  );
}

/**
 * Restore a soft-deleted note from trash
 */
export async function restoreNote(
  db: SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync('UPDATE notes SET deleted_at = NULL WHERE id = ?', [id]);
}

/**
 * Permanently delete a note (removes local file and DB row)
 */
export async function permanentlyDeleteNote(
  db: SQLiteDatabase,
  id: string
): Promise<void> {
  try {
    const note = await db.getFirstAsync<{ image_path: string }>(
      'SELECT image_path FROM notes WHERE id = ?',
      [id]
    );
    if (note?.image_path && note.image_path.startsWith('file:')) {
      await FileSystem.deleteAsync(note.image_path, { idempotent: true });
    }
  } catch (err) {
    console.warn('Could not remove file for permanently deleted note:', err);
  }
  await db.runAsync('DELETE FROM notes WHERE id = ?', [id]);
}

/**
 * Delete a note (defaults to soft-delete to prevent accidental data loss)
 */
export async function deleteNote(
  db: SQLiteDatabase,
  id: string
): Promise<void> {
  await softDeleteNote(db, id);
}

/**
 * Empty all items from trash permanently
 */
export async function emptyTrash(
  db: SQLiteDatabase
): Promise<number> {
  try {
    const trashedNotes = await db.getAllAsync<{ id: string; image_path: string }>(
      'SELECT id, image_path FROM notes WHERE deleted_at IS NOT NULL'
    );
    for (const note of trashedNotes) {
      if (note.image_path && note.image_path.startsWith('file:')) {
        try {
          await FileSystem.deleteAsync(note.image_path, { idempotent: true });
        } catch {}
      }
    }
    const result = await db.runAsync('DELETE FROM notes WHERE deleted_at IS NOT NULL');
    return result.changes;
  } catch (err) {
    console.error('Failed to empty trash:', err);
    throw err;
  }
}

/**
 * Fetch all soft-deleted notes for Trash screen
 */
export async function getTrashNotes(
  db: SQLiteDatabase
): Promise<NoteWithSubject[]> {
  return await db.getAllAsync<NoteWithSubject>(`
    SELECT 
      ${NOTE_SELECT_FIELDS}
    FROM notes n
    LEFT JOIN subjects s ON n.subject_id = s.id
    WHERE n.deleted_at IS NOT NULL
    ORDER BY n.deleted_at DESC
  `);
}

/**
 * Get count of items in trash for settings badge
 */
export async function getTrashCount(
  db: SQLiteDatabase
): Promise<number> {
  const res = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM notes WHERE deleted_at IS NOT NULL'
  );
  return res?.count ?? 0;
}

/**
 * Get database statistics for dashboard (active notes only)
 */
export async function getDatabaseStats(
  db: SQLiteDatabase
): Promise<DatabaseStats> {
  const notesRes = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM notes WHERE deleted_at IS NULL'
  );
  const subjectsRes = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM subjects'
  );

  return {
    notesCount: notesRes?.count ?? 0,
    subjectsCount: subjectsRes?.count ?? 0,
  };
}

/**
 * Fetch 5-week study heatmap and streak records
 */
export async function getStudyHeatmapAndStreak(
  db: SQLiteDatabase
): Promise<StudyStreakStats> {
  const HEATMAP_WEEKS = 5;
  const HEATMAP_DAYS = HEATMAP_WEEKS * 7; // 35 cells

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Find Monday of current week
  const startOfWeek = new Date(today);
  const day = (startOfWeek.getDay() + 6) % 7; // Monday = 0, Sunday = 6
  startOfWeek.setDate(startOfWeek.getDate() - day);

  // Heatmap window start: Monday 4 weeks before this week
  const heatStart = new Date(startOfWeek);
  heatStart.setDate(heatStart.getDate() - (HEATMAP_WEEKS - 1) * 7);

  // Query counts per day
  const rows = await db.getAllAsync<{ day: string; count: number }>(`
    SELECT date(date_taken) as day, COUNT(*) as count 
    FROM notes 
    WHERE deleted_at IS NULL 
    GROUP BY date(date_taken)
  `);

  const countMap = new Map<string, number>();
  for (const r of rows) {
    countMap.set(r.day, r.count);
  }

  // Generate 35 cells
  const heatmap: StudyHeatmapCell[] = [];
  for (let i = 0; i < HEATMAP_DAYS; i++) {
    const cellDate = new Date(heatStart);
    cellDate.setDate(cellDate.getDate() + i);
    const key = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(cellDate.getDate()).padStart(2, '0')}`;
    const count = countMap.get(key) ?? 0;
    heatmap.push({
      date: key,
      count,
      isToday: key === todayKey,
      isFuture: key > todayKey,
    });
  }
  const heatmapTotal = heatmap.reduce((sum, c) => sum + c.count, 0);

  // Calculate current streak
  let streak = 0;
  const todayCount = countMap.get(todayKey) ?? 0;
  const cursor = new Date(today);

  if (todayCount > 0) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  } else {
    // If today has no notes yet, check yesterday to preserve ongoing streak
    cursor.setDate(cursor.getDate() - 1);
  }

  while (true) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if ((countMap.get(key) ?? 0) > 0) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  // Calculate best streak in the 5-week window
  let bestStreak = 0;
  let run = 0;
  for (const cell of heatmap) {
    if (cell.count > 0) {
      run++;
      bestStreak = Math.max(bestStreak, run);
    } else {
      run = 0;
    }
  }
  bestStreak = Math.max(bestStreak, streak);

  return {
    streak,
    bestStreak,
    heatmap,
    heatmapTotal,
  };
}

/**
 * Save manual note typed directly without camera
 */
export async function saveManualNote(
  db: SQLiteDatabase,
  params: {
    title: string;
    transcription: string;
    subjectId?: string | null;
    dateTaken?: string;
  }
): Promise<NoteWithSubject> {
  const id = `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const dateTaken = params.dateTaken || new Date().toISOString().split('T')[0];
  await db.runAsync(
    `INSERT INTO notes (id, image_path, subject_id, extracted_text, date_taken, title, ai_status, source)
     VALUES (?, '', ?, ?, ?, ?, 'done', 'manual')`,
    [id, params.subjectId || null, params.transcription, dateTaken, params.title]
  );
  const created = await getNoteById(db, id);
  if (!created) {
    throw new Error(`Failed to load created manual note: ${id}`);
  }
  return created;
}

/**
 * Save a batch of captured note photos with pending AI status
 */
export async function saveBatchCapturedNotes(
  db: SQLiteDatabase,
  items: Array<{ imageUri: string; subjectId?: string | null; dateTaken?: string }>
): Promise<NoteWithSubject[]> {
  const docDir = FileSystem.documentDirectory;
  const notesDir = docDir ? `${docDir}notes/` : '';
  if (docDir) {
    try {
      const dirInfo = await FileSystem.getInfoAsync(notesDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(notesDir, { intermediates: true });
      }
    } catch (e) {
      console.warn('Could not ensure notes directory:', e);
    }
  }

  const savedNotes: NoteWithSubject[] = [];
  for (const item of items) {
    const noteId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let persistentPath = item.imageUri;
    if (docDir && item.imageUri && !item.imageUri.startsWith(notesDir)) {
      const targetUri = `${notesDir}${noteId}.jpg`;
      try {
        await FileSystem.copyAsync({ from: item.imageUri, to: targetUri });
        persistentPath = targetUri;
      } catch (e) {
        console.warn('Failed to copy batch photo:', e);
      }
    }
    const dateTaken = item.dateTaken || new Date().toISOString().split('T')[0];
    await db.runAsync(
      `INSERT INTO notes (id, image_path, subject_id, extracted_text, date_taken, ai_status, retry_count, source)
       VALUES (?, ?, ?, '', ?, 'pending', 0, 'camera')`,
      [noteId, persistentPath, item.subjectId || null, dateTaken]
    );
    const created = await getNoteById(db, noteId);
    if (created) savedNotes.push(created);
  }
  return savedNotes;
}

/**
 * Fetch all pending notes that need AI processing
 */
export async function getPendingNotes(
  db: SQLiteDatabase
): Promise<NoteWithSubject[]> {
  return await db.getAllAsync<NoteWithSubject>(`
    SELECT 
      ${NOTE_SELECT_FIELDS}
    FROM notes n
    LEFT JOIN subjects s ON n.subject_id = s.id
    WHERE (n.ai_status = 'pending' OR n.ai_status = 'processing') AND n.deleted_at IS NULL
    ORDER BY n.created_at ASC
  `);
}

/**
 * Update AI processing status and retry metadata
 */
export async function updateNoteAiStatus(
  db: SQLiteDatabase,
  id: string,
  status: AiStatus,
  lastAttemptedAt?: number | null,
  retryCount?: number
): Promise<void> {
  const updates: string[] = ['ai_status = ?'];
  const params: any[] = [status];

  if (lastAttemptedAt !== undefined) {
    updates.push('last_attempted_at = ?');
    params.push(lastAttemptedAt);
  }
  if (retryCount !== undefined) {
    updates.push('retry_count = ?');
    params.push(retryCount);
  }

  params.push(id);
  await db.runAsync(`UPDATE notes SET ${updates.join(', ')} WHERE id = ?`, params);
}

/**
 * Update note with successful AI vision OCR results
 */
export async function updateNoteAiResult(
  db: SQLiteDatabase,
  id: string,
  data: {
    extractedText: string;
    summary?: string | null;
    keyPoints?: string[] | null;
    subjectId?: string | null;
  }
): Promise<void> {
  const keyPointsJson = data.keyPoints ? JSON.stringify(data.keyPoints) : null;
  if (data.subjectId) {
    await db.runAsync(
      `UPDATE notes 
       SET extracted_text = ?, summary = ?, key_points = ?, subject_id = ?, ai_status = 'done', retry_count = 0 
       WHERE id = ?`,
      [data.extractedText, data.summary || null, keyPointsJson, data.subjectId, id]
    );
  } else {
    await db.runAsync(
      `UPDATE notes 
       SET extracted_text = ?, summary = ?, key_points = ?, ai_status = 'done', retry_count = 0 
       WHERE id = ?`,
      [data.extractedText, data.summary || null, keyPointsJson, id]
    );
  }
}

/**
 * Update summary and key points for older notes
 */
export async function updateNoteSummaryAndKeyPoints(
  db: SQLiteDatabase,
  id: string,
  summary: string,
  keyPoints: string[]
): Promise<void> {
  await db.runAsync(
    `UPDATE notes SET summary = ?, key_points = ? WHERE id = ?`,
    [summary, JSON.stringify(keyPoints), id]
  );
}

/**
 * Reset retry counter and set status to pending for manual retry
 */
export async function resetNoteRetry(
  db: SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync(
    `UPDATE notes SET ai_status = 'pending', retry_count = 0, last_attempted_at = NULL WHERE id = ?`,
    [id]
  );
}

