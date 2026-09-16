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
├── .github/workflows/
│   └── ci.yml               # Pipeline CI/CD GitHub Actions
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx      # Bottom Tab Navigator (Beranda, Kamera, Cari)
│   │   ├── index.tsx        # Screen Beranda: Ringkasan catatan, chip matkul, banner efisiensi
│   │   ├── camera.tsx       # Screen Kamera: Multi-step capture, preview & OCR vision
│   │   └── search.tsx       # Screen Pencarian: Input pencarian multi-kriteria & SQLite
│   ├── note/
│   │   └── [id].tsx         # Screen Detail Catatan: Foto full, salin teks & share
│   ├── _layout.tsx          # Root Layout + SQLiteProvider initialization
│   └── modal.tsx            # Informasi app, share ke teman & panduan onboarding
├── components/
│   └── OnboardingModal.tsx  # 3-slide guide untuk mahasiswa baru
├── docs/
│   ├── index.html           # Web Showcase Landing Page (Tailwind CSS)
│   ├── brand-guidelines.md  # Panduan identitas visual & tone of voice
│   ├── growth-playbook.md   # Strategi viral loops & kampus ambassador
│   └── launch-pack.md       # Copywriting peluncuran (Twitter/X, WA, TikTok)
├── src/
│   ├── db/
│   │   ├── schema.ts        # DDL SQLite (tabel subjects, notes, index, seed)
│   │   └── database.ts      # Helper query CRUD, stats, & migrasi database
│   ├── services/
│   │   ├── analytics.ts     # Local-only academic stats & viral share generator
│   │   └── groq.ts          # Groq Multimodal Vision API client
│   ├── types/
│   │   └── index.ts         # Definisi tipe domain (Subject, Note, GroqResult)
│   └── constants/
│       └── Colors.ts        # Tema warna Notia (Light & Dark mode)
├── .env.example             # Template konfigurasi environment
├── app.json                 # Konfigurasi aplikasi Android (com.notia.app)
├── eas.json                 # Konfigurasi EAS Build Standalone APK
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

### 5. Build Standalone APK Android & Quality Gates
```bash
# Typecheck TypeScript
npm run typecheck

# Pengujian SQLite Database
npm run test:db

# Benchmark Latensi & Ukuran Bundle
npm run benchmark

# Export bundle native Android
npm run export:android

# Build standalone APK via EAS (dapat langsung diinstall di HP)
npm run build:apk:preview
```

---

## 📚 Dokumentasi & Resource Ekosistem

- 🌐 **[Web Showcase Landing Page](docs/index.html)** — Halaman showcase interaktif siap deploy ke GitHub Pages.
- 🎨 **[Brand Identity & Guidelines System](docs/brand-guidelines.md)** — Panduan warna brand, tipografi, dan tone of voice mahasiswa.
- 📈 **[Growth Hacker Playbook](docs/growth-playbook.md)** — Strategi viral loop K-factor, aktivasi 60 detik, dan program campus ambassador.
- 🚀 **[Marketing Launch Campaign Pack](docs/launch-pack.md)** — Thread Twitter/X viral 7-tweet, pesan siaran WhatsApp kelas, storyboard TikTok 30s.

---

## 📋 Roadmap Sprint Notia

- [x] **PHASE 1 — Foundation (Week 1)**:
  - Inisialisasi project Expo + TypeScript dengan struktur scalable.
  - Navigasi dasar (Bottom Tab: Home, Camera, Search) + Detail Screen.
  - Integrasi database lokal `expo-sqlite` dengan skema `subjects` dan `notes`.
  - Groq API client setup untuk multimodal vision (env variable secure).
  - Dokumentasi README lengkap.
- [x] **PHASE 2 — Core Feature: Capture & AI (Week 1-2)**:
  - Kamera & galeri picker (`expo-image-picker`, `expo-file-system`).
  - Groq vision multimodal pipeline (`llama-3.2-11b-vision-preview`).
  - Auto-kategorisasi mata kuliah tersimpan ke SQLite lokal.
- [x] **PHASE 3 — Browse & Search (Week 2)**:
  - Filter catatan per mata kuliah dengan SectionList dan Timeline.
  - Full-text multi-criteria search catatan kuliah.
  - Salin hasil OCR ke clipboard (`expo-clipboard`) & native share.
- [x] **PHASE 4 — Polish & QA (Week 3)**:
  - Haptic tactile feedback (`expo-haptics`) di setiap interaksi penting.
  - Onboarding modal 3-slide untuk mahasiswa baru (`@react-native-async-storage/async-storage`).
  - Penanganan edge cases (kamera ditolak, offline, foto tanpa teks).
  - Benchmark latensi sub-millisecond dan verifikasi ukuran app < 50MB.
- [x] **PHASE 5 — Launch Prep (Week 3-4)**:
  - Standalone APK configuration (`eas.json` & `package: "com.notia.app"`).
  - Otomasi CI/CD GitHub Actions (`.github/workflows/ci.yml`).
  - Panduan identitas brand (`docs/brand-guidelines.md`).
  - Product-Led Growth & local analytics tracker (`src/services/analytics.ts` & `docs/growth-playbook.md`).
  - Launch marketing pack (`docs/launch-pack.md`) & Web Showcase Landing Page (`docs/index.html`).
- [ ] **PHASE 6 — Live & Feedback (Week 4+)**:
  - Beta testing dengan mahasiswa pilot (UI, ITB, UGM, ITS, Telkom).
  - Pengumpulan feedback & triage issues.

---

## 📄 Lisensi

Open Source under the [MIT License](LICENSE). Dibuat untuk ekosistem mahasiswa Indonesia.

