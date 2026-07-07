export interface WorkspaceStatus {
  downloadsFolder: string;
  organizedFolder: string;
  downloadsExists: boolean;
  organizedExists: boolean;
  downloadsCount: number;
  organizedCount: number;
  hasGeminiKey: boolean;
}

export interface MovieFile {
  id: string;
  originalPath: string;
  relativePath: string;
  fileName: string;
  extension: string;
  folderName: string;
  hasNfo: boolean;
  sizeBytes: number;
  embyTitle: string | null;
  embyYear: number | null;
  embyImdb: string | null;
  
  // Dynamic UI properties
  matchedTitle?: string;
  matchedYear?: number;
  matchedImdbId?: string;
  confidence?: number;
  reasoning?: string;
  synopsis?: string;
  posterUrl?: string;
  rating?: number;
  sourceUsed?: string;
  status?: "idle" | "matching" | "matched" | "error";
  error?: string;
  customDestFolder?: string;
}

export interface LogEntry {
  file: string;
  status: "OK" | "WARNING" | "ERROR";
  message: string;
  newName?: string;
  destination?: string;
}

export interface Report {
  id: string;
  timestamp: string;
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  organizeType: "flat" | "alphabetical";
  logs: LogEntry[];
}
