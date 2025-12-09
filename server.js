const express = require('express');
const multer = require('multer');
const cors = require('cors');
require('dotenv').config();

const { RaindropClient } = require('raindrop-sdk');
const VoiceNoteService = require('./services/voiceNoteService');
const ElevenLabsService = require('./services/elevenLabsService');
const mockVultrCache = require('./services/mockVultrCache');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const raindrop = new RaindropClient({
  apiKey: process.env.RAINDROP_API_KEY,
  projectId: process.env.RAINDROP_PROJECT_ID
});

const voiceNoteService = new VoiceNoteService(raindrop);
const elevenLabs = new ElevenLabsService(process.env.ELEVENLABS_API_KEY);

// Simple auth middleware (replace with WorkOS in production)
const requireAuth = (req, res, next) => {
  const userId = req.headers['x-user-id'] || 'demo-user';
  req.userId = userId;
  next();
};

/**
 * Upload and process voice note
 */
app.post('/api/voice-notes', requireAuth, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const result = await voiceNoteService.processVoiceNote(
      req.file.buffer,
      req.userId,
      req.body.metadata
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error processing voice note:', error);
    res.status(500).json({
      error: 'Failed to process voice note',
      details: error.message
    });
  }
});

/**
 * Get recent voice notes
 */
app.get('/api/voice-notes', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const result = await voiceNoteService.getRecentNotes(req.userId, limit);

    res.json({
      success: true,
      data: result.notes,
      meta: {
        fromCache: result.fromCache,
        count: result.notes.length
      }
    });

  } catch (error) {
    console.error('Error fetching voice notes:', error);
    res.status(500).json({ error: 'Failed to fetch voice notes' });
  }
});

/**
 * Voice query endpoint
 */
app.post('/api/query/voice', requireAuth, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Convert speech to text
    const queryText = await elevenLabs.speechToText(req.file.buffer);
    console.log(`Voice query: "${queryText}"`);

    // Search voice notes
    const searchResults = await voiceNoteService.searchVoiceNotes(
      queryText,
      req.userId
    );

    // Convert answer to speech
    const audioResponse = await elevenLabs.textToSpeech(searchResults.answer);

    res.json({
      success: true,
      data: {
        query: queryText,
        answer: searchResults.answer,
        sources: searchResults.sources,
        audioResponse: audioResponse.toString('base64'),
        fromCache: searchResults.fromCache,
        searchTime: searchResults.searchTime
      }
    });

  } catch (error) {
    console.error('Error processing voice query:', error);
    res.status(500).json({ error: 'Failed to process voice query' });
  }
});

/**
 * Text query endpoint
 */
app.post('/api/query/text', requireAuth, async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query text required' });
    }

    const searchResults = await voiceNoteService.searchVoiceNotes(
      query,
      req.userId
    );

    // Optionally convert to speech
    let audioResponse = null;
    if (req.body.includeAudio) {
      const audioBuffer = await elevenLabs.textToSpeech(searchResults.answer);
      audioResponse = audioBuffer.toString('base64');
    }

    res.json({
      success: true,
      data: {
        query,
        answer: searchResults.answer,
        sources: searchResults.sources,
        audioResponse,
        fromCache: searchResults.fromCache,
        searchTime: searchResults.searchTime
      }
    });

  } catch (error) {
    console.error('Error processing text query:', error);
    res.status(500).json({ error: 'Failed to process query' });
  }
});

/**
 * Get cache statistics (for demo dashboard)
 */
app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const cacheStats = mockVultrCache.getStats();

    // Get user's note count
    const result = await raindrop.smartSQL.query(`
      SELECT COUNT(*) as count FROM voice_notes WHERE user_id = $1
    `, [req.userId]);

    res.json({
      success: true,
      data: {
        cache: cacheStats,
        totalNotes: parseInt(result.rows[0].count)
      }
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      raindrop: 'connected',
      elevenLabs: 'connected',
      vultrCache: 'mocked'
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 VoiceNote Knowledge Base API running on port ${PORT}`);
  console.log(`📊 Cache stats available at /api/stats`);
});
