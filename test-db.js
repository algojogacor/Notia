/**
 * Automated Verification Script for Notia SQLite Schema
 * Run with: node test-db.js
 */
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');

console.log('--- Notia SQLite Verification Test ---');

// Initialize in-memory database
const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON;');

// 1. Create Tables
const CREATE_SUBJECTS_TABLE = `
CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

const CREATE_NOTES_TABLE = `
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

const CREATE_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_notes_subject_id ON notes(subject_id);
CREATE INDEX IF NOT EXISTS idx_notes_date_taken ON notes(date_taken DESC);
CREATE INDEX IF NOT EXISTS idx_subjects_name ON subjects(name);
`;

db.exec(CREATE_SUBJECTS_TABLE);
db.exec(CREATE_NOTES_TABLE);
db.exec(CREATE_INDEXES);

console.log('✅ Tables and Indexes created successfully.');

// 2. Insert Seed Subjects
const subjects = [
  ['sub_matdis', 'Matematika Diskrit', '#6366F1'],
  ['sub_alpro', 'Algoritma & Pemrograman', '#3B82F6'],
  ['sub_basdat', 'Basis Data', '#10B981'],
];

const insertSubject = db.prepare('INSERT INTO subjects (id, name, color) VALUES (?, ?, ?)');
for (const s of subjects) {
  insertSubject.run(s[0], s[1], s[2]);
}

const subjectsCount = db.prepare('SELECT COUNT(*) as count FROM subjects').get();
console.log(`✅ Seed subjects inserted: ${subjectsCount.count} records.`);

// 3. Insert Sample Note
const insertNote = db.prepare(
  'INSERT INTO notes (id, image_path, subject_id, extracted_text, date_taken) VALUES (?, ?, ?, ?, ?)'
);
insertNote.run(
  'note_test_1',
  '/data/photos/note_1.jpg',
  'sub_matdis',
  'Teori Graf: Pohon merentang minimum (MST) menggunakan algoritma Kruskal dan Prim.',
  '2026-09-15'
);

const noteWithSubject = db.prepare(`
  SELECT 
    n.id, 
    n.image_path, 
    n.subject_id, 
    n.extracted_text, 
    n.date_taken,
    s.name as subject_name,
    s.color as subject_color
  FROM notes n
  LEFT JOIN subjects s ON n.subject_id = s.id
  WHERE n.id = ?
`).get('note_test_1');

console.log('✅ Note with Subject Join Query Result:');
console.log(noteWithSubject);

// 4. Test Search Query
const search = db.prepare(`
  SELECT n.id, n.extracted_text, s.name as subject_name
  FROM notes n
  LEFT JOIN subjects s ON n.subject_id = s.id
  WHERE n.extracted_text LIKE ? OR s.name LIKE ?
`).all('%Kruskal%', '%Kruskal%');

console.log(`✅ Search result for "Kruskal": ${search.length} found.`);

// 5. Test Foreign Key ON DELETE SET NULL
db.prepare('DELETE FROM subjects WHERE id = ?').run('sub_matdis');
const orphanedNote = db.prepare('SELECT id, subject_id FROM notes WHERE id = ?').get('note_test_1');
if (orphanedNote.subject_id === null) {
  console.log('✅ Foreign Key ON DELETE SET NULL verified (subject_id is null after subject deletion).');
} else {
  throw new Error('Foreign key ON DELETE SET NULL failed!');
}

console.log('--- ALL TESTS PASSED SUCCESSFULLY! ---');
