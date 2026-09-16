import Constants from 'expo-constants';
import { GroqVisionAnalysisResult } from '../types';

/**
 * Groq Vision API Service for Notia
 * Designed for Indonesian college notes (tulisan tangan, papan tulis, slide presentasi)
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_VISION_MODEL = 'llama-3.2-11b-vision-preview';

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
 * System prompt specialized for Indonesian university lecture notes
 */
const SYSTEM_PROMPT = `
Kamu adalah asisten AI cerdas untuk aplikasi "Notia", yang bertugas menganalisis foto catatan kuliah mahasiswa Indonesia.
Foto dapat berupa:
- Tulisan tangan di buku tulis / binder
- Papan tulis (whiteboard/blackboard) di ruang kuliah
- Slide presentasi proyektor dosen

Tugasmu:
1. Transkrip semua teks atau materi penting yang terbaca pada gambar semirip mungkin ke teks terstruktur (extracted_text).
2. Identifikasi topik atau nama mata kuliah yang paling tepat dalam konteks kurikulum universitas di Indonesia (suggested_subject), misalnya: "Matematika Diskrit", "Algoritma & Pemrograman", "Basis Data", "Sistem Operasi", "Jaringan Komputer", "Kalkulus", "Fisika Dasar", "Ekonomi Makro", dsb.
3. Berikan skor keyakinan deteksi mata kuliah antara 0.0 sampai 1.0 (confidence).
4. Buat rangkuman singkat materi (summary) dalam 1-2 kalimat bahasa Indonesia.
5. Buat daftar 3-5 kata kunci penting (keywords).

Keluarkan hasil WAJIB dalam format JSON murni dengan struktur persis:
{
  "extracted_text": "...",
  "suggested_subject": "...",
  "confidence": 0.95,
  "summary": "...",
  "keywords": ["...", "..."]
}
`;

export interface AnalyzeNoteOptions {
  imageBase64: string;
  mimeType?: string;
  model?: string;
}

/**
 * Send note image to Groq Multimodal Vision API
 */
export async function analyzeLectureNote({
  imageBase64,
  mimeType = 'image/jpeg',
  model = DEFAULT_VISION_MODEL,
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

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analisis foto catatan kuliah ini dan ekstrak teks serta mata kuliahnya.',
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
        max_tokens: 1500,
      }),
    });

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
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error('Respon dari Groq API kosong.');
    }

    const parsed: GroqVisionAnalysisResult = JSON.parse(rawContent);
    return {
      extracted_text: parsed.extracted_text || 'Tidak ada teks terdeteksi.',
      suggested_subject: parsed.suggested_subject || 'Umum',
      confidence: parsed.confidence ?? 0.5,
      summary: parsed.summary,
      keywords: parsed.keywords || [],
    };
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error(
        'Koneksi internet bermasalah. Pastikan perangkat terhubung ke internet.'
      );
    }
    throw error;
  }
}
