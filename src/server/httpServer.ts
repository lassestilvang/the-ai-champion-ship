import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { VectorDB } from '../utils/vectorDB';
import { TranscriptionAgent } from '../agents/TranscriptionAgent';
import { ExtractionAgent } from '../agents/ExtractionAgent';
import { EmbeddingAgent } from '../agents/EmbeddingAgent';
import { QueryAgent } from '../agents/QueryAgent';
import { runVoiceNoteWorkflow } from '../workflows/voiceNoteWorkflow';
import { startRaindropServer } from './raindropServer';

// Initialize dependencies
const app = express();
const port = process.env.PORT || 8080;
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const vectorDB = new VectorDB();
const transcriptionAgent = new TranscriptionAgent();
const extractionAgent = new ExtractionAgent();
const embeddingAgent = new EmbeddingAgent();
const queryAgent = new QueryAgent(vectorDB, embeddingAgent);

// Middleware
app.use(express.json());

// --- HTTP API Endpoints ---

/**
 * POST /api/notes
 * Accepts an audio file, processes it through the workflow, and returns note metadata.
 */
app.post('/api/notes', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No audio file uploaded.');
  }

  try {
    const note = await runVoiceNoteWorkflow(
      req.file.buffer,
      req.file.originalname,
      vectorDB,
      transcriptionAgent,
      extractionAgent,
      embeddingAgent
    );
    res.status(201).json(note);
  } catch (error) {
    console.error('[HTTP] Error in /api/notes:', error);
    res.status(500).send('Error processing note.');
  }
});

/**
 * POST /api/query
 * Accepts a text query, searches the knowledge base, and returns an answer.
 */
app.post('/api/query', async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).send('Query is required.');
  }

  try {
    const result = await queryAgent.run({ query });
    res.status(200).json(result);
  } catch (error) {
    console.error('[HTTP] Error in /api/query:', error);
    res.status(500).send('Error processing query.');
  }
});

// --- Server Initialization ---

app.listen(port, () => {
  console.log(`[HTTP] Server running at http://localhost:${port}`);
  
  // Start the Raindrop MCP Server alongside the HTTP server
  startRaindropServer();
});
