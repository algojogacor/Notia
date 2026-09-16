# 📱 Panduan Arsitektur Halaman, Spesifikasi Fitur, & Panduan Redesign UI/UX - Notia

Dokumen ini disusun sebagai **spesifikasi lengkap** bagi perancang antarmuka (UI/UX Designer) yang ingin mendesain ulang (*redesign*) tampilan aplikasi **Notia**. Di dalamnya terdapat pemetaan seluruh halaman/layar, tujuan fungsi, elemen UI yang wajib ada, alur interaktivitas, hingga kebutuhan khusus untuk materi kuliah (termasuk teks hukum padat seperti KUHP, UU, dan pasal).

---

## 🗺️ Ikhtisar Struktur Navigasi Aplikasi

Aplikasi Notia dibangun menggunakan navigasi berbasis tab utama (*Bottom Tab Bar*) dengan alur detail (*Stack Navigation*) dan pop-up (*Modal Sheet*):

```
├── 📱 Bottom Tabs
│   ├── [Tab 1] Beranda / Dashboard Catatan (app/(tabs)/index.tsx)
│   ├── [Tab 2] Capture & Studio AI OCR (app/(tabs)/camera.tsx)
│   └── [Tab 3] Pencarian Cerdas / Smart Search (app/(tabs)/search.tsx)
├── 📄 Stack Screens
│   └── Detail Catatan & Reader Interaktif (app/note/[id].tsx)
├── ⚙️ Modals
│   ├── Pengaturan, Backup & Tentang Notia (app/modal.tsx)
│   ├── Tambah Mata Kuliah (components/AddSubjectModal.tsx)
│   └── Panduan Onboarding Awal (components/OnboardingModal.tsx)
```

---

## 1. Layar Beranda / Dashboard Catatan (`app/(tabs)/index.tsx`)

### A. Tujuan & Fungsi Utama
Pusat kendali materi kuliah mahasiswa. Berfungsi untuk melihat seluruh catatan yang tersimpan, memantau ringkasan statistik belajar, memfilter materi berdasarkan mata kuliah tertentu, serta beralih antara tampilan per mata kuliah (*folder view*) dan linimasa waktu (*timeline view*).

### B. Elemen & Komponen Desain yang Wajib Ada
1. **Header & Greeting Banner:**
   - Label badge identitas: `"SMART LECTURE NOTES"`.
   - Nama aplikasi: `"Notia"` dengan tagline edukatif (misal: *"Semua catatan kuliah terorganisir rapi untuk UTS & UAS"*).
   - Ikon/ilustrasi pendukung (misal: icon sparkles/buku).
2. **Shortcut Bar Pencarian Cepat (Quick Search Bar):**
   - Bar pencarian menyerupai input teks dengan ikon kaca pembesar dan teks panduan (*placeholder*): *"Cari rumus, definisi, atau catatan..."*.
   - Saat disentuh, langsung mengarahkan pengguna ke layar tab Pencarian (`/search`).
3. **Kartu Ringkasan Statistik (Stats Summary Cards - 3 Kolom):**
   - **Total Catatan:** Menampilkan angka total foto catatan yang tersimpan.
   - **Mata Kuliah:** Menampilkan jumlah mata kuliah aktif.
   - **Local-First:** Badge/ikon gembok bertuliskan `100% Local-First` untuk menegaskan keamanan data offline di SQLite.
4. **Banner Dampak Akademik & Viral Share (Academic Impact Card):**
   - Menghitung perkiraan waktu yang dihemat pengguna (contoh: `⚡ Hemat ~4.5 Jam Waktu Belajar!`).
   - Teks subjudul: Informasi jumlah catatan & mata kuliah tersusun rapi.
   - Tombol Aksi Cepat: Tombol `"Bagikan"` dengan ikon share untuk membagikan pencapaian belajar ke status WhatsApp / media sosial.
5. **Karusel Filter Mata Kuliah (Horizontal Chips Carousel):**
   - **Chip "Semua":** Menampilkan jumlah seluruh catatan.
   - **Chip Mata Kuliah Dinamis:** Setiap mata kuliah memiliki titik warna (*color dot*), nama mata kuliah, dan badge jumlah catatan di dalamnya.
   - **Tombol Reset Filter:** Tampil saat pengguna sedang memfilter salah satu matkul untuk membatalkan filter kembali ke semua catatan.
   - **Tombol "+ Matkul":** Tombol praktis membuka modal tambah mata kuliah baru tanpa perlu masuk menu pengaturan.
6. **Bilah Pengalih Mode Tampilan (View Mode Segmented Toggle):**
   - Judul seksi dinamis (menampilkan nama matkul terpilih atau nama mode saat ini).
   - Saklar dua mode:
     - **Mode Grup Matkul (`GROUPED`):** Catatan dikelompokkan ke dalam kartu folder per mata kuliah.
     - **Mode Linimasa (`TIMELINE`):** Semua catatan disusun mengalir berurutan secara kronologis.
7. **Kartu Catatan Kuliah (Note Card Component):**
   - **Thumbnail Foto:** Pratinjau gambar catatan berbentuk rasio kotak atau memanjang dengan rounded corner. Jika foto belum dimuat/rusak, sediakan icon fallback.
   - **Badge Mata Kuliah:** Label dengan warna tema mata kuliah terkait.
   - **Tanggal Catatan:** Format tanggal pengambilan foto (`YYYY-MM-DD`).
   - **Cuplikan Transkripsi OCR:** Menampilkan potongan teks materi (maksimal 2 baris dengan pemotongan ellipsis `...`).
   - **Indikator Navigasi:** Ikon panah kanan (`chevron-forward`) menandakan kartu dapat diklik.
8. **Header Seksi Grup (Section Header Bar):**
   - Digunakan pada mode `GROUPED`: Menampilkan garis aksen warna matkul, nama mata kuliah tebal, dan badge jumlah catatan dalam mata kuliah tersebut.
9. **Kondisi Kosong (Empty States):**
   - **Empty State Global (Belum ada catatan di aplikasi):** Ilustrasi/ikon kamera, teks persuasif mengajak memfoto catatan binder/papan tulis, serta tombol aksi utama (*CTA*): `"Foto Catatan Sekarang"`.
   - **Empty State Filter (Matkul terpilih belum memiliki catatan):** Ikon folder kosong, teks informasi, dan tombol CTA `"Ambil Foto Catatan"`.

---

## 2. Layar Capture & Studio AI OCR (`app/(tabs)/camera.tsx`)

### A. Tujuan & Fungsi Utama
Studio kerja untuk mengambil gambar catatan fisik (buku binder, buku tulis bergaris, whiteboard kelas, atau slide proyektor dosen), memprosesnya secara otomatis menggunakan Groq AI Vision (`Qwen 3.8-27B`), meninjau transkripsi teks hasil ekstraksi, dan menyimpannya ke database lokal. Layar ini memiliki alur kerja 5 tahap (*5-Step State Machine*).

### B. Rincian Desain Berdasarkan 5 Tahap Alur Kerja

#### Tahap 1: CAPTURE (Pengambilan Foto)
- **Viewfinder Interaktif (Bingkai Kamera):**
  - Kotak simulasi pemindaian dengan bingkai sudut (*corner brackets*) menyala.
  - Ikon scan dan instruksi: *"Arahkan ke tulisan tangan binder, whiteboard kelas, atau slide proyektor"*.
- **Tombol Aksi Pengambilan:**
  - **Tombol Utama (Primary CTA):** `"Ambil Foto (Kamera)"` dengan ikon kamera besar.
  - **Tombol Sekunder (Secondary):** `"Pilih dari Galeri"` untuk memilih foto yang sudah diambil sebelumnya.
- **Status API Groq Vision:**
  - Kartu status dengan indikator warna (Hijau = Aktif, Kuning/Oranye = Kunci API belum diisi).
  - Menjelaskan model yang digunakan: *Model Qwen 3.8-27B Vision siap membaca tulisan*.
- **Kartu Tips Kualitas Foto (Tips Card):**
  - Poin-poin tips: pencahayaan cukup, sudut tegak lurus, serta catatan bahwa singkatan umum (*yg, dgn, dsb.*) tetap bisa dibaca oleh AI.

#### Tahap 2: PREVIEW (Pratinjau & Pemilihan Aksi)
- **Frame Pratinjau Foto:** Menampilkan foto hasil jepretan secara proporsional.
- **Pemilih Mata Kuliah Cepat (Subject Selector):**
  - Label *"Simpan ke Mata Kuliah:"* + Tombol cepat `"+ Matkul"`.
  - Deretan chips horizontal mata kuliah yang sudah ada untuk langsung menentukan folder tujuan.
- **Bilah Tombol Aksi:**
  - **Tombol Utama Berkilau (Highlight):** `"Ekstrak Teks Tulisan (OCR AI) ✨"` untuk memicu pembacaan AI.
  - **Tombol Foto Ulang:** Menghapus foto saat ini dan kembali ke kamera jika hasil jepretan buram.
  - **Tombol Simpan Manual (Simpan Cepat):** Opsi untuk langsung menyimpan foto ke database tanpa menunggu ekstraksi AI (berguna saat sedang terburu-buru di kelas atau offline total).

#### Tahap 3: PROCESSING (Proses Ekstraksi AI Sedang Berjalan)
- **Animasi Loading Terpusat:**
  - Indikator aktivitas (spinner/animasi pemindaian cahaya).
  - Judul: *"Mengekstrak Teks Catatan"*.
  - Status teks dinamis: Menampilkan proses berjalan (misal: *"Menghubungi Groq Vision..."*, *"Membaca teks dan mengelompokkan materi..."*).
  - Teks penenang pengguna bahwa proses berjalan di latar belakang tanpa menghapus gambar.

#### Tahap 4: REVIEW & EDIT (Tinjauan Hasil AI & Koreksi Teks)
- **Header Tinjauan:** Judul *"Hasil Ekstraksi Teks (OCR)"* dengan subjudul panduan periksa.
- **Kartu Hasil Deteksi Cerdas (Detection Summary Card):**
  - Thumbnail kecil foto asli bersanding dengan nama mata kuliah yang otomatis diprediksi oleh AI.
  - Skor Akurasi AI: Menampilkan persentase kepastian AI (misal: `Akurasi AI: 95%`).
- **Kotak Rangkuman AI (AI Summary Card - Kontras Tinggi):**
  - Komponen penting bertanda `📌 Rangkuman AI`.
  - Menampilkan inti sari/ringkasan materi yang dirangkum otomatis dari tulisan di foto.
  - **Catatan Desain:** Wajib memiliki tingkat kontras yang sangat jelas baik di mode terang maupun mode gelap (dark mode).
- **Tagar Kata Kunci (Keyword Pills):**
  - Kumpulan tagar otomatis (contoh: `#pasal362`, `#kuhp`, `#hukumpidana`, `#syaratsah`).
  - Berfungsi memperkuat indeks pencarian cepat.
- **Pengubah Kategori Mata Kuliah:**
  - Pilihan jika pengguna ingin memindahkan catatan ke mata kuliah lain dari yang disarankan oleh AI, atau menambah mata kuliah baru di tempat.
- **Area Editor Teks Catatan (Editable Text Area):**
  - Kolom teks multiline berukuran luas tempat seluruh hasil transkripsi tulisan diletakkan.
  - Pengguna dapat mengetik, menambah, memperbaiki singkatan, atau menghapus bagian teks sebelum disimpan.
- **Tombol Aksi Akhir:**
  - Tombol Utama: `"Simpan ke Catatan Notia"` (dengan status loading saat menyimpan ke SQLite).
  - Tombol Sekunder: `"Batal"`.

#### Tahap 5: SUCCESS (Konfirmasi Penyimpanan)
- **Ikon Sukses & Pesan:** Centang animasi/ikon hijau besar bertuliskan *"Catatan Berhasil Disimpan!"*.
- **Kartu Mini Pratinjau Catatan Tersimpan:** Menampilkan badge matkul, tanggal, dan kutipan teks.
- **Tiga Tombol Navigasi:**
  1. `"Lihat Detail Catatan"` (Membuka langsung catatan tersebut).
  2. `"Ambil Foto Catatan Lagi"` (Kembali ke kamera untuk memfoto lembar berikutnya).
  3. `"Kembali ke Beranda"`.

---

## 3. Layar Pencarian Cerdas / Smart Search (`app/(tabs)/search.tsx`)

### A. Tujuan & Fungsi Utama
Mesin pencari instan *on-device* berbasis SQLite. Memungkinkan mahasiswa menemukan catatan spesifik dalam hitungan milidetik hanya dengan mengetik nomor pasal, definisi, rumus, atau potongan materi kuliah, bahkan saat ponsel dalam mode pesawat (*airplane mode*).

### B. Elemen & Komponen Desain yang Wajib Ada
1. **Search Input Bar:**
   - Ikon pencarian di sebelah kiri.
   - Kolom teks dengan pembersihan instan (tombol silang `X` saat ada teks).
   - Teks panduan: *"Cari rumus, materi, atau kata kunci..."*.
2. **Karusel Filter Lingkup Mata Kuliah (Scope Filter Chips):**
   - Pilihan chip `"Semua Matkul"` dan chip daftar mata kuliah individu dengan indikator warna.
   - Memungkinkan mahasiswa menyaring pencarian: misalnya mencari kata *"Pencurian"* khusus di dalam mata kuliah *"Hukum Pidana"*.
3. **Bilah Info Hasil (Results Info Bar):**
   - Tampil saat pencarian aktif: menampilkan jumlah hasil (misal: `"3 catatan ditemukan untuk 'pasal 362'"`).
   - Tombol `"Reset"` untuk mengembalikan ke kondisi awal.
4. **State Belum Mencari (Default Guidance State):**
   - Ilustrasi pencarian dengan penjelasan fitur SQLite offline.
   - **Kotak Tips Pencarian UTS/UAS:** Contoh kata kunci yang bisa dicari (contoh: pencarian pasal, asas hukum, topik bab tertentu).
5. **Daftar Hasil Pencarian (Search Results List):**
   - Menampilkan daftar kartu catatan yang cocok (*Note Card*) serupa dengan beranda.
   - Kartu menampilkan thumbnail foto, badge matkul, tanggal catatan, dan cuplikan teks yang mengandung kata kunci pencarian.
6. **State Tidak Ditemukan (Empty Search State):**
   - Ikon dokumen kosong dan pesan informatif bahwa kata kunci tidak ditemukan, disertai saran untuk mencoba kata kunci lain atau mengganti filter matkul.

---

## 4. Layar Detail Catatan & Reader Interaktif (`app/note/[id].tsx`)

### A. Tujuan & Fungsi Utama
Layar paling penting dalam aktivitas membaca dan mempelajari materi catatan. Pengguna meninjau foto catatan asli beresolusi tinggi, membaca transkripsi lengkap dari AI, menyalin teks, membagikan foto atau teks catatan ke WhatsApp/aplikasi lain, serta **berpindah halaman catatan menggunakan gesture swipe kiri/kanan**.

### B. Elemen & Komponen Desain yang Wajib Ada
1. **Header Navigasi (Top App Bar):**
   - Judul: Nama mata kuliah catatan.
   - Tombol Kembali (*Back arrow*).
   - Tombol Aksi Header:
     - Ikon Bagikan (*Share*).
     - Ikon Hapus (*Trash*) berwarna merah dengan konfirmasi dialog pencegahan salah tekan (*destructive alert*).
2. **Bar Informasi Metadata (Meta Bar):**
   - Badge nama mata kuliah dengan warna aksen matkul.
   - Badge tanggal pengambilan foto lengkap dengan ikon kalender.
3. **Penampil Foto Interaktif dengan Gesture Swipe (Interactive Photo Viewer):**
   - Foto catatan ditampilkan secara utuh dan proporsional (`contain`).
   - **Logika Navigasi Geser (Horizontal Swipe Gesture):**
     - Urutan kronologis dari kiri ke kanan: **Kiri = Terlama, Kanan = Terbaru**.
     - **Swipe ke Kiri (Geser layar ke kiri):** Berpindah ke catatan berikutnya yang lebih **baru**.
     - **Swipe ke Kanan (Geser layar ke kanan):** Berpindah ke catatan sebelumnya yang lebih **lama**.
   - **Tombol Panah Navigasi Mengambang (Floating Chevron Overlay):**
     - Tombol panah kiri `<` (tampil jika ada foto sebelumnya).
     - Tombol panah kanan `>` (tampil jika ada foto selanjutnya).
     - Membantu navigasi satu tangan tanpa harus melakukan swipe panjang.
   - **Badge Indikator Halaman (Paging Badge):**
     - Badge semi-transparan mengambang di bawah foto (contoh: `1 / 3 • Geser foto`).
4. **Kotak Transkripsi Materi AI Vision (AI Transcription Section):**
   - Header kotak: Judul *"Transkripsi Materi (AI Vision)"* dengan ikon sparkles.
   - **Tombol Salin Teks (Copy Button):** Tombol interaktif yang menyalin seluruh teks ke clipboard dengan umpan balik visual (*"Tersalin!"* berwarna hijau).
   - **Area Teks Transkripsi:** Menampilkan seluruh hasil ekstraksi teks. Font harus sangat nyaman dibaca, memiliki jarak antar baris (*line-height*) yang lega, dan membedakan paragraf dengan jelas untuk memudahkan membaca materi hukum/akademik yang panjang.
5. **Baris Tombol Aksi Utama (Action Buttons Row):**
   - **Tombol "Bagikan Catatan":** Membuka dialog pilihan:
     1. *"📸 Bagikan Foto Catatan (WA/Aplikasi)"* (mengirimkan file foto fisik langsung ke WhatsApp).
     2. *"📝 Bagikan Teks Catatan Saja"* (mengirimkan ringkasan teks catatan).
   - **Tombol "Hapus Catatan":** Tombol bertema peringatan (merah muda lembut / merah menyala) untuk menghapus catatan secara permanen.
6. **Kartu Footer Penyimpanan Lokal (Local Storage Info Card):**
   - Kotak informasi transparan berisikan ID Dokumen dan kepastian bahwa catatan disimpan secara on-device di SQLite perangkat.

---

## 5. Layar Pengaturan, Cadangan & Tentang (`app/modal.tsx`)

### A. Tujuan & Fungsi Utama
Layar modal konfigurasi sistem, pengelolaan kunci AI Groq dengan dukungan multi-kunci, fitur **Ekspor & Impor Cadangan Pindah HP (.notia)**, serta informasi transparansi privasi data.

### B. Elemen & Komponen Desain yang Wajib Ada
1. **Header Brand & Edukasi:**
   - Ikon aplikasi Notia bercahaya (*sparkles*), judul *"Tentang Notia"*, dan deskripsi fungsi aplikasi untuk mahasiswa Indonesia.
2. **Tombol Interaksi Sosial & Panduan:**
   - Tombol hijau menonjol: `"Bagikan Notia ke Teman Sekelas"`.
   - Tombol outlined: `"Lihat Panduan Onboarding"` (membuka kembali panduan 3 langkah awal).
3. **Kartu Konfigurasi Kunci Groq OCR (Multi-Key Management Card):**
   - Header dengan badge status: `X Kunci Aktif` (hijau) atau `Belum Diisi` (oranye).
   - Label model aktif: `Model OCR: qwen/qwen3.8-27b`.
   - Kolom teks multiline untuk memasukkan beberapa API key sekaligus (dipisahkan koma atau baris baru).
   - Keterangan sistem: *"Notia otomatis memutar (rotate) kunci saat limit kuota gratis tercapai"*.
   - Tombol aksi: `"Simpan Kunci API"`.
4. **Kartu Cadangan & Pindah HP (Full Backup & Restore Card):**
   - Deskripsi manfaat: Mengemas seluruh mata kuliah, catatan, transkripsi, dan foto fisik ke dalam format berkas tunggal `.notia`.
   - **Tombol Ekspor Cadangan:** `"Ekspor Cadangan (.notia)"` dengan ikon awan unggah. Menjalankan pengemasan dan membuka sheet berbagi (Google Drive, WhatsApp, File Manager).
   - **Tombol Impor Cadangan:** `"Impor / Pulihkan Cadangan"` dengan ikon awan unduh. Membuka pemilih file sistem (*document picker*) untuk memulihkan seluruh data dan foto tanpa perlu koneksi internet.
   - Status visual loading (*spinner*) saat proses ekspor/impor sedang berjalan.
5. **Kartu Pernyataan Privasi (100% Local-First Guarantee):**
   - Penjelasan bahwa Notia tidak menyimpan data pengguna ke server eksternal, seluruh foto dan catatan berada di penyimpanan internal smartphone.

---

## 6. Komponen Modal Tambahan

### A. Modal Tambah Mata Kuliah (`components/AddSubjectModal.tsx`)
- **Tipe Tampilan:** Dialog modal semi-transparan / Bottom Sheet.
- **Input Nama Matkul:** Kolom input teks nama mata kuliah baru.
- **Pill Rekomendasi Cepat (Preset Suggestions):** Daftar chip mata kuliah umum (misal: *Hukum Pidana, Hukum Perdata, Hukum Tata Negara, Pancasila, Pengantar Ilmu Hukum, Basis Data, dsb.*) yang bisa diklik untuk langsung mengisi input.
- **Palet Pemilih Warna (Color Palette Picker):** Pilihan lingkaran warna-warni kontras tinggi (Indigo, Hijau Emerald, Biru Laut, Merah Bata, Ungu Violet, dsb.) untuk memberi warna identitas pada mata kuliah.
- **Tombol Aksi:** Tombol `"Batal"` dan `"Simpan Mata Kuliah"`.

### B. Modal Panduan Awal / Onboarding (`components/OnboardingModal.tsx`)
- **Tipe Tampilan:** Modal layar penuh / popup sambutan saat pertama kali membuka aplikasi.
- **Karusel 3 Slide:**
  1. **Capture Cepat:** Ilustrasi kamera + jepret catatan binder, whiteboard, slide dosen.
  2. **Groq AI Vision:** Ilustrasi kecerdasan buatan + ekstraksi teks & auto-kategorisasi matkul.
  3. **Zero-Friction UTS & UAS:** Ilustrasi pencarian offline + siap menghadapi ujian tanpa foto tercecer di galeri.
- **Indikator Titik (Pagination Dots):** Menunjukkan slide aktif (1 dari 3).
- **Tombol Langkah:** `"Lanjut"` hingga slide terakhir berubah menjadi `"Mulai Belajar Sekarang"`.

---

## 7. Bottom Tab Bar (`app/(tabs)/_layout.tsx`)

Bilah navigasi bawah yang selalu hadir di layar utama aplikasi:
1. **Tab 1 - Beranda:** Ikon buku (`book` / `book-outline`), label *"Beranda"*. Memiliki tombol informasi di pojok kanan atas (*headerRight*) menuju layar Pengaturan (`/modal`).
2. **Tab 2 - Kamera:** Ikon kamera (`camera` / `camera-outline`), label *"Kamera"*. Posisi di tengah, dapat didesain lebih menonjol (Floating Action Button style).
3. **Tab 3 - Cari:** Ikon kaca pembesar (`search` / `search-outline`), label *"Cari"*.

---

## 8. Panduan Khusus untuk Redesign UI/UX Notia

Bagi desainer yang ingin memoles antarmuka Notia, berikut adalah prinsip-prinsip penting yang perlu dipertahankan dan ditingkatkan:

### 1. Keterbacaan Teks Padat (Readability for Dense Academic Text)
- Mahasiswa (khususnya anak hukum) sering memfoto dokumen berisikan banyak pasal, ayat, dan doktrin hukum.
- Gunakan tipografi dengan tingkat keterbacaan tinggi (misal: *Inter*, *Plus Jakarta Sans*, atau *SF Pro*).
- Berikan `line-height` minimal 1.5x ukuran font pada area transkripsi teks agar mata tidak lelah membaca rangkuman panjang.

### 2. Standar Kontras Tinggi (High Contrast in Light & Dark Mode)
- Hindari penggunaan warna abu-abu pudar untuk teks penting di kartu rangkuman AI.
- Pada **Mode Terang (Light Mode)**: Gunakan background putih `#FFFFFF` atau slate cerah `#F8FAFC`, kartu `#FFFFFF`, border halus `#E2E8F0`, dan teks utama `#0F172A`.
- Pada **Mode Gelap (Dark Mode)**: Gunakan background `#0B0F19` atau `#0F172A`, kartu `#1E293B`, border `#334155`, dan teks utama `#F8FAFC`. Kartu Rangkuman AI menggunakan aksen biru/indigo `#93C5FD`.

### 3. Jangkauan Ibu Jari (Thumb-Friendly Ergonomics)
- Tombol aksi krusial saat di kelas (seperti tombol Shutter Kamera, tombol Salin Teks, tombol Bagikan, dan tombol Panah Navigasi Foto) harus berada di area yang mudah dijangkau satu tangan (area bawah layar).
- Tombol panah geser foto pada layar detail catatan harus memiliki padding sentuhan yang cukup besar (*hitSlop*) agar mudah disentuh saat membaca cepat.

### 4. Indikator Warna Mata Kuliah (Color Coding System)
- Setiap mata kuliah memiliki warna unik yang konsisten di semua layar:
  - Muncul di chip filter beranda.
  - Muncul di badge kartu catatan.
  - Muncul sebagai aksen garis pemisah seksi folder.
  - Membantu mahasiswa membedakan mata kuliah secara visual dalam sepersekian detik.

---

*Dokumen ini dapat digunakan sebagai referensi utama dalam pembuatan wireframe, komponen design system di Figma, maupun implementasi kode antarmuka di React Native / Expo.*
