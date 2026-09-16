/**
 * Database Schema Definition for Notia (SQLite)
 * Local-first storage for notes and subjects
 */

export const CREATE_SUBJECTS_TABLE = `
CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export const CREATE_NOTES_TABLE = `
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY NOT NULL,
  image_path TEXT NOT NULL,
  subject_id TEXT,
  extracted_text TEXT,
  date_taken TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE SET NULL
);
`;

export const CREATE_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_notes_subject_id ON notes(subject_id);
CREATE INDEX IF NOT EXISTS idx_notes_date_taken ON notes(date_taken DESC);
CREATE INDEX IF NOT EXISTS idx_subjects_name ON subjects(name);
`;

export const DEFAULT_SUBJECTS = [
  { id: 'sub_matdis', name: 'Matematika Diskrit', color: '#6366F1' },
  { id: 'sub_alpro', name: 'Algoritma & Pemrograman', color: '#3B82F6' },
  { id: 'sub_basdat', name: 'Basis Data', color: '#10B981' },
  { id: 'sub_sisop', name: 'Sistem Operasi', color: '#F59E0B' },
  { id: 'sub_jarkom', name: 'Jaringan Komputer', color: '#EC4899' },
  { id: 'sub_ai', name: 'Kecerdasan Buatan', color: '#8B5CF6' },
];
