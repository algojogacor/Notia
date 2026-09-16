import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { GroqVisionAnalysisResult, AiEditorResult, AiDiffSection } from '../types';

/**
 * Groq Vision API Service for Notia
 * Optimized for high-accuracy OCR on Indonesian college notes
 * Features: Multi-key rotation, auto-failover, and offline tolerance
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const DEFAULT_VISION_MODEL =
  process.env.EXPO_PUBLIC_GROQ_MODEL || 'qwen/qwen3.8-27b';
const REQUEST_TIMEOUT_MS = 30000;
const STORAGE_KEYS_KEY = '@notia_groq_api_keys';

let cachedKeys: string[] | null = null;
let currentKeyIndex = 0;

/**
 * Parse string of keys (separated by commas or newlines) into a clean array
 */
export function parseApiKeys(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 5 && !k.includes('your_groq_api_key'));
}

/**
 * Retrieve all configured Groq API keys (from AsyncStorage, falling back to .env)
 */
export async function getGroqApiKeys(): Promise<string[]> {
  if (cachedKeys !== null && cachedKeys.length > 0) {
    return cachedKeys;
  }

  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS_KEY);
    if (stored) {
      const parsed = parseApiKeys(stored);
      if (parsed.length > 0) {
        cachedKeys = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to read stored Groq API keys:', err);
  }

  // Fallback to environment variable
  const envKeysRaw =
    process.env.EXPO_PUBLIC_GROQ_API_KEY ||
    Constants.expoConfig?.extra?.groqApiKey ||
    '';
  const envParsed = parseApiKeys(envKeysRaw);
  cachedKeys = envParsed;
  return envParsed;
}

/**
 * Save user API keys to AsyncStorage
 */
export async function saveGroqApiKeys(keysInput: string | string[]): Promise<string[]> {
  const rawString = Array.isArray(keysInput) ? keysInput.join(',') : keysInput;
  const cleaned = parseApiKeys(rawString);
  cachedKeys = cleaned;
  await AsyncStorage.setItem(STORAGE_KEYS_KEY, cleaned.join(','));
  return cleaned;
}

/**
 * Check if at least one Groq API key is configured (synchronous check)
 */
export function isGroqConfigured(): boolean {
  if (cachedKeys !== null) return cachedKeys.length > 0;
  const envRaw = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
  return parseApiKeys(envRaw).length > 0;
}

/**
 * Build dynamic OCR-focused system prompt
 */
function buildOcrSystemPrompt(existingSubjects?: string[]): string {
  const subjectsGuidance =
    existingSubjects && existingSubjects.length > 0
      ? `\nDaftar mata kuliah aktif pengguna saat ini:\n[${existingSubjects.join(
          ', '
        )}]\nJika isi teks sangat sesuai dengan salah satu mata kuliah di atas, gunakan nama tersebut pada "suggested_subject". Jika materi berbeda, usulkan nama mata kuliah yang baku dan ringkas.`
      : '';

  return `
Kamu adalah mesin OCR cerdas untuk aplikasi "Notia", yang bertugas mengekstrak teks materi perkuliahan mahasiswa Indonesia (Hukum, Sains, Teknik, Ekonomi, Sosial, dll.).
Gambar dapat berupa:
- Tulisan tangan binder / buku catatan (sering miring, cepat, singkatan umum seperti: "yg", "dgn", "utk", "sbg", "krn", "dlm", "thd", "bdsrkn")
- Catatan pasal-pasal hukum, asas hukum, undang-undang, atau materi kebangsaan (Pancasila / PKn)
- Papan tulis ruang kuliah dengan tulisan spidol/kapur
- Slide presentasi proyektor dosen

TUGAS UTAMA (FOKUS OCR):
1. Ekstrak dan transkrip SELURUH teks yang terbaca pada gambar dengan tingkat ketelitian maksimal ke dalam "extracted_text".
2. Pertahankan struktur tulisan asli: poin-poin bertingkat (bullet points), nomor pasal/ayat, judul bab, dan penomoran.
3. Tuliskan teks secara bersih, rapi, dan mudah dibaca mahasiswa.
4. Identifikasi saran mata kuliah (suggested_subject) sebagai bantuan referensi.${subjectsGuidance}
5. Buat ringkasan materi 1-2 kalimat (summary) dan 3-5 kata kunci penting (keywords).

Keluarkan hasil HANYA dalam format JSON valid:
{
  "extracted_text": "...",
  "suggested_subject": "...",
  "confidence": 0.95,
  "summary": "...",
  "keywords": ["...", "..."]
}
`;
}

export interface AnalyzeNoteOptions {
  imageBase64: string;
  mimeType?: string;
  model?: string;
  existingSubjects?: string[];
}

/**
 * Send note image to Groq Vision API with automatic multi-key rotation and failover
 */
export async function analyzeLectureNote({
  imageBase64,
  mimeType = 'image/jpeg',
  model = DEFAULT_VISION_MODEL,
  existingSubjects,
}: AnalyzeNoteOptions): Promise<GroqVisionAnalysisResult> {
  const keys = await getGroqApiKeys();

  if (keys.length === 0) {
    throw new Error(
      'Kunci API Groq belum disetel. Silakan masukkan API Key di menu Tentang/Pengaturan Notia.'
    );
  }

  const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
  const dataUrl = `data:${mimeType};base64,${cleanBase64}`;

  let lastError: any = null;
  const attempts = keys.length;

  for (let i = 0; i < attempts; i++) {
    const keyToUse = keys[currentKeyIndex % keys.length];
    currentKeyIndex++; // rotate for next call

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${keyToUse}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: buildOcrSystemPrompt(existingSubjects),
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Lakukan ekstraksi teks tulisan (OCR) dari foto catatan kuliah ini secara lengkap dan terstruktur.',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: dataUrl,
                  },
                },
              ],
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 2048,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = `Groq HTTP ${response.status}`;
        try {
          const errObj = JSON.parse(errorText);
          errorMsg = errObj.error?.message || errorMsg;
        } catch {}

        // If rate limited or unauthorized, try next key in rotation
        if (response.status === 429 || response.status === 401) {
          console.warn(
            `Groq Key ${keyToUse.substring(0, 10)}... failed (${response.status}: ${errorMsg}). Trying next key...`
          );
          lastError = new Error(errorMsg);
          continue;
        }

        throw new Error(errorMsg);
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content;

      if (!rawContent) {
        throw new Error('Respon dari OCR Groq kosong. Coba foto catatan lain.');
      }

      const parsed: GroqVisionAnalysisResult = JSON.parse(rawContent);

      return {
        extracted_text:
          parsed.extracted_text && parsed.extracted_text.trim().length > 0
            ? parsed.extracted_text.trim()
            : 'Teks tidak terbaca secara jelas.',
        suggested_subject:
          parsed.suggested_subject && parsed.suggested_subject.trim().length > 0
            ? parsed.suggested_subject.trim()
            : 'Umum',
        confidence:
          typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
        summary: parsed.summary,
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      };
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        throw new Error(
          'Koneksi waktu habis (Timeout 30s). Foto terlalu besar atau jaringan sedang lambat.'
        );
      }

      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error(
          'Tidak ada koneksi internet. Pastikan perangkat terhubung ke WiFi atau data seluler.'
        );
      }

      lastError = err;
      // If we have more keys and it's a transient issue, continue to next key
      if (i < attempts - 1) {
        continue;
      }
    }
  }

  throw lastError || new Error('Gagal memproses OCR dengan seluruh API Key yang tersedia.');
}

export interface RequestAiEditorDiffOptions {
  fullText: string;
  userPrompt: string;
  noteTitle?: string;
  model?: string;
}

/**
 * AI Targeted Diff Editor:
 * Strictly analyzes the user request and returns targeted section diffs, preserving
 * the rest of the text. Supports flowchart, mind map, and table diagrams.
 * Language matches the note content language.
 */
export async function requestAiEditorDiff({
  fullText,
  userPrompt,
  noteTitle,
  model = DEFAULT_VISION_MODEL,
}: RequestAiEditorDiffOptions): Promise<AiEditorResult> {
  const keys = await getGroqApiKeys();

  if (keys.length === 0) {
    throw new Error(
      'Kunci API Groq belum disetel. Harap atur API Key di menu Pengaturan.'
    );
  }

  const systemPrompt = `
You are an expert targeted in-place text editor for the "Notia" student notebook app.
Your role is a TARGETED IN-LINE EDITOR, NOT A FULL DOCUMENT REWRITER.

CRITICAL RULES:
1. TARGETED ONLY: Analyze the user request and modify/generate diffs ONLY for the targeted section or specific paragraph. PRESERVE all other parts of the document completely untouched.
2. NO FULL REPLACEMENT: You must NEVER replace or rephrase the entire document for a request that only asks to improve, summarize, or add to a specific part.
3. PRESERVE LANGUAGE: You MUST generate suggestions and respond in the EXACT SAME LANGUAGE as the note content (e.g., if the note is in Indonesian, use Indonesian; if in English, use English; if mixed, follow the language of the targeted text). Do NOT default to any language regardless of the language used in the prompt.
4. DIAGRAMS: If the user asks for a diagram, flowchart, mind map, or comparison table in natural language (e.g., "buatkan flowchart proses legislasi", "buat mindmap dari catatan ini", "jadikan tabel perbandingan"):
   - Interpret the intent and choose the most suitable diagram format (flowchart, mind map, table).
   - Generate clean, beautifully formatted ASCII/Unicode text diagram:
     - Flowchart: Unicode arrows and boxes (e.g. [Tahap 1] ──> [Tahap 2])
     - Mind Map: Tree branches (e.g. ├── Cabang A / └── Cabang B)
     - Table: Markdown table syntax (| Kolom 1 | Kolom 2 |)
   - Set diagram_type to 'flowchart' | 'mindmap' | 'table'.
5. STRUCTURED DIFF: Output must be an array of diff items with:
   - "id": string identifier ("diff-1", "diff-2", etc.)
   - "type": "replace" | "insert" | "delete" | "diagram"
   - "original": the exact verbatim substring from original text that is changed (or empty if insert)
   - "suggested": the replacement or newly inserted text
   - "diagram_type": "flowchart" | "mindmap" | "table" | null
6. "explanation": Brief 1-sentence explanation of what was changed, written in the note's language.

OUTPUT FORMAT (JSON ONLY, NO MARKDOWN OUTSIDE JSON):
{
  "explanation": "...",
  "diffs": [
    {
      "id": "diff-1",
      "type": "replace",
      "original": "...",
      "suggested": "...",
      "diagram_type": null
    }
  ]
}
`;

  let lastError: any = null;
  const attempts = keys.length;

  for (let i = 0; i < attempts; i++) {
    const keyToUse = keys[currentKeyIndex % keys.length];
    currentKeyIndex++;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${keyToUse}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: `Judul Catatan: "${noteTitle || 'Tanpa Judul'}"\n\nIsi Catatan Saat Ini:\n"""\n${fullText}\n"""\n\nPermintaan Edit dari Pengguna:\n"${userPrompt}"`,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_tokens: 2048,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = `Groq HTTP ${response.status}`;
        try {
          const errObj = JSON.parse(errorText);
          errorMsg = errObj.error?.message || errorMsg;
        } catch {}

        if (response.status === 429 || response.status === 401) {
          lastError = new Error(errorMsg);
          continue;
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content;
      if (!rawContent) {
        throw new Error('Respon AI kosong.');
      }

      const parsed = JSON.parse(rawContent);
      const diffs: AiDiffSection[] = Array.isArray(parsed.diffs)
        ? parsed.diffs.map((d: any, idx: number) => ({
            id: d.id || `diff-${idx + 1}`,
            type: d.type || 'replace',
            original: typeof d.original === 'string' ? d.original : '',
            suggested: typeof d.suggested === 'string' ? d.suggested : '',
            diagram_type: d.diagram_type || null,
          }))
        : [];

      return {
        explanation: parsed.explanation || 'Saran perbaikan dari AI',
        diffs,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;
      if (i < attempts - 1) continue;
    }
  }

  throw lastError || new Error('Gagal menghubungi AI editor.');
}

export interface GenerateSummaryResult {
  summary: string;
  key_points: string[];
}

/**
 * Generate 1-2 sentence summary and 3-5 key points for existing note text
 */
export async function generateSummaryAndKeyPointsForText(
  text: string,
  model = DEFAULT_VISION_MODEL
): Promise<GenerateSummaryResult> {
  const keys = await getGroqApiKeys();
  if (keys.length === 0) {
    throw new Error('Kunci API Groq belum disetel.');
  }

  const systemPrompt = `
Kamu adalah asisten studi perkuliahan untuk aplikasi "Notia".
Tugasmu:
1. Buat "summary": Ringkasan padat 1-2 kalimat dari inti materi.
2. Buat "key_points": Array berisi 3-5 konsep penting / kata kunci pokok perkuliahan.
Gunakan bahasa yang sama persis dengan bahasa catatan (Bahasa Indonesia jika materi bahasa Indonesia, Inggris jika bahasa Inggris).

Output format JSON ONLY:
{
  "summary": "...",
  "key_points": ["konsep 1", "konsep 2", "konsep 3"]
}
`;

  let lastError: any = null;
  const attempts = keys.length;

  for (let i = 0; i < attempts; i++) {
    const keyToUse = keys[currentKeyIndex % keys.length];
    currentKeyIndex++;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${keyToUse}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Teks materi perkuliahan:\n\n${text}` },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 1024,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = `Groq HTTP ${response.status}`;
        try {
          const errObj = JSON.parse(errorText);
          errorMsg = errObj.error?.message || errorMsg;
        } catch {}
        if (response.status === 429 || response.status === 401) {
          lastError = new Error(errorMsg);
          continue;
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content;
      if (!rawContent) throw new Error('Respon rangkuman kosong.');

      const parsed = JSON.parse(rawContent);
      return {
        summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
        key_points: Array.isArray(parsed.key_points) ? parsed.key_points : [],
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;
      if (i < attempts - 1) continue;
    }
  }

  throw lastError || new Error('Gagal menghasilkan rangkuman catatan.');
}



export interface GeneratedFlashcard {
  question: string;
  answer: string;
}

export async function generateFlashcards(
  text: string,
  model = DEFAULT_VISION_MODEL
): Promise<GeneratedFlashcard[]> {
  const keys = await getGroqApiKeys();
  if (keys.length === 0) {
    throw new Error('Kunci API Groq belum disetel.');
  }

  const systemPrompt = `
Kamu adalah asisten pembuat flashcard studi perkuliahan.
Tugasmu:
1. Buat 3 hingga 7 kartu flashcard dari teks materi yang diberikan, sesuaikan dengan panjang dan kepadatan informasi.
2. 'question' (pertanyaan) harus singkat dan spesifik.
3. 'answer' (jawaban) harus padat dan langsung pada intinya (tidak bertele-tele).
4. Gunakan bahasa yang sama persis dengan bahasa catatan.

Output format JSON ONLY:
{
  "flashcards": [
    { "question": "...", "answer": "..." }
  ]
}
`;

  let lastError: any = null;
  const attempts = keys.length;

  for (let i = 0; i < attempts; i++) {
    const keyToUse = keys[currentKeyIndex % keys.length];
    currentKeyIndex++;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${keyToUse}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant', // using a faster model for flashcards if possible, or fallback
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Teks materi perkuliahan:\n\n${text}` },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_tokens: 1024,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = `Groq HTTP ${response.status}`;
        try {
          const errObj = JSON.parse(errorText);
          errorMsg = errObj.error?.message || errorMsg;
        } catch {}
        if (response.status === 429 || response.status === 401) {
          lastError = new Error(errorMsg);
          continue;
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content;
      if (!rawContent) throw new Error('Respon flashcard kosong.');

      const parsed = JSON.parse(rawContent);
      return Array.isArray(parsed.flashcards) ? parsed.flashcards : [];
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;
      if (i < attempts - 1) continue;
    }
  }

  throw lastError || new Error('Gagal menghasilkan flashcard.');
}
