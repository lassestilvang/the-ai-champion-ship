const crypto = require('crypto');
const mockVultrCache = require('./mockVultrCache');

class VoiceNoteService {
  constructor(raindropClient) {
    this.raindrop = raindropClient;
  }

  /**
   * Process uploaded voice note
   */
  async processVoiceNote(audioBuffer, userId, metadata = {}) {
    console.log(`Processing voice note for user: ${userId}`);
    const startTime = Date.now();

    try {
      // 1. Upload audio to Raindrop SmartBuckets
      const audioPath = await this.raindrop.smartBuckets.upload({
        bucket: 'voicenote-audio',
        file: audioBuffer,
        path: `users/${userId}/${Date.now()}.webm`,
        contentType: 'audio/webm'
      });

      console.log(`✓ Audio uploaded to: ${audioPath}`);

      // 2. Transcribe audio using SmartInference
      const transcription = await this.raindrop.smartInference.transcribe({
        audioPath: audioPath,
        language: 'en',
        model: 'whisper-large-v3'
      });

      console.log(`✓ Transcription complete: ${transcription.text.substring(0, 50)}...`);

      // 3. Generate embeddings for semantic search
      const embedding = await this.raindrop.smartInference.generateEmbedding({
        text: transcription.text,
        model: 'text-embedding-3-large'
      });

      console.log(`✓ Embedding generated: ${embedding.id}`);

      // 4. Generate smart title from transcription
      const title = await this._generateTitle(transcription.text);

      // 5. Store in SmartSQL
      const result = await this.raindrop.smartSQL.query(`
        INSERT INTO voice_notes (
          user_id, audio_file_path, transcription,
          embedding_id, duration_seconds, title
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, created_at
      `, [
        userId,
        audioPath,
        transcription.text,
        embedding.id,
        Math.round(transcription.duration),
        title
      ]);

      console.log(`✓ Stored in database: ${result.rows[0].id}`);

      // 6. Invalidate cache for user's recent notes
      await mockVultrCache.deletePattern(`recent:${userId}*`);
      await mockVultrCache.deletePattern(`search:${userId}*`);

      const processingTime = Date.now() - startTime;
      console.log(`✓ Voice note processed in ${processingTime}ms`);

      return {
        id: result.rows[0].id,
        title,
        transcription: transcription.text,
        audioPath,
        createdAt: result.rows[0].created_at,
        processingTime
      };

    } catch (error) {
      console.error('Error processing voice note:', error);
      throw error;
    }
  }

  /**
   * Search voice notes with semantic search
   */
  async searchVoiceNotes(query, userId, options = {}) {
    const limit = options.limit || 5;
    const cacheKey = `search:${userId}:${this._hashQuery(query)}`;

    // Check cache first
    let results = await mockVultrCache.get(cacheKey);

    if (results) {
      console.log('✓ Returning cached search results');
      return { ...results, fromCache: true };
    }

    console.log('Cache miss - performing semantic search');
    const startTime = Date.now();

    // Perform semantic search using SmartInference RAG
    const searchResults = await this.raindrop.smartInference.semanticSearch({
      query: query,
      filters: { user_id: userId },
      limit: limit,
      model: 'rag-v1'
    });

    // Generate answer using RAG
    const answer = await this.raindrop.smartInference.generateAnswer({
      query: query,
      context: searchResults.results,
      model: 'gpt-4-turbo'
    });

    const searchTime = Date.now() - startTime;

    const response = {
      answer: answer.text,
      sources: searchResults.results.map(r => ({
        id: r.id,
        excerpt: r.excerpt,
        relevanceScore: r.score,
        createdAt: r.metadata.created_at
      })),
      searchTime,
      fromCache: false
    };

    // Cache results for 1 hour
    await mockVultrCache.set(cacheKey, response, 3600);

    return response;
  }

  /**
   * Get recent voice notes for user
   */
  async getRecentNotes(userId, limit = 20) {
    const cacheKey = `recent:${userId}:${limit}`;

    let notes = await mockVultrCache.get(cacheKey);

    if (notes) {
      return { notes, fromCache: true };
    }

    const result = await this.raindrop.smartSQL.query(`
      SELECT id, title, transcription, audio_file_path,
             created_at, duration_seconds
      FROM voice_notes
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [userId, limit]);

    notes = result.rows;

    // Cache for 5 minutes
    await mockVultrCache.set(cacheKey, notes, 300);

    return { notes, fromCache: false };
  }

  /**
   * Generate smart title from transcription
   */
  async _generateTitle(text) {
    if (text.length < 10) return text;

    try {
      const response = await this.raindrop.smartInference.complete({
        prompt: `Generate a short, descriptive title (max 6 words) for this voice note:\n\n${text.substring(0, 500)}`,
        model: 'gpt-4-turbo',
        maxTokens: 20
      });

      return response.text.replace(/['"]/g, '').trim();
    } catch (error) {
      // Fallback: use first 50 chars
      return text.substring(0, 50) + (text.length > 50 ? '...' : '');
    }
  }

  /**
   * Hash query for cache key
   */
  _hashQuery(query) {
    return crypto.createHash('md5').update(query.toLowerCase()).digest('hex');
  }
}

module.exports = VoiceNoteService;
