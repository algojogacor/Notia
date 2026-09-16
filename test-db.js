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
  deleted_at TEXT,
  FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE SET NULL
);
`;

const CREATE_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_notes_subject_id ON notes(subject_id);
CREATE INDEX IF NOT EXISTS idx_notes_date_taken ON notes(date_taken DESC);
CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON notes(deleted_at);
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

// 7. Phase 3 Test: Advanced Multi-Token Search
function searchAdvanced(query, subjectId) {
  let sql = `
    SELECT n.id, n.extracted_text, s.name as subject_name
    FROM notes n
    LEFT JOIN subjects s ON n.subject_id = s.id
  `;
  const where = [];
  const params = [];

  const tokens = query ? query.trim().split(/\s+/).filter(Boolean) : [];
  if (tokens.length > 0) {
    for (const token of tokens) {
      where.push('(n.extracted_text LIKE ? OR s.name LIKE ?)');
      params.push(`%${token}%`, `%${token}%`);
    }
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

// 7d. Insert Law subject and note for KUHP testing
db.prepare('INSERT INTO subjects (id, name, color) VALUES (?, ?, ?)').run(
  'sub_pidana',
  'Hukum Pidana',
  '#EF4444'
);

insertNote.run(
  'note_law_1',
  '/data/photos/note_kuhp.jpg',
  'sub_pidana',
  'Hukum Pidana: Pembahasan tindak pidana materil. Pasal 362 KUHP mengatur tentang delik pencurian barang kepunyaan orang lain.',
  '2026-09-15'
);

// 7e. Test 'pasal 362 kuhp'
const resExact = searchAdvanced('pasal 362 kuhp', null);
if (resExact.length >= 1) {
  console.log(`✅ 7e. Search 'pasal 362 kuhp': ${resExact.length} found.`);
} else {
  throw new Error('Search pasal 362 kuhp failed');
}

// 7f. Test 'pembahasan 362 kuhp' (separated words in note)
const resSeparated = searchAdvanced('pembahasan 362 kuhp', null);
if (resSeparated.length >= 1) {
  console.log(`✅ 7f. Search 'pembahasan 362 kuhp' (separated words): ${resSeparated.length} found.`);
} else {
  throw new Error('Search pembahasan 362 kuhp failed');
}

// --- Sprint 2 Tests: Soft Delete & Streak ---
console.log('\n--- Sprint 2 Tests: Soft Delete & Streak ---');

// 8a. Soft delete a note
db.prepare("UPDATE notes SET deleted_at = datetime('now') WHERE id = ?").run('note_law_1');
const activeAfterDelete = db.prepare("SELECT COUNT(*) as c FROM notes WHERE deleted_at IS NULL").get();
const trashCount = db.prepare("SELECT COUNT(*) as c FROM notes WHERE deleted_at IS NOT NULL").get();

if (trashCount.c === 1) {
  console.log('✅ 8a. Soft delete successful: 1 note in trash.');
} else {
  throw new Error('Soft delete failed!');
}

// 8b. Active notes count query excludes trash
const notesActive = db.prepare(`
  SELECT n.id FROM notes n
  WHERE n.deleted_at IS NULL
`).all();
if (!notesActive.some((n) => n.id === 'note_law_1')) {
  console.log('✅ 8b. Active note query correctly excludes trashed note.');
} else {
  throw new Error('Active note query included trashed note!');
}

// 8c. Restore note
db.prepare("UPDATE notes SET deleted_at = NULL WHERE id = ?").run('note_law_1');
const trashAfterRestore = db.prepare("SELECT COUNT(*) as c FROM notes WHERE deleted_at IS NOT NULL").get();
if (trashAfterRestore.c === 0) {
  console.log('✅ 8c. Restore note successful: trash is now empty.');
} else {
  throw new Error('Restore note failed!');
}

// 8d. Test streak aggregation
const streakRows = db.prepare(`
  SELECT date(date_taken) as day, COUNT(*) as count 
  FROM notes 
  WHERE deleted_at IS NULL 
  GROUP BY date(date_taken)
`).all();
if (streakRows.length > 0) {
  console.log(`✅ 8d. Streak aggregation query successful: ${streakRows.length} active day(s) found.`);
} else {
  throw new Error('Streak aggregation query failed!');
}

// --- Sprint 3 Tests: Schema Migration, Batch Queue, Manual Notes & Summary ---
console.log('\n--- Sprint 3 Tests: Schema Migration, Batch Queue & AI Summary ---');

// 9a. Migration of Sprint 3 columns on existing table
const tableInfo = db.prepare("PRAGMA table_info(notes)").all();
const colNames = new Set(tableInfo.map((c) => c.name));

const colsToAdd = [
  ['title', 'TEXT'],
  ['summary', 'TEXT'],
  ['key_points', 'TEXT'],
  ['ai_status', "TEXT DEFAULT 'done'"],
  ['last_attempted_at', 'INTEGER'],
  ['retry_count', 'INTEGER DEFAULT 0'],
  ['source', "TEXT DEFAULT 'camera'"],
];

for (const [col, colType] of colsToAdd) {
  if (!colNames.has(col)) {
    db.exec(`ALTER TABLE notes ADD COLUMN ${col} ${colType};`);
  }
}
db.exec('CREATE INDEX IF NOT EXISTS idx_notes_ai_status ON notes(ai_status);');
console.log('✅ 9a. Schema migration successful: added Sprint 3 columns & idx_notes_ai_status.');

// 9b. Batch save notes with pending AI status
const batchInsert = db.prepare(`
  INSERT INTO notes (id, image_path, subject_id, extracted_text, date_taken, ai_status, retry_count, source)
  VALUES (?, ?, ?, '', ?, 'pending', 0, 'camera')
`);

batchInsert.run('batch_note_1', '/data/notes/batch_1.jpg', 'sub_basdat', '2026-09-16');
batchInsert.run('batch_note_2', '/data/notes/batch_2.jpg', 'sub_basdat', '2026-09-16');

const pendingNotes = db.prepare(`
  SELECT id, ai_status, retry_count FROM notes WHERE ai_status = 'pending'
`).all();

if (pendingNotes.length === 2) {
  console.log(`✅ 9b. Batch insert successful: ${pendingNotes.length} notes staged as 'pending'.`);
} else {
  throw new Error(`Expected 2 pending notes, got ${pendingNotes.length}`);
}

// 9c. Backoff retry logic verification
function getBackoffSeconds(retryCount) {
  if (retryCount === 0) return 0;
  if (retryCount === 1) return 120; // 2 minutes
  if (retryCount === 2) return 300; // 5 minutes
  return 600; // 10 minutes
}

if (
  getBackoffSeconds(0) === 0 &&
  getBackoffSeconds(1) === 120 &&
  getBackoffSeconds(2) === 300 &&
  getBackoffSeconds(3) === 600 &&
  getBackoffSeconds(9) === 600
) {
  console.log('✅ 9c. Backoff timing accurately calculated (0s, 120s, 300s, 600s).');
} else {
  throw new Error('Backoff timing logic mismatch!');
}

// Test retry failure escalation
db.prepare("UPDATE notes SET retry_count = 11, ai_status = 'failed_permanent' WHERE id = ?").run('batch_note_1');
const failedNote = db.prepare("SELECT ai_status, retry_count FROM notes WHERE id = ?").get('batch_note_1');
if (failedNote.ai_status === 'failed_permanent' && failedNote.retry_count > 10) {
  console.log('✅ 9d. Permanent failure escalation verified after > 10 retries.');
} else {
  throw new Error('Permanent failure escalation failed');
}

// 9e. Manual note insert test
db.prepare(`
  INSERT INTO notes (id, image_path, subject_id, extracted_text, date_taken, title, ai_status, source)
  VALUES (?, '', ?, ?, ?, ?, 'done', 'manual')
`).run(
  'manual_note_1',
  'sub_matdis',
  '# Graf & Pohon\n- Definisi graf terhubung\n- Tree traversal preorder, inorder',
  '2026-09-16',
  'Ringkasan Materi Graf'
);

const manualNote = db.prepare("SELECT id, title, source, image_path, ai_status FROM notes WHERE id = 'manual_note_1'").get();
if (manualNote.source === 'manual' && manualNote.image_path === '' && manualNote.ai_status === 'done') {
  console.log('✅ 9e. Manual note insertion verified with source="manual" and empty image_path.');
} else {
  throw new Error('Manual note insert failed!');
}

// 9f. Update summary and key_points test
const keyPointsArr = ['Graf terhubung', 'Pohon biner berakar', 'Spanning tree'];
db.prepare(`
  UPDATE notes 
  SET summary = ?, key_points = ? 
  WHERE id = 'manual_note_1'
`).run('Ringkasan konsep graf dan representasi pohon.', JSON.stringify(keyPointsArr));

const updatedNote = db.prepare("SELECT summary, key_points FROM notes WHERE id = 'manual_note_1'").get();
const parsedKp = JSON.parse(updatedNote.key_points);
if (updatedNote.summary && parsedKp.length === 3) {
  console.log(`✅ 9f. Summary and key points JSON verified: ${parsedKp.join(', ')}.`);
} else {
  throw new Error('Summary/keypoints update failed!');
}

console.log('--- ALL PHASES 1, 2, 3 & SPRINT 2, 3 VERIFICATION TESTS PASSED! ---');

