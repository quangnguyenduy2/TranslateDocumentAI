export enum AppStatus {
  IDLE = 'IDLE',
  PARSING = 'PARSING',
  TRANSLATING = 'TRANSLATING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export enum FileType {
  MARKDOWN = 'MARKDOWN',
  EXCEL = 'EXCEL',
  UNKNOWN = 'UNKNOWN',
}

export interface GlossaryItem {
  id: string;
  term: string;
  translation: string;
}

export interface HistoryItem {
  id: string;
  fileName: string;
  fileType: FileType;
  targetLang: SupportedLanguage;
  timestamp: number;
  downloadUrl?: string; // Only valid for current session
  blob?: Blob; // Only valid for current session
}

export interface FileQueueItem {
  id: string;
  file: File;
  type: FileType;
  status: AppStatus;
  progressMessage?: string;
  progress: number; // 0 to 100
  availableSheets: string[]; // For Excel
  selectedSheets: string[]; // For Excel
  resultBlob?: Blob;
  downloadUrl?: string;
  errorMessage?: string;
  isExpanded?: boolean; // UI state for excel configuration
  // For Preview / Compare
  originalText?: string; 
  translatedText?: string;
}

export interface LogEntry {
  id: string;
  message: string;
  timestamp: Date;
  type: 'info' | 'success' | 'error';
}

export enum SupportedLanguage {
  VIETNAMESE = 'Vietnamese',
  ENGLISH = 'English',
  JAPANESE = 'Japanese',
  KOREAN = 'Korean',
  CHINESE = 'Chinese',
  SPANISH = 'Spanish',
  FRENCH = 'French',
  GERMAN = 'German',
}