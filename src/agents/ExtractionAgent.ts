import { ExtractionInput, ExtractionOutput } from '../utils/types';

/**
 * An agent that extracts key information from a body of text.
 */
export class ExtractionAgent {
  public agentName = 'ExtractionAgent';

  /**
   * Runs the extraction process.
   * @param input - The text to process.
   * @returns The extracted summary and keywords.
   */
  async run(input: ExtractionInput): Promise<ExtractionOutput> {
    console.log(`[${this.agentName}] Received text for extraction.`);
    
    // Placeholder logic: In a real app, this would use an LLM.
    const summary = `Summary of the text: '${input.text.substring(0, 50)}...'`;
    const keywords = input.text.toLowerCase().split(' ').filter(word => word.length > 4);
    const uniqueKeywords = [...new Set(keywords)].slice(0, 5);

    console.log(`[${this.agentName}] Extraction complete.`);
    return {
      summary,
      keywords: uniqueKeywords,
    };
  }
}
