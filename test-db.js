/**
 * Automated Verification Script for Notia SQLite Schema & Phase 2 Pipeline
 * Run with: node test-db.js
 */
const { DatabaseSync } = require('node:sqlite');

console.log('--- Notia SQLite Verification Test (Phase 1 & Phase 2) ---');

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

console.log('✅ 1. Tables and Indexes created successfully.');

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
console.log(`✅ 2. Seed subjects inserted: ${subjectsCount.count} records.`);

// 3. Phase 2 Function Simulation: findOrCreateSubject
function findOrCreateSubject(name, color = '#F59E0B') {
  const trimmed = name.trim();
  const existing = db.prepare('SELECT * FROM subjects WHERE LOWER(name) = LOWER(?) LIMIT 1').get(trimmed);
  if (existing) {
    return existing;
  }
  const id = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  insertSubject.run(id, trimmed, color);
  return db.prepare('SELECT * FROM subjects WHERE id = ?').get(id);
}

// 3a. Test case-insensitive existing subject match
const matchedExisting = findOrCreateSubject('basis data');
if (matchedExisting.id === 'sub_basdat' && matchedExisting.name === 'Basis Data') {
  console.log('✅ 3a. Case-insensitive subject matching passed ("basis data" -> "Basis Data").');
} else {
  throw new Error('Case-insensitive match failed!');
}

// 3b. Test auto-creation of new subject
const createdNew = findOrCreateSubject('Kecerdasan Buatan', '#8B5CF6');
if (createdNew.name === 'Kecerdasan Buatan' && createdNew.color === '#8B5CF6') {
  console.log(`✅ 3b. Auto-create new subject passed: "${createdNew.name}" (${createdNew.id}).`);
} else {
  throw new Error('Auto-create subject failed!');
}

// 4. Test Note Insertion & Join
const insertNote = db.prepare(
  'INSERT INTO notes (id, image_path, subject_id, extracted_text, date_taken) VALUES (?, ?, ?, ?, ?)'
);
insertNote.run(
  'note_test_1',
  '/data/photos/note_1.jpg',
  createdNew.id,
  'Machine Learning: Supervised learning menggunakan algoritma Decision Tree dan Random Forest.',
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

console.log('✅ 4. Note with Joined Subject Query Result:');
console.log(noteWithSubject);

// 5. Test Search Query
const search = db.prepare(`
  SELECT n.id, n.extracted_text, s.name as subject_name
  FROM notes n
  LEFT JOIN subjects s ON n.subject_id = s.id
  WHERE n.extracted_text LIKE ? OR s.name LIKE ?
`).all('%Decision Tree%', '%Decision Tree%');

console.log(`✅ 5. Search result for "Decision Tree": ${search.length} found.`);

// 6. Test Foreign Key ON DELETE SET NULL
db.prepare('DELETE FROM subjects WHERE id = ?').run(createdNew.id);
const orphanedNote = db.prepare('SELECT id, subject_id FROM notes WHERE id = ?').get('note_test_1');
if (orphanedNote.subject_id === null) {
  console.log('✅ 6. Foreign Key ON DELETE SET NULL verified (subject_id is null after subject deletion).');
} else {
  throw new Error('Foreign key ON DELETE SET NULL failed!');
}

console.log('--- ALL PHASE 2 DATABASE & PIPELINE TESTS PASSED! ---');
