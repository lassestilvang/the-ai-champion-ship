import { VectorDB } from '../utils/vectorDB';
import { QueryInput, QueryResult } from '../utils/types';
import { EmbeddingAgent } from './EmbeddingAgent';

/**
 * An agent that queries the vector database to answer questions.
 */
export class QueryAgent {
  public agentName = 'QueryAgent';

  constructor(
    private vectorDB: VectorDB,
    private embeddingAgent: EmbeddingAgent
  ) {}

  /**
   * Runs the query process.
   * @param input - The user's query.
   * @returns A summarized answer and citations.
   */
  async run(input: QueryInput): Promise<QueryResult> {
    console.log(`[${this.agentName}] Received query: '${input.query}'`);

    // 1. Embed the query
    const { vector: queryVector } = await this.embeddingAgent.run({ text: input.query });

    // 2. Search the vector database
    const searchResults = this.vectorDB.search(queryVector, 3);
    console.log(`[${this.agentName}] Found ${searchResults.length} relevant chunks.`);

    if (searchResults.length === 0) {
      return {
        summary: "I couldn't find any relevant information in your notes.",
        citations: [],
      };
    }

    // 3. Generate a stubbed summary
    const summary = "Based on your notes, here's a summary: ...";
    const citations = searchResults.map(result => ({
      noteId: result.noteId,
      textChunk: result.textChunk,
    }));

    return { summary, citations };
  }
}
