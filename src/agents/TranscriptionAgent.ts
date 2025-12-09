import { transcribeAudioWithVultr } from '../utils/vultrWhisperClient';
import { TranscriptionInput, TranscriptionOutput } from '../utils/types';

/**
 * An agent responsible for transcribing audio data.
 */
export class TranscriptionAgent {
  public agentName = 'TranscriptionAgent';

  /**
   * Runs the transcription process.
   * @param input - The audio data to transcribe.
   * @returns The transcribed text.
   */
  async run(input: TranscriptionInput): Promise<TranscriptionOutput> {
    console.log(`[${this.agentName}] Received audio file: ${input.fileName}`);
    const transcription = await transcribeAudioWithVultr(input.audio);
    return { transcription };
  }
}
