import { type SQLiteDatabase } from 'expo-sqlite';
import {
  CREATE_SUBJECTS_TABLE,
  CREATE_NOTES_TABLE,
  CREATE_INDEXES,
  DEFAULT_SUBJECTS,
} from './schema';
import { Subject, Note, NoteWithSubject, DatabaseStats } from '../types';

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
    throw new Error(`Failed to retrieve created subject ${subject.id}`);
  }
  return created;
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
 * Search notes by query string (searches in extracted_text and subject name)
 */
export async function searchNotes(
  db: SQLiteDatabase,
  query: string
): Promise<NoteWithSubject[]> {
  const sanitized = `%${query.trim()}%`;
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
    WHERE n.extracted_text LIKE ? OR s.name LIKE ?
    ORDER BY n.date_taken DESC
  `,
    [sanitized, sanitized]
  );
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
    ORDER BY n.date_taken DESC
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
