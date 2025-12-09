import { EmbeddingRecord } from './types';

/**
 * Calculates the dot product of two vectors.
 */
function dotProduct(vecA: number[], vecB: number[]): number {
  let product = 0;
  for (let i = 0; i < vecA.length; i++) {
    product += vecA[i] * vecB[i];
  }
  return product;
}

/**
 * Calculates the magnitude (or norm) of a vector.
 */
function magnitude(vec: number[]): number {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) {
    sum += vec[i] * vec[i];
  }
  return Math.sqrt(sum);
}

/**
 * Calculates the cosine similarity between two vectors.
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must be of the same length');
  }
  const magA = magnitude(vecA);
  const magB = magnitude(vecB);
  if (magA === 0 || magB === 0) {
    return 0;
  }
  return dotProduct(vecA, vecB) / (magA * magB);
}

/**
 * A simple in-memory vector database for storing and querying embeddings.
 */
export class VectorDB {
  private store: EmbeddingRecord[] = [];

  /**
   * Adds a new embedding record to the database.
   * @param record - The embedding record to add.
   */
  public add(record: EmbeddingRecord): void {
    console.log(`[VectorDB] Adding embedding for note ${record.noteId}`);
    this.store.push(record);
  }

  /**
   * Searches for the most similar records to a given query vector.
   * @param queryVector - The vector to search against.
   * @param topK - The number of top results to return.
   * @returns An array of the most similar embedding records.
   */
  public search(queryVector: number[], topK: number = 3): EmbeddingRecord[] {
    if (this.store.length === 0) {
      return [];
    }

    const similarities = this.store.map(record => ({
      record,
      similarity: cosineSimilarity(queryVector, record.vector),
    }));

    similarities.sort((a, b) => b.similarity - a.similarity);

    return similarities.slice(0, topK).map(s => s.record);
  }
}
