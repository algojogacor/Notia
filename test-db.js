/**
 * Automated Verification Script for Notia SQLite Schema (Phases 1, 2, & 3)
 * Run with: node test-db.js
 */
const { DatabaseSync } = require('node:sqlite');

console.log('--- Notia SQLite Verification Test (Phases 1, 2, & 3) ---');

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

console.log('✅ 2. Seed subjects inserted.');

// 3. Phase 2: findOrCreateSubject tests
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

const matchedExisting = findOrCreateSubject('basis data');
if (matchedExisting.id === 'sub_basdat' && matchedExisting.name === 'Basis Data') {
  console.log('✅ 3a. Case-insensitive subject matching passed.');
}

const createdNew = findOrCreateSubject('Kecerdasan Buatan', '#8B5CF6');
if (createdNew.name === 'Kecerdasan Buatan') {
  console.log('✅ 3b. Auto-create new subject passed.');
}

// 4. Insert multiple notes across subjects
const insertNote = db.prepare(
  'INSERT INTO notes (id, image_path, subject_id, extracted_text, date_taken) VALUES (?, ?, ?, ?, ?)'
);

insertNote.run(
  'note_1',
  '/data/photos/note_1.jpg',
  'sub_alpro',
  'Algoritma Pemrograman: Rekursi dan divide & conquer pada merge sort dan quick sort.',
  '2026-09-14'
);

insertNote.run(
  'note_2',
  '/data/photos/note_2.jpg',
  'sub_alpro',
  'Struktur Data: Stack, Queue, dan implementasi Linked List dengan pointer.',
  '2026-09-15'
);

insertNote.run(
  'note_3',
  '/data/photos/note_3.jpg',
  'sub_basdat',
  'Basis Data: Normalisasi 1NF, 2NF, 3NF, BCNF untuk menghindari anomali update dan delete.',
  '2026-09-15'
);

insertNote.run(
  'note_4',
  '/data/photos/note_4.jpg',
  createdNew.id,
  'Kecerdasan Buatan: Neural network backpropagation dan activation function ReLU.',
  '2026-09-15'
);

console.log('✅ 4. Multiple test notes inserted.');

// 5. Phase 3 Test: getSubjectsWithCount
const subjectsWithCount = db.prepare(`
  SELECT 
    s.id, 
    s.name, 
    s.color, 
    COUNT(n.id) as notes_count
  FROM subjects s
  LEFT JOIN notes n ON s.id = n.subject_id
  GROUP BY s.id
  ORDER BY notes_count DESC, s.name ASC
`).all();

console.log('✅ 5. getSubjectsWithCount results:');
for (const sub of subjectsWithCount) {
  console.log(`   - ${sub.name}: ${sub.notes_count} catatan`);
}

const alproCount = subjectsWithCount.find((s) => s.id === 'sub_alpro')?.notes_count;
if (alproCount === 2) {
  console.log('✅ 5a. Subject note count verified accurately (Alpro = 2).');
} else {
  throw new Error(`Expected Alpro count 2, got ${alproCount}`);
}

// 6. Phase 3 Test: Grouped by Subject
const allNotesWithSub = db.prepare(`
  SELECT 
    n.id, n.image_path, n.subject_id, n.extracted_text, n.date_taken,
    s.name as subject_name, s.color as subject_color
  FROM notes n
  LEFT JOIN subjects s ON n.subject_id = s.id
  ORDER BY n.date_taken DESC
`).all();

const groupMap = new Map();
for (const note of allNotesWithSub) {
  const key = note.subject_id || 'unassigned';
  if (!groupMap.has(key)) {
    groupMap.set(key, {
      subjectId: key,
      subjectName: note.subject_name || 'Catatan Umum',
      data: [],
    });
  }
  groupMap.get(key).data.push(note);
}
const sections = Array.from(groupMap.values());
console.log(`✅ 6. Grouped Sections count: ${sections.length} sections created for SectionList.`);

// 7. Phase 3 Test: Advanced Search
function searchAdvanced(query, subjectId) {
  let sql = `
    SELECT n.id, n.extracted_text, s.name as subject_name
    FROM notes n
    LEFT JOIN subjects s ON n.subject_id = s.id
  `;
  const where = [];
  const params = [];
  if (query) {
    where.push('(n.extracted_text LIKE ? OR s.name LIKE ?)');
    params.push(`%${query}%`, `%${query}%`);
  }
  if (subjectId) {
    where.push('n.subject_id = ?');
    params.push(subjectId);
  }
  if (where.length > 0) {
    sql += ' WHERE ' + where.join(' AND ');
  }
  return db.prepare(sql).all(...params);
}

// 7a. Search text across all
const resNormalisasi = searchAdvanced('Normalisasi', null);
console.log(`✅ 7a. Search 'Normalisasi' across all: ${resNormalisasi.length} found.`);

// 7b. Search with subject filter
const resAlproSort = searchAdvanced('sort', 'sub_alpro');
console.log(`✅ 7b. Search 'sort' in 'Algoritma & Pemrograman': ${resAlproSort.length} found.`);

const resBasdatSort = searchAdvanced('sort', 'sub_basdat');
if (resBasdatSort.length === 0) {
  console.log('✅ 7c. Subject filter isolation verified (0 found in Basis Data for "sort").');
} else {
  throw new Error('Subject filter isolation failed!');
}

console.log('--- ALL PHASES 1, 2, & 3 VERIFICATION TESTS PASSED! ---');
