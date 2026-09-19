const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(cors());
app.use(express.json());

// Mock data store
let voiceNotes = [
  {
    id: '1',
    title: 'Welcome to VoiceNote',
    transcription: 'This is a sample voice note to demonstrate the app functionality.',
    duration_seconds: 5,
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    title: 'Project Ideas',
    transcription: 'We should build a voice note application with AI-powered search capabilities.',
    duration_seconds: 8,
    createdAt: new Date(Date.now() - 86400000).toISOString()
  }
];

// Simple auth middleware
const requireAuth = (req, res, next) => {
  const userId = req.headers['x-user-id'] || 'demo-user';
  req.userId = userId;
  next();
};

/**
 * Upload and process voice note (Mock)
 */
app.post('/api/voice-notes', requireAuth, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Mock processing
    const newNote = {
      id: Date.now().toString(),
      title: 'New Voice Note',
      transcription: 'This is a mock transcription of your voice note.',
      duration_seconds: Math.floor(Math.random() * 10) + 3,
      createdAt: new Date().toISOString()
    };

    voiceNotes.unshift(newNote);

    setTimeout(() => {
      res.json({
        success: true,
        data: newNote
      });
    }, 1000); // Simulate processing time

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

    setTimeout(() => {
      res.json({
        success: true,
        data: voiceNotes.slice(0, limit),
        meta: {
          fromCache: false,
          count: Math.min(limit, voiceNotes.length)
        }
      });
    }, 500); // Simulate network delay

  } catch (error) {
    console.error('Error fetching voice notes:', error);
    res.status(500).json({ error: 'Failed to fetch voice notes' });
  }
});

/**
 * Voice query endpoint (Mock)
 */
app.post('/api/query/voice', requireAuth, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Mock processing
    setTimeout(() => {
      res.json({
        success: true,
        data: {
          query: 'What are my recent notes?',
          answer: 'You have 2 voice notes. The most recent one is about the app functionality, and the other one discusses project ideas.',
          sources: [
            {
              excerpt: 'This is a sample voice note to demonstrate the app functionality.',
              relevanceScore: 0.95
            },
            {
              excerpt: 'We should build a voice note application with AI-powered search capabilities.',
              relevanceScore: 0.87
            }
          ],
          audioResponse: null, // Mock: no audio in development
          fromCache: false,
          searchTime: 1.2
        }
      });
    }, 2000); // Simulate processing time

  } catch (error) {
    console.error('Error processing voice query:', error);
    res.status(500).json({ error: 'Failed to process voice query' });
  }
});

/**
 * Text query endpoint (Mock)
 */
app.post('/api/query/text', requireAuth, async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query text required' });
    }

    // Mock processing
    setTimeout(() => {
      res.json({
        success: true,
        data: {
          query,
          answer: `Based on your voice notes, I found information related to "${query}". You have ${voiceNotes.length} notes in total.`,
          sources: voiceNotes.slice(0, 2).map(note => ({
            excerpt: note.transcription,
            relevanceScore: Math.random() * 0.3 + 0.7
          })),
          audioResponse: null,
          fromCache: false,
          searchTime: 0.8
        }
      });
    }, 1000);

  } catch (error) {
    console.error('Error processing text query:', error);
    res.status(500).json({ error: 'Failed to process query' });
  }
});

/**
 * Get cache statistics (Mock)
 */
app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const cacheStats = {
      hits: 15,
      misses: 3,
      hitRate: '83.3%',
      cacheSize: 42,
      memoryUsage: '12.5 MB'
    };

    setTimeout(() => {
      res.json({
        success: true,
        data: {
          cache: cacheStats,
          totalNotes: voiceNotes.length
        }
      });
    }, 300);

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
      raindrop: 'mocked',
      elevenLabs: 'mocked',
      vultrCache: 'mocked'
    }
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Mock VoiceNote API running on port ${PORT}`);
  console.log(`📊 Available endpoints:`);
  console.log(`   POST /api/voice-notes - Upload voice note`);
  console.log(`   GET  /api/voice-notes - Get voice notes`);
  console.log(`   POST /api/query/voice - Voice search`);
  console.log(`   POST /api/query/text - Text search`);
  console.log(`   GET  /api/stats - Get statistics`);
  console.log(`   GET  /api/health - Health check`);
});