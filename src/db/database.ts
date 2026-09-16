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
} from '../types';

export const SUBJECT_PALETTE = [
  '#6366F1', // Indigo
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
];

/**
 * Migrate and initialize database tables and seed defaults
 */
export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  // Enable foreign keys
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Create tables & indexes
  await db.execAsync(CREATE_SUBJECTS_TABLE);
  await db.execAsync(CREATE_NOTES_TABLE);
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
    LEFT JOIN notes n ON s.id = n.subject_id
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
  subjectName: string
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
  const randomColor =
    SUBJECT_PALETTE[Math.floor(Math.random() * SUBJECT_PALETTE.length)];
  const newId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return await createSubject(db, {
    id: newId,
    name: trimmed,
    color: randomColor,
  });
}

/**
 * Fetch all notes with joined subject metadata
 */
export async function getNotes(db: SQLiteDatabase): Promise<NoteWithSubject[]> {
  return await db.getAllAsync<NoteWithSubject>(`
    SELECT 
      n.id, 
      n.image_path, 
      n.subject_id, 
      n.extracted_text, 
      n.date_taken, 
      n.created_at,
      s.name as subject_name,
      s.color as subject_color
    FROM notes n
    LEFT JOIN subjects s ON n.subject_id = s.id
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
      n.id, 
      n.image_path, 
      n.subject_id, 
      n.extracted_text, 
      n.date_taken, 
      n.created_at,
      s.name as subject_name,
      s.color as subject_color
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
 * Searches in extracted_text, subject name, with optional subject filter
 */
export async function searchNotesAdvanced(
  db: SQLiteDatabase,
  query: string,
  subjectId?: string | null
): Promise<NoteWithSubject[]> {
  const trimmed = query.trim();
  const hasQuery = trimmed.length > 0;
  const hasSubject = Boolean(subjectId);

  let sql = `
    SELECT 
      n.id, 
      n.image_path, 
      n.subject_id, 
      n.extracted_text, 
      n.date_taken, 
      n.created_at,
      s.name as subject_name,
      s.color as subject_color
    FROM notes n
    LEFT JOIN subjects s ON n.subject_id = s.id
  `;

  const whereConditions: string[] = [];
  const params: any[] = [];

  if (hasQuery) {
    whereConditions.push('(n.extracted_text LIKE ? OR s.name LIKE ?)');
    params.push(`%${trimmed}%`, `%${trimmed}%`);
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
      n.id, 
      n.image_path, 
      n.subject_id, 
      n.extracted_text, 
      n.date_taken, 
      n.created_at,
      s.name as subject_name,
      s.color as subject_color
    FROM notes n
    LEFT JOIN subjects s ON n.subject_id = s.id
    WHERE n.subject_id = ?
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
 * Delete a note
 */
export async function deleteNote(
  db: SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync('DELETE FROM notes WHERE id = ?', [id]);
}

/**
 * Get database statistics for dashboard
 */
export async function getDatabaseStats(
  db: SQLiteDatabase
): Promise<DatabaseStats> {
  const notesRes = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM notes'
  );
  const subjectsRes = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM subjects'
  );

  return {
    notesCount: notesRes?.count ?? 0,
    subjectsCount: subjectsRes?.count ?? 0,
  };
}
