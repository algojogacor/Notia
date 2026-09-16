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

export interface SubjectWithCount extends Subject {
  notes_count: number;
}

export type AiStatus = 'pending' | 'processing' | 'done' | 'failed_permanent';

export interface Note {
  id: string;
  image_path: string;
  subject_id: string | null;
  extracted_text: string | null;
  date_taken: string;
  created_at: string;
  deleted_at?: string | null;
  title?: string | null;
  summary?: string | null;
  key_points?: string | null; // JSON string array e.g. '["poin 1", "poin 2"]'
  ai_status?: AiStatus;
  last_attempted_at?: number | null; // unix timestamp in seconds
  retry_count?: number;
  source?: 'camera' | 'import' | 'manual';
}

export interface AiDiffSection {
  id: string;
  type: 'replace' | 'insert' | 'delete' | 'diagram';
  original: string;
  suggested: string;
  diagram_type?: 'flowchart' | 'mindmap' | 'table' | null;
}

export interface AiEditorResult {
  explanation: string;
  diffs: AiDiffSection[];
}


export interface NoteWithSubject extends Note {
  subject_name?: string | null;
  subject_color?: string | null;
}

export interface StudyHeatmapCell {
  date: string;
  count: number;
  isToday: boolean;
  isFuture: boolean;
}

export interface StudyStreakStats {
  streak: number;
  bestStreak: number;
  heatmap: StudyHeatmapCell[];
  heatmapTotal: number;
}

export interface SubjectSection {
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  data: NoteWithSubject[];
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

export interface AcademicImpactStats {
  notesCount: number;
  subjectsCount: number;
  minutesSaved: number;
  hoursSaved: string;
  activeDaysCount: number;
}

