import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { SQLiteDatabase } from 'expo-sqlite';
import { Subject, Topic } from '../types';

export interface BackupArchiveNote {
  id: string;
  subject_id: string | null;
  topic_id?: string | null;
  extracted_text: string | null;
  date_taken: string;
  created_at: string;
  title?: string | null;
  summary?: string | null;
  key_points?: string | null;
  ai_status?: string;
  flashcard_status?: string;
  is_favorite?: number;
  source?: string;
  image_filename: string;
  image_base64?: string;
}

export interface BackupArchiveFlashcard {
  id: string;
  note_id: string;
  question: string;
  answer: string;
  created_at?: string;
}

export interface BackupArchive {
  app: 'Notia';
  version: number;
  exported_at: string;
  stats: {
    subjects_count: number;
    topics_count?: number;
    notes_count: number;
    flashcards_count?: number;
  };
  subjects: Subject[];
  topics?: Topic[];
  notes: BackupArchiveNote[];
  flashcards?: BackupArchiveFlashcard[];
}

export interface ImportBackupResult {
  restoredSubjects: number;
  restoredTopics: number;
  restoredNotes: number;
  restoredFlashcards: number;
  exportedAt: string;
}

/**
 * Export full backup containing SQLite metadata, subjects, topics, flashcards,
 * and all photo files (Base64) into a single portable `.notia` archive (Version 2).
 */
export async function exportFullBackup(db: SQLiteDatabase): Promise<{
  filePath: string;
  notesCount: number;
  subjectsCount: number;
}> {
  // 1. Fetch subjects
  const subjects = await db.getAllAsync<Subject>(
    'SELECT * FROM subjects ORDER BY name ASC'
  );

  // 2. Fetch topics
  let topics: Topic[] = [];
  try {
    topics = await db.getAllAsync<Topic>(
      'SELECT * FROM topics ORDER BY name ASC'
    );
  } catch (err) {
    console.warn('[backup] Could not fetch topics for backup:', err);
  }

  // 3. Fetch notes with complete fields
  const notes = await db.getAllAsync<any>(`
    SELECT 
      n.id, 
      n.image_path, 
      n.subject_id, 
      n.topic_id,
      n.extracted_text, 
      n.date_taken, 
      n.created_at,
      n.title,
      n.summary,
      n.key_points,
      n.ai_status,
      n.flashcard_status,
      n.is_favorite,
      n.source
    FROM notes n
    WHERE n.deleted_at IS NULL
    ORDER BY n.created_at ASC
  `);

  // 4. Fetch flashcards
  let flashcards: BackupArchiveFlashcard[] = [];
  try {
    flashcards = await db.getAllAsync<BackupArchiveFlashcard>(
      'SELECT id, note_id, question, answer, created_at FROM flashcards'
    );
  } catch (err) {
    console.warn('[backup] Could not fetch flashcards for backup:', err);
  }

  // 5. Package notes with embedded base64 images
  const archivedNotes: BackupArchiveNote[] = [];

  for (const n of notes) {
    let base64Data: string | undefined = undefined;
    const filename = n.image_path ? n.image_path.split('/').pop() : `note_${n.id}.jpg`;

    try {
      if (n.image_path && (n.image_path.startsWith('file:') || n.image_path.startsWith('/'))) {
        const fileInfo = await FileSystem.getInfoAsync(n.image_path);
        if (fileInfo.exists) {
          base64Data = await FileSystem.readAsStringAsync(n.image_path, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }
      }
    } catch (err) {
      console.warn(`Could not read image for note ${n.id} during backup:`, err);
    }

    archivedNotes.push({
      id: n.id,
      subject_id: n.subject_id ?? null,
      topic_id: n.topic_id ?? null,
      extracted_text: n.extracted_text ?? null,
      date_taken: n.date_taken,
      created_at: n.created_at,
      title: n.title ?? null,
      summary: n.summary ?? null,
      key_points: n.key_points ?? null,
      ai_status: n.ai_status ?? 'done',
      flashcard_status: n.flashcard_status ?? 'done',
      is_favorite: n.is_favorite ? 1 : 0,
      source: n.source ?? 'camera',
      image_filename: filename || `note_${n.id}.jpg`,
      image_base64: base64Data,
    });
  }

  // 6. Create structured Version 2 archive
  const archive: BackupArchive = {
    app: 'Notia',
    version: 2,
    exported_at: new Date().toISOString(),
    stats: {
      subjects_count: subjects.length,
      topics_count: topics.length,
      notes_count: archivedNotes.length,
      flashcards_count: flashcards.length,
    },
    subjects,
    topics,
    notes: archivedNotes,
    flashcards,
  };

  const jsonString = JSON.stringify(archive, null, 2);
  const dateStr = new Date().toISOString().split('T')[0];
  const targetPath = `${FileSystem.cacheDirectory}Notia_Cadangan_${dateStr}.notia`;

  await FileSystem.writeAsStringAsync(targetPath, jsonString, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  // 7. Open native sharing sheet if supported
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(targetPath, {
      mimeType: 'application/json',
      dialogTitle: 'Simpan / Bagikan Cadangan Notia',
      UTI: 'public.json',
    });
  }

  return {
    filePath: targetPath,
    notesCount: archivedNotes.length,
    subjectsCount: subjects.length,
  };
}

/**
 * Import and restore backup file (.notia / .json)
 * Restores subjects, topics, notes (with full titles, summaries, keywords),
 * and flashcards into SQLite, and extracts photos to local storage.
 * Non-destructive: preserves existing fields when restoring legacy (v1) archives.
 */
export async function importFullBackup(
  db: SQLiteDatabase
): Promise<ImportBackupResult | null> {
  // 1. Pick backup file
  const pickerResult = await DocumentPicker.getDocumentAsync({
    type: ['*/*'],
    copyToCacheDirectory: true,
  });

  if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
    return null;
  }

  const selectedFile = pickerResult.assets[0];
  const content = await FileSystem.readAsStringAsync(selectedFile.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  let archive: BackupArchive;
  try {
    archive = JSON.parse(content);
  } catch {
    throw new Error('File cadangan tidak valid atau rusak (format JSON salah).');
  }

  if (archive.app !== 'Notia' || !Array.isArray(archive.notes)) {
    throw new Error('File ini bukan arsip cadangan resmi aplikasi Notia.');
  }

  // 2. Ensure target notes directory exists
  const notesDir = `${FileSystem.documentDirectory}notes/`;
  const dirInfo = await FileSystem.getInfoAsync(notesDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(notesDir, { intermediates: true });
  }

  let restoredSubjects = 0;
  let restoredTopics = 0;
  let restoredNotes = 0;
  let restoredFlashcards = 0;

  // 3. Restore subjects (INSERT OR REPLACE)
  if (Array.isArray(archive.subjects)) {
    for (const sub of archive.subjects) {
      if (!sub.id || !sub.name) continue;
      await db.runAsync(
        `INSERT OR REPLACE INTO subjects (id, name, color, created_at) VALUES (?, ?, ?, ?)`,
        [sub.id, sub.name, sub.color || '#3B82F6', (sub as any).created_at || new Date().toISOString()]
      );
      restoredSubjects++;
    }
  }

  // 4. Restore topics (if present in v2 archive)
  if (Array.isArray(archive.topics)) {
    for (const top of archive.topics) {
      if (!top.id || !top.name || !top.subject_id) continue;
      await db.runAsync(
        `INSERT OR REPLACE INTO topics (id, subject_id, name, created_at) VALUES (?, ?, ?, ?)`,
        [top.id, top.subject_id, top.name, top.created_at || new Date().toISOString()]
      );
      restoredTopics++;
    }
  }

  // 5. Restore notes and unpack images non-destructively
  for (const item of archive.notes) {
    if (!item.id) continue;

    let finalImagePath = `${notesDir}${item.image_filename || `note_${item.id}.jpg`}`;

    // If image_base64 is included, unpack and write to local disk
    if (item.image_base64) {
      try {
        await FileSystem.writeAsStringAsync(finalImagePath, item.image_base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (err) {
        console.warn(`Failed to unpack image for note ${item.id}:`, err);
      }
    }

    // Check if note already exists to preserve non-empty local fields if importing legacy v1 archive
    const existing = await db.getFirstAsync<any>(
      'SELECT title, summary, key_points, topic_id FROM notes WHERE id = ?',
      [item.id]
    );

    const title = item.title !== undefined ? item.title : (existing?.title ?? null);
    const summary = item.summary !== undefined ? item.summary : (existing?.summary ?? null);
    const keyPoints = item.key_points !== undefined ? item.key_points : (existing?.key_points ?? null);
    const topicId = item.topic_id !== undefined ? item.topic_id : (existing?.topic_id ?? null);
    const isFavorite = item.is_favorite !== undefined ? item.is_favorite : 0;
    const aiStatus = item.ai_status || 'done';
    const flashcardStatus = item.flashcard_status || 'done';
    const source = item.source || 'camera';

    await db.runAsync(
      `INSERT OR REPLACE INTO notes (
        id, 
        image_path, 
        subject_id, 
        topic_id,
        extracted_text, 
        date_taken, 
        created_at,
        title,
        summary,
        key_points,
        ai_status,
        flashcard_status,
        is_favorite,
        source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        finalImagePath,
        item.subject_id || null,
        topicId,
        item.extracted_text || null,
        item.date_taken || new Date().toISOString().split('T')[0],
        item.created_at || new Date().toISOString(),
        title,
        summary,
        keyPoints,
        aiStatus,
        flashcardStatus,
        isFavorite,
        source,
      ]
    );
    restoredNotes++;
  }

  // 6. Restore flashcards (if present in v2 archive)
  if (Array.isArray(archive.flashcards)) {
    for (const fc of archive.flashcards) {
      if (!fc.id || !fc.note_id || !fc.question) continue;
      await db.runAsync(
        `INSERT OR REPLACE INTO flashcards (id, note_id, question, answer, created_at) VALUES (?, ?, ?, ?, ?)`,
        [fc.id, fc.note_id, fc.question, fc.answer, fc.created_at || new Date().toISOString()]
      );
      restoredFlashcards++;
    }
  }

  return {
    restoredSubjects,
    restoredTopics,
    restoredNotes,
    restoredFlashcards,
    exportedAt: archive.exported_at,
  };
}
