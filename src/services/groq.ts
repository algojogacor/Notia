import Constants from 'expo-constants';
import { GroqVisionAnalysisResult } from '../types';

/**
 * Groq Vision API Service for Notia
 * Designed for Indonesian college lecture notes (tulisan tangan, papan tulis, slide presentasi)
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_VISION_MODEL = 'llama-3.2-11b-vision-preview';
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds timeout

/**
 * Retrieve the Groq API key from environment variables
 */
export function getGroqApiKey(): string {
  const envKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;
  const extraKey = Constants.expoConfig?.extra?.groqApiKey;
  return (envKey || extraKey || '').trim();
}

/**
 * Check if the Groq API key is configured
 */
export function isGroqConfigured(): boolean {
  const key = getGroqApiKey();
  return Boolean(key && key.length > 5 && !key.includes('your_groq_api_key'));
}

/**
 * Build dynamic system prompt incorporating known subjects
 */
function buildSystemPrompt(existingSubjects?: string[]): string {
  const subjectsGuidance =
    existingSubjects && existingSubjects.length > 0
      ? `\nMata kuliah yang sudah terdaftar di aplikasi pengguna saat ini:\n[${existingSubjects.join(
          ', '
        )}]\nJika materi catatan sesuai dengan salah satu mata kuliah di atas, utamakan pilih nama tersebut agar terorganisir rapi. Jika materi jelas merupakan mata kuliah lain di luar daftar tersebut, usulkan nama mata kuliah baru yang baku dan ringkas.`
      : '';

  return `
Kamu adalah asisten AI cerdas untuk aplikasi "Notia", yang bertugas menganalisis foto catatan kuliah mahasiswa Indonesia.
Foto dapat berupa:
- Tulisan tangan di buku tulis / binder mahasiswa (termasuk tulisan tangan cepat, miring, singkatan umum seperti "yg", "dgn", "utk", "sbg", "krn")
- Papan tulis (whiteboard/blackboard) di ruang kuliah (seringkali ada pantulan cahaya atau tulisan kapur/spidol)
- Slide presentasi proyektor dosen di layar kelas (berisi poin-poin materi, diagram, rumus, atau kode program)

Tugasmu:
1. Transkrip semua teks, rumus matematika/logika, atau kode penting yang terbaca pada gambar semirip dan serapi mungkin ke teks terstruktur (extracted_text). Pertahankan susunan poin materi jika ada.
2. Identifikasi topik atau nama mata kuliah yang paling tepat dalam konteks kurikulum universitas di Indonesia (suggested_subject), misalnya: "Matematika Diskrit", "Algoritma & Pemrograman", "Basis Data", "Sistem Operasi", "Jaringan Komputer", "Kalkulus", "Fisika Dasar", "Ekonomi Makro", dsb.${subjectsGuidance}
3. Berikan skor keyakinan deteksi mata kuliah antara 0.0 sampai 1.0 (confidence).
4. Buat rangkuman singkat materi (summary) dalam 1-2 kalimat jelas bahasa Indonesia.
5. Buat daftar 3-5 kata kunci penting (keywords).

Keluarkan hasil WAJIB dalam format JSON murni dengan struktur persis berikut:
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
 * Send note image to Groq Multimodal Vision API with timeout and robust error handling
 */
export async function analyzeLectureNote({
  imageBase64,
  mimeType = 'image/jpeg',
  model = DEFAULT_VISION_MODEL,
  existingSubjects,
}: AnalyzeNoteOptions): Promise<GroqVisionAnalysisResult> {
  const apiKey = getGroqApiKey();

  if (!isGroqConfigured()) {
    throw new Error(
      'Groq API Key belum dikonfigurasi. Harap tambahkan EXPO_PUBLIC_GROQ_API_KEY di file .env'
    );
  }

  // Ensure clean base64 data url
  const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
  const dataUrl = `data:${mimeType};base64,${cleanBase64}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt(existingSubjects),
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analisis foto catatan kuliah ini. Ekstrak seluruh teks tulisan materi dan tentukan mata kuliahnya.',
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
        max_tokens: 1800,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Groq API Error (${response.status}): ${response.statusText}`;

      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        errorMessage = `${errorMessage} - ${errorText}`;
      }

      if (response.status === 401) {
        throw new Error(
          'API Key Groq tidak valid. Harap periksa kembali EXPO_PUBLIC_GROQ_API_KEY di .env'
        );
      } else if (response.status === 429) {
        throw new Error(
          'Batas panggilan Groq API (Rate limit) terlampaui. Harap tunggu sesaat sebelum mencoba lagi.'
        );
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error('Respon dari AI Groq kosong. Coba foto catatan lain.');
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
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
      summary: parsed.summary,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    };
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error(
        'Koneksi waktu habis (Timeout 30s). Foto terlalu besar atau jaringan sedang lambat.'
      );
    }

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error(
        'Tidak ada koneksi internet. Pastikan perangkat terhubung ke WiFi atau data seluler.'
      );
    }

    throw error;
  }
}
