/**
 * Defines the core data structures used throughout the application.
 */

// Represents a processed note, the central data object.
export interface Note {
  id: string;
  transcription: string;
  summary: string;
  keywords: string[];
  createdAt: Date;
}

// Represents a record stored in the vector database.
export interface EmbeddingRecord {
  id: string; // Unique ID for the embedding
  noteId: string; // Foreign key to the Note
  vector: number[]; // The embedding vector
  textChunk: string; // The piece of text this vector represents
}

// The result of a query.
export interface QueryResult {
  summary: string;
  citations: {
    noteId: string;
    textChunk: string;
  }[];
}

// Input for the transcription agent
export interface TranscriptionInput {
  audio: Buffer;
  fileName: string;
}

// Output of the transcription agent
export interface TranscriptionOutput {
  transcription: string;
}

// Input for the extraction agent
export interface ExtractionInput {
  text: string;
}

// Output of the extraction agent
export interface ExtractionOutput {
  summary: string;
  keywords: string[];
}

// Input for the embedding agent
export interface EmbeddingInput {
  text: string;
}

// Output of the embedding agent
export interface EmbeddingOutput {
  vector: number[];
}

// Input for the query agent
export interface QueryInput {
  query: string;
}
