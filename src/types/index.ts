/**
 * Notia Domain Types
 * Local-first mobile app for Indonesian college students
 */

export interface Subject {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Note {
  id: string;
  image_path: string;
  subject_id: string | null;
  extracted_text: string | null;
  date_taken: string;
  created_at: string;
}

export interface NoteWithSubject extends Note {
  subject_name?: string | null;
  subject_color?: string | null;
}

export interface GroqVisionAnalysisResult {
  extracted_text: string;
  suggested_subject: string;
  confidence: number;
  summary?: string;
  keywords?: string[];
}

export interface DatabaseStats {
  notesCount: number;
  subjectsCount: number;
}
