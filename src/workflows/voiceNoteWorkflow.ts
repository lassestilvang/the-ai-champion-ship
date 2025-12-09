import { v4 as uuidv4 } from 'uuid';
import { TranscriptionAgent } from '../agents/TranscriptionAgent';
import { ExtractionAgent } from '../agents/ExtractionAgent';
import { EmbeddingAgent } from '../agents/EmbeddingAgent';
import { VectorDB } from '../utils/vectorDB';
import { Note } from '../utils/types';

/**
 * Orchestrates the end-to-end workflow for processing a new voice note.
 *
 * @param audioBuffer - The audio data of the note.
 * @param fileName - The original file name of the audio.
 * @param vectorDB - The database to store the final embedding.
 * @param transcriptionAgent - The agent for transcription.
 * @param extractionAgent - The agent for extraction.
 * @param embeddingAgent - The agent for embedding.
 * @returns The metadata of the newly created note.
 */
export async function runVoiceNoteWorkflow(
  audioBuffer: Buffer,
  fileName: string,
  vectorDB: VectorDB,
  transcriptionAgent: TranscriptionAgent,
  extractionAgent: ExtractionAgent,
  embeddingAgent: EmbeddingAgent
): Promise<Note> {
  console.log('[Workflow] Starting VoiceNote workflow...');

  // 1. Transcription
  const { transcription } = await transcriptionAgent.run({ audio: audioBuffer, fileName });

  // 2. Extraction
  const { summary, keywords } = await extractionAgent.run({ text: transcription });

  // 3. Embedding
  const { vector } = await embeddingAgent.run({ text: transcription });

  // 4. Create Note and Store in DB
  const note: Note = {
    id: uuidv4(),
    transcription,
    summary,
    keywords,
    createdAt: new Date(),
  };

  vectorDB.add({
    id: uuidv4(),
    noteId: note.id,
    vector,
    textChunk: transcription, // For simplicity, we embed the whole transcription
  });

  console.log(`[Workflow] Finished processing. Note ${note.id} created.`);
  return note;
}
