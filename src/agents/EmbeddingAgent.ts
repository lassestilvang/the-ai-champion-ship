import { EmbeddingInput, EmbeddingOutput } from '../utils/types';

/**
 * An agent that converts text into a vector embedding.
 */
export class EmbeddingAgent {
  public agentName = 'EmbeddingAgent';
  private embeddingDimension = 1536; // Common dimension for models like text-embedding-ada-002

  /**
   * Runs the embedding process.
   * @param input - The text to embed.
   * @returns The resulting vector.
   */
  async run(input: EmbeddingInput): Promise<EmbeddingOutput> {
    console.log(`[${this.agentName}] Received text for embedding.`);

    // Placeholder logic: Generate a random vector. In a real app, this would call an embedding model.
    const vector = Array.from(
      { length: this.embeddingDimension },
      () => Math.random() * 2 - 1
    );

    console.log(`[${this.agentName}] Embedding generation complete.`);
    return { vector };
  }
}
