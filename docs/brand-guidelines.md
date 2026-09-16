# 🎨 Notia — Brand Identity & Guidelines System

> **Versi**: 1.0.0 (MVP Launch Edition)  
> **Guardian**: Agency Brand Guardian  
> **Tagline**: *Asisten Catatan Kuliah Pintar, Anti-Galeri Berantakan.*

---

## 1. 🎯 Brand Strategy & Foundation

### Brand Purpose
Membantu mahasiswa Indonesia belajar lebih tenang, terstruktur, dan efektif dengan mengeliminasi kekacauan foto catatan di galeri smartphone melalui otomatisasi AI vision lokal yang ramah privasi.

### Brand Vision
Menjadi standar aplikasi belajar harian (*daily academic companion*) nomor satu bagi jutaan mahasiswa di seluruh perguruan tinggi Indonesia.

### Brand Mission
Menghadirkan pengalaman *capture-and-organize* catatan kuliah yang instan, ringan (< 50MB), 100% *local-first*, dan bebas hambatan (*zero friction*), tanpa perlu repot mengetik ulang materi kuliah.

### Core Brand Values
1. **Empati Mahasiswa (*Student-First Empathy*)**: Mengerti betul kepanikan H-1 UTS/UAS saat catatan tercecer di antara ribuan meme dan tangkapan layar galeri.
2. **Kedaulatan Privasi (*Privacy by Default*)**: Catatan kuliah dan data akademik pengguna adalah milik mereka sendiri. Tidak ada data yang dijual atau dikirim ke server pihak ketiga tanpa izin.
3. **Kecepatan & Keringanan (*Lightning Simplicity*)**: Aplikasi harus terbuka dalam sekejap, responsif di segala spek ponsel Android mahasiswa, dan tidak membebani memori internal.
4. **Semangat Terbuka (*Open Source Collaboration*)**: Kode terbuka yang dapat diaudit, dikembangkan bersama, dan menjadi wadah belajar rekayasa perangkat lunak bagi komunitas mahasiswa IT Indonesia.

---

## 2. 🎭 Brand Personality & Tone of Voice

### Karakter Kepribadian
- **Sahabat Seperjuangan**: Hangat, suportif, dan senasib dengan mahasiswa yang sedang berjuang menembus semester berat.
- **Cerdas & Gesit**: Menggunakan teknologi AI modern (Groq Vision) untuk menyelesaikan masalah nyata dalam hitungan detik.
- **Rendah Hati & Anti-Jargon**: Menjelaskan fitur dengan istilah yang dipahami mahasiswa sehari-hari (*matkul*, *catatan*, *rumus*, *slide dosen*), bukan bahasa teknis yang membingungkan.

### Tone Variations
| Konteks | Karakteristik Tone | Contoh Copy |
| :--- | :--- | :--- |
| **Onboarding** | Antusias, menyambut, meyakinkan | *"Selamat Datang di Notia! Yuk beresin catatan kuliah lo biar siap hadapi UTS tanpa panik."* |
| **Pemrosesan AI** | Transparan, gesit, menghibur | *"AI Vision lagi membaca tulisan tangan dan slide materi kamu..."* |
| **Error / Edge Case** | Solutif, bersahabat, tanpa menyalahkan | *"Waduh, fotonya agak gelap nih. Boleh coba foto ulang dengan pencahayaan lebih terang?"* |
| **Sukses Simpan** | Memberi apresiasi (*rewarding*) | *"Mantap! Catatan berhasil masuk ke folder Kalkulus II."* |

---

## 3. 🎨 Visual Identity System

### Color Palette

#### Primary Palette
- **Notia Royal Blue** (`#2563EB` | RGB: `37, 99, 235`)
  - *Makna*: Fokus, kecerdasan, ketenangan akademis, dan keandalan teknologi.
  - *Penggunaan*: Tombol aksi utama (CTA), active tab bar, header aksen, icon branding.
- **Deep Indigo Accent** (`#4F46E5` | RGB: `79, 70, 229`)
  - *Makna*: Kedalaman logika, AI processing, dan inovasi.
  - *Penggunaan*: Badge AI vision, gradient aksen, banner informasi.

#### Functional Palette
- **Academic Emerald** (`#10B981` | RGB: `16, 185, 129`)
  - *Penggunaan*: Status berhasil simpan, chip mata kuliah terselesaikan, indikator sukses.
- **Study Amber** (`#F59E0B` | RGB: `245, 158, 11`)
  - *Penggunaan*: Peringatan kuota token, tips pencahayaan foto, highlight materi penting.
- **Exam Rose** (`#EF4444` | RGB: `239, 68, 68`)
  - *Penggunaan*: Hapus catatan, pesan kesalahan koneksi, tombol batalkan.

#### Neutral Palette (Dark & Light Mode)
| Token | Light Mode | Dark Mode | Penggunaan |
| :--- | :--- | :--- | :--- |
| **Background / Canvas** | `#F8FAFC` (Slate 50) | `#0F172A` (Slate 900) | Latar belakang layar utama |
| **Card / Surface** | `#FFFFFF` | `#1E293B` (Slate 800) | Kartu catatan, modal, bottom sheet |
| **Border / Divider** | `#E2E8F0` (Slate 200) | `#334155` (Slate 700) | Garis pemisah, outline kartu |
| **Text Primary** | `#0F172A` (Slate 900) | `#F8FAFC` (Slate 50) | Judul matkul, teks OCR utama |
| **Text Secondary** | `#64748B` (Slate 500) | `#94A3B8` (Slate 400) | Tanggal, subtitle, instruksi |

---

## 4. 🔤 Tipografi & Hierarki Teks

Menggunakan font sistem native (San Francisco di iOS, Roboto di Android, Inter di Web):
- **Display Heading**: 24pt / 28pt Bold — Judul layar (*Beranda*, *Kamera*, *Pencarian*).
- **Section Title**: 18pt Semi-Bold — Kategori mata kuliah, judul modul.
- **Card Title**: 16pt Medium / Semi-Bold — Nama mata kuliah pada kartu catatan.
- **Body Regular**: 14pt Regular (Line height: 20pt) — Hasil transkrip OCR catatan, deskripsi.
- **Caption & Meta**: 12pt Regular — Tanggal foto, jumlah catatan, badge status.

---

## 5. 🛡️ Panduan Penggunaan Logo & Aset Brand

### Aturan Utama (Dos & Don'ts)
- ✅ **DO**: Tampilkan logo dengan ruang bernafas (*clear space*) minimal 16px di sekelilingnya.
- ✅ **DO**: Gunakan kombinasi warna latar belakang ber-kontras tinggi (WCAG AA compliant).
- ❌ **DON'T**: Mengubah proporsi rasio logo (*stretching* atau *squishing*).
- ❌ **DON'T**: Menambahkan efek drop shadow tebal atau stroke gradien norak di atas logo.
- ❌ **DON'T**: Menggunakan warna teks abu-abu terang di atas background putih.
