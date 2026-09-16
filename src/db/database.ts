import { type SQLiteDatabase } from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { compressLecturePhoto, checkStorageSpaceAvailable } from '../utils/imageOptimizer';
import {
  CREATE_SUBJECTS_TABLE,
  CREATE_TOPICS_TABLE,
  CREATE_NOTES_TABLE,
  CREATE_FLASHCARDS_TABLE,
  CREATE_INDEXES,
  DEFAULT_SUBJECTS,
} from './schema';
import {
  Subject,
  SubjectWithCount,
  Topic,
  Note,
  NoteWithSubject,
  SubjectSection,
  TopicGroupSection,
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
  n.topic_id,
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
  n.flashcard_status,
  n.flashcard_retry_count,
  n.is_favorite,
  s.name as subject_name,
  s.color as subject_color,
  t.name as topic_name
`;

/**
 * Migrate and initialize database tables and seed defaults
 */
export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  // Enable WAL mode, NORMAL synchronous, and foreign keys for concurrent high-performance I/O
  try {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
    `);
  } catch (pragmaErr) {
    console.warn('Pragma setup warning:', pragmaErr);
  }

  // Create tables
  await db.execAsync(CREATE_SUBJECTS_TABLE);
  await db.execAsync(CREATE_TOPICS_TABLE);
  await db.execAsync(CREATE_NOTES_TABLE);
  await db.execAsync(CREATE_FLASHCARDS_TABLE);

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
    if (!existingColNames.has('flashcard_status')) {
      await db.execAsync("ALTER TABLE notes ADD COLUMN flashcard_status TEXT DEFAULT 'done';");
    }
    if (!existingColNames.has('flashcard_retry_count')) {
      await db.execAsync('ALTER TABLE notes ADD COLUMN flashcard_retry_count INTEGER DEFAULT 0;');
    }
    if (!existingColNames.has('topic_id')) {
      await db.execAsync('ALTER TABLE notes ADD COLUMN topic_id TEXT;');
    }
    if (!existingColNames.has('is_favorite')) {
      await db.execAsync('ALTER TABLE notes ADD COLUMN is_favorite INTEGER DEFAULT 0;');
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

  // Auto-expunge soft-deleted notes older than 30 days to free storage permanently
  try {
    const oldTrashed = await db.getAllAsync<{ id: string; image_path: string }>(
      "SELECT id, image_path FROM notes WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '-30 days')"
    );
    for (const note of oldTrashed) {
      if (note.image_path && (note.image_path.startsWith('file:') || note.image_path.startsWith('/'))) {
        try {
          await FileSystem.deleteAsync(note.image_path, { idempotent: true });
        } catch {}
      }
    }
    if (oldTrashed.length > 0) {
      await db.runAsync("DELETE FROM notes WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '-30 days')");
    }
  } catch (expungeErr) {
    console.warn('Auto-expunge trash warning:', expungeErr);
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
    LEFT JOIN topics t ON n.topic_id = t.id
    WHERE n.deleted_at IS NULL
    ORDER BY n.date_taken DESC, n.created_at DESC
  `);
}

/**
 * Fetch notes grouped by subject for SectionList view
 */
export async function getNotesGroupedBySubject(
  db: SQLiteDatabase,
  preloadedNotes?: NoteWithSubject[]
): Promise<SubjectSection[]> {
  const notes = preloadedNotes ?? (await getNotes(db));

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
    LEFT JOIN topics t ON n.topic_id = t.id
    WHERE n.id = ?
  `,
    [id]
  );
  return result ?? null;
}

/**
 * Toggle favorite status of a note (0 <-> 1)
 */
export async function toggleFavorite(
  db: SQLiteDatabase,
  noteId: string
): Promise<number> {
  const note = await db.getFirstAsync<{ is_favorite: number }>(
    'SELECT is_favorite FROM notes WHERE id = ?',
    [noteId]
  );
  const currentFav = note?.is_favorite ? 1 : 0;
  const newFav = currentFav === 1 ? 0 : 1;
  await db.runAsync('UPDATE notes SET is_favorite = ? WHERE id = ?', [newFav, noteId]);
  return newFav;
}

/**
 * Fetch all favorite notes
 */
export async function getFavoriteNotes(
  db: SQLiteDatabase
): Promise<NoteWithSubject[]> {
  return await db.getAllAsync<NoteWithSubject>(`
    SELECT 
      ${NOTE_SELECT_FIELDS}
    FROM notes n
    LEFT JOIN subjects s ON n.subject_id = s.id
    LEFT JOIN topics t ON n.topic_id = t.id
    WHERE n.deleted_at IS NULL AND n.is_favorite = 1
    ORDER BY n.date_taken DESC, n.created_at DESC
  `);
}

/**
 * Advanced multi-criteria search in SQLite:
 * Searches in extracted_text, title, summary, subject name, topic name with optional subject & topic filter,
 * time range filter, and favorite filter.
 */
export async function searchNotesAdvanced(
  db: SQLiteDatabase,
  query: string,
  subjectId?: string | null,
  topicId?: string | null,
  timeRange?: 'all' | '7d' | '30d' | 'semester' | null,
  isFavoriteOnly?: boolean | null
): Promise<NoteWithSubject[]> {
  // Normalize whitespace: trim and split into separate keyword tokens
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);

  const hasTokens = tokens.length > 0;
  const hasSubject = Boolean(subjectId);
  const hasTopic = topicId !== undefined && topicId !== null;

  let sql = `
    SELECT 
      ${NOTE_SELECT_FIELDS}
    FROM notes n
    LEFT JOIN subjects s ON n.subject_id = s.id
    LEFT JOIN topics t ON n.topic_id = t.id
  `;

  const whereConditions: string[] = ['n.deleted_at IS NULL'];
  const params: any[] = [];

  // Multi-token matching: each word must match either note text, title, summary, subject name, or topic name
  if (hasTokens) {
    for (const token of tokens) {
      whereConditions.push('(n.extracted_text LIKE ? OR n.title LIKE ? OR n.summary LIKE ? OR s.name LIKE ? OR t.name LIKE ?)');
      params.push(`%${token}%`, `%${token}%`, `%${token}%`, `%${token}%`, `%${token}%`);
    }
  }

  if (hasSubject) {
    whereConditions.push('n.subject_id = ?');
    params.push(subjectId);
  }

  if (hasTopic) {
    if (topicId === 'none' || topicId === '__none__') {
      whereConditions.push('n.topic_id IS NULL');
    } else {
      whereConditions.push('n.topic_id = ?');
      params.push(topicId);
    }
  }

  if (timeRange === '7d') {
    whereConditions.push("(date(n.date_taken) >= date('now', '-7 days') OR date(n.created_at) >= date('now', '-7 days'))");
  } else if (timeRange === '30d') {
    whereConditions.push("(date(n.date_taken) >= date('now', '-30 days') OR date(n.created_at) >= date('now', '-30 days'))");
  } else if (timeRange === 'semester') {
    whereConditions.push("(date(n.date_taken) >= date('now', '-180 days') OR date(n.created_at) >= date('now', '-180 days'))");
  }

  if (isFavoriteOnly) {
    whereConditions.push('n.is_favorite = 1');
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
  return await searchNotesAdvanced(db, query, null, null);
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
    LEFT JOIN topics t ON n.topic_id = t.id
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
    topic_id?: string | null;
    extracted_text?: string | null;
    date_taken: string;
  }
): Promise<NoteWithSubject> {
  await db.runAsync(
    `INSERT INTO notes (id, image_path, subject_id, topic_id, extracted_text, date_taken)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      note.id,
      note.image_path,
      note.subject_id || null,
      note.topic_id || null,
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

  // 1. Check storage space
  const storageCheck = await checkStorageSpaceAvailable(30);
  if (!storageCheck.hasSpace) {
    throw new Error('Penyimpanan HP hampir penuh (<30 MB). Harap bersihkan ruang penyimpanan.');
  }

  // 2. Find or create matching subject
  const subject = await findOrCreateSubject(db, subjectName);

  // 3. Persist compressed image to app documents directory
  let persistentPath = imageUri;
  try {
    const docDir = FileSystem.documentDirectory;
    if (docDir) {
      const notesDir = `${docDir}notes/`;
      const dirInfo = await FileSystem.getInfoAsync(notesDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(notesDir, { intermediates: true });
      }

      // Downscale to max 1600px @ 0.72 JPEG (~250 KB)
      const optimizedUri = await compressLecturePhoto(imageUri);

      const noteUniqueId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const targetUri = `${notesDir}${noteUniqueId}.jpg`;
      await FileSystem.copyAsync({ from: optimizedUri, to: targetUri });
      persistentPath = targetUri;

      // Clean up intermediate cache file if generated
      if (optimizedUri !== imageUri && (optimizedUri.includes('ImageManipulator') || optimizedUri.includes('cache'))) {
        try {
          await FileSystem.deleteAsync(optimizedUri, { idempotent: true });
        } catch {}
      }
    }
  } catch (copyErr) {
    console.warn('Could not compress or copy image to permanent storage, using imageUri:', copyErr);
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
 * Storage Garbage Collector:
 * Scans documentDirectory/notes/ and permanently removes unreferenced images
 */
export async function cleanOrphanedFiles(db: SQLiteDatabase): Promise<number> {
  try {
    const docDir = FileSystem.documentDirectory;
    if (!docDir) return 0;
    const notesDir = `${docDir}notes/`;
    const dirInfo = await FileSystem.getInfoAsync(notesDir);
    if (!dirInfo.exists) return 0;

    const allFiles = await FileSystem.readDirectoryAsync(notesDir);
    if (!allFiles || allFiles.length === 0) return 0;

    // Fetch all referenced filenames from notes table
    const rows = await db.getAllAsync<{ image_path: string }>(
      'SELECT image_path FROM notes WHERE image_path IS NOT NULL'
    );
    const referencedFilenames = new Set<string>();
    for (const r of rows) {
      if (r.image_path) {
        const fname = r.image_path.split('/').pop();
        if (fname) referencedFilenames.add(fname);
      }
    }

    let cleaned = 0;
    for (const fname of allFiles) {
      if (!referencedFilenames.has(fname)) {
        try {
          await FileSystem.deleteAsync(`${notesDir}${fname}`, { idempotent: true });
          cleaned++;
        } catch {}
      }
    }
    return cleaned;
  } catch (err) {
    console.warn('cleanOrphanedFiles warning:', err);
    return 0;
  }
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
      if (note.image_path && (note.image_path.startsWith('file:') || note.image_path.startsWith('/'))) {
        try {
          await FileSystem.deleteAsync(note.image_path, { idempotent: true });
        } catch {}
      }
    }
    const result = await db.runAsync('DELETE FROM notes WHERE deleted_at IS NOT NULL');

    // Garbage collect any orphaned files & reclaim SQLite disk pages
    try {
      await cleanOrphanedFiles(db);
      await db.execAsync('PRAGMA incremental_vacuum(50);');
    } catch {}

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
    LEFT JOIN topics t ON n.topic_id = t.id
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
    topicId?: string | null;
    dateTaken?: string;
  }
): Promise<NoteWithSubject> {
  const id = `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const dateTaken = params.dateTaken || new Date().toISOString().split('T')[0];
  await db.runAsync(
    `INSERT INTO notes (id, image_path, subject_id, topic_id, extracted_text, date_taken, title, ai_status, source, flashcard_status)
     VALUES (?, '', ?, ?, ?, ?, ?, 'done', 'manual', 'pending')`,
    [id, params.subjectId || null, params.topicId || null, params.transcription, dateTaken, params.title]
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
  items: Array<{ imageUri: string; subjectId?: string | null; topicId?: string | null; dateTaken?: string }>
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

  // Verify storage space before processing batch
  const storageCheck = await checkStorageSpaceAvailable(items.length * 2 + 20);
  if (!storageCheck.hasSpace) {
    throw new Error('Penyimpanan HP hampir penuh. Luangkan ruang memori sebelum memproses batch foto.');
  }

  const savedNotes: NoteWithSubject[] = [];
  for (const item of items) {
    const noteId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let persistentPath = item.imageUri;
    if (docDir && item.imageUri && !item.imageUri.startsWith(notesDir)) {
      const targetUri = `${notesDir}${noteId}.jpg`;
      try {
        // Downscale to max 1600px @ 0.72 JPEG (~250 KB)
        const optimizedUri = await compressLecturePhoto(item.imageUri);
        await FileSystem.copyAsync({ from: optimizedUri, to: targetUri });
        persistentPath = targetUri;

        if (optimizedUri !== item.imageUri && (optimizedUri.includes('ImageManipulator') || optimizedUri.includes('cache'))) {
          try {
            await FileSystem.deleteAsync(optimizedUri, { idempotent: true });
          } catch {}
        }
      } catch (e) {
        console.warn('Failed to compress/copy batch photo:', e);
      }
    }
    const dateTaken = item.dateTaken || new Date().toISOString().split('T')[0];
    await db.runAsync(
      `INSERT INTO notes (id, image_path, subject_id, topic_id, extracted_text, date_taken, ai_status, retry_count, source)
       VALUES (?, ?, ?, ?, '', ?, 'pending', 0, 'camera')`,
      [noteId, persistentPath, item.subjectId || null, item.topicId || null, dateTaken]
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
  db: SQLiteDatabase,
  limit: number = 20
): Promise<NoteWithSubject[]> {
  return await db.getAllAsync<NoteWithSubject>(`
    SELECT 
      ${NOTE_SELECT_FIELDS}
    FROM notes n
    LEFT JOIN subjects s ON n.subject_id = s.id
    LEFT JOIN topics t ON n.topic_id = t.id
    WHERE (n.ai_status = 'pending' OR n.ai_status = 'processing' OR n.flashcard_status = 'pending' OR n.flashcard_status = 'processing') AND n.deleted_at IS NULL
    ORDER BY n.created_at ASC
    LIMIT ?
  `, [limit]);
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
       SET extracted_text = ?, summary = ?, key_points = ?, subject_id = ?, ai_status = 'done', retry_count = 0, flashcard_status = 'pending', flashcard_retry_count = 0 
       WHERE id = ?`,
      [data.extractedText, data.summary || null, keyPointsJson, data.subjectId, id]
    );
  } else {
    await db.runAsync(
      `UPDATE notes 
       SET extracted_text = ?, summary = ?, key_points = ?, ai_status = 'done', retry_count = 0, flashcard_status = 'pending', flashcard_retry_count = 0 
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


export async function saveFlashcards(db: SQLiteDatabase, noteId: string, flashcards: {question: string, answer: string}[]): Promise<void> {
  for (const fc of flashcards) {
    const id = 'fc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    await db.runAsync(
      `INSERT INTO flashcards (id, note_id, question, answer) VALUES (?, ?, ?, ?)`,
      [id, noteId, fc.question, fc.answer]
    );
  }
  await db.runAsync(
    `UPDATE notes SET flashcard_status = 'done', flashcard_retry_count = 0 WHERE id = ?`,
    [noteId]
  );
}

export async function updateNoteFlashcardStatus(db: SQLiteDatabase, id: string, status: AiStatus, retryCount: number = 0): Promise<void> {
  await db.runAsync(
    `UPDATE notes SET flashcard_status = ?, flashcard_retry_count = ? WHERE id = ?`,
    [status, retryCount, id]
  );
}

export async function getFlashcardsBySubject(db: SQLiteDatabase, subjectId: string): Promise<any[]> {
  return await db.getAllAsync(
    `SELECT f.* FROM flashcards f
     JOIN notes n ON f.note_id = n.id
     WHERE n.subject_id = ? AND n.deleted_at IS NULL
     ORDER BY RANDOM()`,
    [subjectId]
  );
}

export async function getFlashcardsByNote(db: SQLiteDatabase, noteId: string): Promise<any[]> {
  return await db.getAllAsync(
    `SELECT * FROM flashcards WHERE note_id = ? ORDER BY RANDOM()`,
    [noteId]
  );
}

/**
 * Topic Management (100% Offline & Manual)
 */

export async function getTopicsBySubject(
  db: SQLiteDatabase,
  subjectId: string
): Promise<Topic[]> {
  return await db.getAllAsync<Topic>(
    'SELECT * FROM topics WHERE subject_id = ? ORDER BY name COLLATE NOCASE ASC',
    [subjectId]
  );
}

export async function createTopic(
  db: SQLiteDatabase,
  subjectId: string,
  name: string
): Promise<Topic> {
  const trimmed = name.trim();
  const id = `top_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await db.runAsync(
    'INSERT INTO topics (id, subject_id, name) VALUES (?, ?, ?)',
    [id, subjectId, trimmed]
  );
  const created = await db.getFirstAsync<Topic>(
    'SELECT * FROM topics WHERE id = ?',
    [id]
  );
  if (!created) {
    throw new Error(`Failed to create topic: ${trimmed}`);
  }
  return created;
}

export async function renameTopic(
  db: SQLiteDatabase,
  topicId: string,
  name: string
): Promise<void> {
  await db.runAsync(
    'UPDATE topics SET name = ? WHERE id = ?',
    [name.trim(), topicId]
  );
}

export async function deleteTopic(
  db: SQLiteDatabase,
  topicId: string
): Promise<void> {
  // Unassign notes in this topic first (safe delete, notes kept intact)
  await db.runAsync('UPDATE notes SET topic_id = NULL WHERE topic_id = ?', [topicId]);
  await db.runAsync('DELETE FROM topics WHERE id = ?', [topicId]);
}

export async function assignNoteTopic(
  db: SQLiteDatabase,
  noteId: string,
  topicId: string | null
): Promise<void> {
  await db.runAsync(
    'UPDATE notes SET topic_id = ? WHERE id = ?',
    [topicId || null, noteId]
  );
}

export async function getNotesByTopic(
  db: SQLiteDatabase,
  topicId: string
): Promise<NoteWithSubject[]> {
  return await db.getAllAsync<NoteWithSubject>(
    `
    SELECT 
      ${NOTE_SELECT_FIELDS}
    FROM notes n
    LEFT JOIN subjects s ON n.subject_id = s.id
    LEFT JOIN topics t ON n.topic_id = t.id
    WHERE n.topic_id = ? AND n.deleted_at IS NULL
    ORDER BY n.date_taken DESC, n.created_at DESC
  `,
    [topicId]
  );
}

/**
 * Group notes by Subject -> Topic for Home screen TOPIC view mode
 */
export async function getNotesGroupedByTopic(
  db: SQLiteDatabase,
  preloadedNotes?: NoteWithSubject[]
): Promise<TopicGroupSection[]> {
  const notes = preloadedNotes ?? (await getNotes(db));

  // Group by subject first
  const subjectGroups = new Map<string, {
    subjectId: string;
    subjectName: string;
    subjectColor: string;
    notes: NoteWithSubject[];
  }>();

  for (const note of notes) {
    const sId = note.subject_id || 'unassigned';
    if (!subjectGroups.has(sId)) {
      subjectGroups.set(sId, {
        subjectId: sId,
        subjectName: note.subject_name || 'Catatan Umum',
        subjectColor: note.subject_color || '#6B7280',
        notes: [],
      });
    }
    subjectGroups.get(sId)!.notes.push(note);
  }

  const sections: TopicGroupSection[] = [];

  for (const sGroup of subjectGroups.values()) {
    // Within this subject, group by topic
    const topicGroups = new Map<string, {
      topicId: string | null;
      topicName: string;
      notes: NoteWithSubject[];
    }>();

    for (const note of sGroup.notes) {
      const tKey = note.topic_id || '__no_topic__';
      if (!topicGroups.has(tKey)) {
        topicGroups.set(tKey, {
          topicId: note.topic_id || null,
          topicName: note.topic_name || 'Tanpa Topik',
          notes: [],
        });
      }
      topicGroups.get(tKey)!.notes.push(note);
    }

    // Sort topic groups: named topics first, "Tanpa Topik" always last
    const sortedTopics = Array.from(topicGroups.values()).sort((a, b) => {
      if (!a.topicId) return 1;
      if (!b.topicId) return -1;
      return a.topicName.localeCompare(b.topicName);
    });

    for (const tGroup of sortedTopics) {
      sections.push({
        subjectId: sGroup.subjectId,
        subjectName: sGroup.subjectName,
        subjectColor: sGroup.subjectColor,
        topicId: tGroup.topicId,
        topicName: tGroup.topicName,
        data: tGroup.notes,
      });
    }
  }

  return sections;
}
