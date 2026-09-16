# 📚 Notia — Smart Lecture Notes Organizer

> **Auto-organisir foto catatan kuliah pakai AI vision untuk mahasiswa Indonesia.**  
> Local-first, zero-friction, open source.

---

## 🎯 Latar Belakang & Masalah

* **Core Pain**: Foto catatan kuliah bercampur aduk dengan ribuan foto di galeri smartphone (meme, screenshot, foto makanan). Saat minggu UTS dan UAS tiba, mahasiswa panik mencari rumus atau catatan penting yang tercecer.
* **Solusi Notia**: 
  1. 📷 Ambil foto catatan kuliah (tulisan tangan di buku tulis, papan tulis kelas, atau slide proyektor dosen).
  2. 🧠 AI Vision (Groq Multimodal) otomatis membaca dan mengekstrak teks materi (OCR).
  3. 🏷️ Otomatis mengkategorikan foto ke dalam mata kuliah yang relevan (Matematika Diskrit, Basis Data, Sistem Operasi, dll.).
  4. 🔍 Pencarian secepat kilat menggunakan database lokal SQLite kapan pun dibutuhkan.
  5. 🔒 **Local-first & Privacy-first**: Seluruh catatan dan metadata tersimpan di perangkat lokal pengguna.

---

## 🛠️ Tech Stack

| Komponen | Teknologi | Keterangan |
| :--- | :--- | :--- |
| **Framework** | [Expo](https://expo.dev) (React Native) | SDK 57, New Architecture ready |
| **Bahasa** | TypeScript | Strict type checking |
| **Navigasi** | [Expo Router](https://docs.expo.dev/router/introduction/) | File-based routing (Tabs & Stack) |
| **Database Lokal** | [`expo-sqlite`](https://docs.expo.dev/versions/latest/sdk/sqlite/) | Local-first relational database dengan foreign keys & indexing |
| **AI Vision Engine** | [Groq API](https://console.groq.com) | Multimodal Vision (`llama-3.2-11b-vision-preview`) |
| **Icons & UI** | `@expo/vector-icons` (Ionicons) | Responsive cross-platform styling |

---

## 📁 Struktur Direktori

```
D:\Projects\Notia\
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx      # Bottom Tab Navigator (Beranda, Kamera, Cari)
│   │   ├── index.tsx        # Screen Beranda: Ringkasan catatan, chip mata kuliah
│   │   ├── camera.tsx       # Screen Kamera: Viewfinder & status Groq vision
│   │   └── search.tsx       # Screen Pencarian: Input pencarian & query SQLite
│   ├── note/
│   │   └── [id].tsx         # Screen Detail Catatan: Foto, transkripsi teks, metadata
│   ├── _layout.tsx          # Root Layout + SQLiteProvider initialization
│   └── modal.tsx            # Informasi app & status sprint
├── src/
│   ├── db/
│   │   ├── schema.ts        # DDL SQLite (tabel subjects, notes, index, seed)
│   │   └── database.ts      # Helper query CRUD, stats, & migrasi database
│   ├── services/
│   │   └── groq.ts          # Groq Multimodal Vision API client
│   ├── types/
│   │   └── index.ts         # Definisi tipe domain (Subject, Note, GroqResult)
│   └── constants/
│       └── Colors.ts        # Tema warna Notia (Light & Dark mode)
├── .env.example             # Template konfigurasi environment
├── .gitignore
├── app.json
├── package.json
└── README.md
```

---

## 🗄️ Skema Database (SQLite)

Notia menggunakan skema relasional local-first di perangkat pengguna:

```sql
-- Tabel Mata Kuliah / Subjects
CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tabel Catatan / Notes
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY NOT NULL,
  image_path TEXT NOT NULL,
  subject_id TEXT,
  extracted_text TEXT,
  date_taken TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE SET NULL
);

-- Indeks untuk query cepat
CREATE INDEX IF NOT EXISTS idx_notes_subject_id ON notes(subject_id);
CREATE INDEX IF NOT EXISTS idx_notes_date_taken ON notes(date_taken DESC);
CREATE INDEX IF NOT EXISTS idx_subjects_name ON subjects(name);
```

---

## 🚀 Panduan Memulai (Quickstart)

### 1. Prasyarat
- Node.js versi 18+ (Disarankan versi LTS atau 20+)
- Perangkat Android (atau Android Emulator / Expo Go di HP)

### 2. Instalasi Dependensi
```bash
cd D:\Projects\Notia
npm install
```

### 3. Konfigurasi Environment Variable
Salin template `.env.example` ke `.env`:
```bash
cp .env.example .env
```
Buka file `.env` dan masukkan API Key Groq Anda:
```env
EXPO_PUBLIC_GROQ_API_KEY=gsk_your_groq_api_key_here
```
> **Catatan**: API Key gratis bisa didapatkan di [Groq Console](https://console.groq.com/keys).

### 4. Menjalankan Aplikasi
```bash
# Menjalankan Metro bundler
npx expo start

# Untuk menjalankan langsung di emulator Android:
npx expo start --android

# Untuk mencoba tampilan web:
npx expo start --web
```

---

## 📋 Roadmap Sprint Notia

- [x] **PHASE 1 — Foundation (Week 1)**:
  - Inisialisasi project Expo + TypeScript dengan struktur scalable.
  - Navigasi dasar (Bottom Tab: Home, Camera, Search) + Detail Screen.
  - Integrasi database lokal `expo-sqlite` dengan skema `subjects` dan `notes`.
  - Groq API client setup untuk multimodal vision (env variable secure).
  - Dokumentasi README lengkap.
- [ ] **PHASE 2 — Core Feature: Capture & AI (Week 1-2)**:
  - Kamera fungsional (expo-camera).
  - Groq vision multimodal pipeline (transkrip teks catatan kuliah Indonesia).
  - Auto-kategorisasi mata kuliah tersimpan ke SQLite.
- [ ] **PHASE 3 — Browse & Search (Week 2)**:
  - Filter catatan per mata kuliah.
  - Full-text search catatan kuliah.
- [ ] **PHASE 4 — Polish & QA (Week 3)**:
  - Dark mode support, haptics, error handling.
- [ ] **PHASE 5 — Launch Prep (Week 3-4)**:
  - Build standalone APK untuk distribusi mahasiswa.
- [ ] **PHASE 6 — Live & Feedback (Week 4+)**:
  - Beta testing dengan 5+ mahasiswa, triage feedback.

---

## 📄 Lisensi

Open Source under the [MIT License](LICENSE). Dibuat untuk ekosistem mahasiswa Indonesia.
