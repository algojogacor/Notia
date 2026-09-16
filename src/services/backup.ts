import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { SQLiteDatabase } from 'expo-sqlite';
import { Subject, NoteWithSubject } from '../types';

export interface BackupArchiveNote {
  id: string;
  subject_id: string | null;
  extracted_text: string | null;
  date_taken: string;
  created_at: string;
  image_filename: string;
  image_base64?: string;
}

export interface BackupArchive {
  app: 'Notia';
  version: number;
  exported_at: string;
  stats: {
    subjects_count: number;
    notes_count: number;
  };
  subjects: Subject[];
  notes: BackupArchiveNote[];
}

export interface ImportBackupResult {
  restoredSubjects: number;
  restoredNotes: number;
  exportedAt: string;
}

/**
 * Export full backup containing SQLite metadata, subjects, and all photo files (Base64)
 * into a single portable `.notia` archive file that can be shared / saved anywhere.
 */
export async function exportFullBackup(db: SQLiteDatabase): Promise<{
  filePath: string;
  notesCount: number;
  subjectsCount: number;
}> {
  // 1. Fetch all subjects
  const subjects = await db.getAllAsync<Subject>(
    'SELECT * FROM subjects ORDER BY name ASC'
  );

  // 2. Fetch all notes
  const notes = await db.getAllAsync<NoteWithSubject>(`
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
    ORDER BY n.created_at ASC
  `);

  // 3. Package notes with embedded base64 images
  const archivedNotes: BackupArchiveNote[] = [];

  for (const n of notes) {
    let base64Data: string | undefined = undefined;
    const filename = n.image_path.split('/').pop() || `note_${n.id}.jpg`;

    try {
      if (n.image_path.startsWith('file:') || n.image_path.startsWith('/')) {
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
      subject_id: n.subject_id,
      extracted_text: n.extracted_text,
      date_taken: n.date_taken,
      created_at: n.created_at,
      image_filename: filename,
      image_base64: base64Data,
    });
  }

  // 4. Create structured archive
  const archive: BackupArchive = {
    app: 'Notia',
    version: 1,
    exported_at: new Date().toISOString(),
    stats: {
      subjects_count: subjects.length,
      notes_count: archivedNotes.length,
    },
    subjects,
    notes: archivedNotes,
  };

  const jsonString = JSON.stringify(archive, null, 2);
  const dateStr = new Date().toISOString().split('T')[0];
  const targetPath = `${FileSystem.cacheDirectory}Notia_Cadangan_${dateStr}.notia`;

  await FileSystem.writeAsStringAsync(targetPath, jsonString, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  // 5. Open native sharing sheet if supported
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
 * Restores subjects and notes into SQLite, and extracts photos to local storage.
 * Follows accidental-data-loss-prevention: Uses non-destructive UPSERT (INSERT OR REPLACE).
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
  let restoredNotes = 0;

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

  // 4. Restore notes and unpack images
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

    await db.runAsync(
      `INSERT OR REPLACE INTO notes (id, image_path, subject_id, extracted_text, date_taken, created_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        finalImagePath,
        item.subject_id || null,
        item.extracted_text || null,
        item.date_taken || new Date().toISOString().split('T')[0],
        item.created_at || new Date().toISOString(),
      ]
    );
    restoredNotes++;
  }

  return {
    restoredSubjects,
    restoredNotes,
    exportedAt: archive.exported_at,
  };
}
