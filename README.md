# VoiceNote Knowledge Base

A voice-first knowledge management system built for The AI Champion Ship hackathon. Users can record voice memos, which are then automatically transcribed, stored, and made searchable via voice or text queries.

## Features

*   **Voice Recording**: Record and upload voice memos.
*   **Automatic Transcription**: Voice memos are automatically transcribed using Raindrop SmartInference.
*   **Semantic Search**: Search through your voice notes using natural language queries (voice or text).
*   **AI-Powered Answers**: Get concise answers based on your voice notes using RAG (Retrieval Augmented Generation).
*   **Mock Caching**: Simulates Vultr Valkey/Redis for demonstration purposes.
*   **ElevenLabs Integration**: Speech-to-text and text-to-speech for voice queries and answers.

## Technical Stack

*   **Backend**: Node.js with Express.js
*   **Frontend**: React.js
*   **Database**: PostgreSQL via Raindrop SmartSQL
*   **AI/ML**: LiquidMetal Raindrop SmartInference (Transcription, Embeddings, RAG)
*   **Voice Services**: ElevenLabs API
*   **Caching (Mocked)**: Vultr Valkey/Redis
*   **Deployment**: Netlify

## Setup Instructions

### 1. Clone the repository

```bash
git clone <repository_url>
cd voicenote-knowledge-base
```

### 2. Environment Variables

Create a `.env` file in the root directory and populate it with your API keys and project IDs:

```
RAINDROP_API_KEY=your_raindrop_api_key
RAINDROP_PROJECT_ID=your_project_id
ELEVENLABS_API_KEY=your_elevenlabs_key
WORKOS_API_KEY=your_workos_key
WORKOS_CLIENT_ID=your_client_id
```

**Note on `raindrop-sdk`:**
The `raindrop-sdk` is currently assumed to be a private package. If you encounter issues during `npm install` for the backend, you might need to:
1.  **Install it locally**: If you have access to the `raindrop-sdk` package file, place it in a known location and install it using `npm install <path/to/raindrop-sdk.tgz>`.
2.  **Private Registry**: If it's hosted on a private npm registry, ensure your `.npmrc` is configured correctly to access it.
3.  **Mock/Stub**: For development purposes without full access, you might need to mock or stub its functionalities in your `server.js` and service files.

### 3. Install Dependencies

**Backend (root directory):**

```bash
npm install
```

**Frontend (`frontend/` directory):**

```bash
cd frontend
npm install
cd ..
```

### 4. Run Database Migrations

This will create the necessary tables in your Raindrop SmartSQL database.

```bash
npm run migrate
```

### 5. Run the Application

**Backend:**

```bash
npm run dev
```

This will start the Express.js server on `http://localhost:3000`.

**Frontend:**

```bash
cd frontend
npm start
```

This will start the React development server, usually on `http://localhost:3001`.

The frontend is configured to communicate with the backend on `http://localhost:3000`.

## Deployment to Netlify

This project includes a `netlify.toml` file for easy deployment to Netlify.

1.  **Connect your Git repository** to Netlify.
2.  **Configure build settings**:
    *   **Build command**: `npm install && npm run build`
    *   **Publish directory**: `frontend/build`
3.  **Environment Variables**: Ensure you add all required `.env` variables (`RAINDROP_API_KEY`, `ELEVENLABS_API_KEY`, etc.) to your Netlify site settings.
4.  The `netlify.toml` handles redirects for the API endpoints to Netlify Functions (if you choose to convert your Express app to serverless functions) and for the React SPA.

## Project Structure

```
.
├── .env                  # Environment variables
├── netlify.toml          # Netlify deployment configuration
├── package.json          # Backend dependencies and scripts
├── server.js             # Main Express.js API server
├── migrations/
│   ├── 001_initial_schema.js # Database schema migration
│   └── run-migrations.js     # Script to run migrations
├── services/
│   ├── mockVultrCache.js     # Mock for Vultr Valkey/Redis cache
│   ├── elevenLabsService.js  # ElevenLabs API integration
│   └── voiceNoteService.js   # Core logic for voice note processing and search
└── frontend/
    ├── package.json          # Frontend dependencies and scripts
    ├── public/               # Public assets
    ├── src/
    │   ├── App.css           # Main CSS file (TailwindCSS)
    │   ├── App.jsx           # Main React component
    │   └── components/
    │       ├── CacheStats.jsx      # Displays mock cache statistics
    │       ├── NotesList.jsx       # Displays recorded voice notes
    │       ├── VoiceQuery.jsx      # Component for voice-based querying
    │       └── VoiceRecorder.jsx   # Component for recording voice memos
    └── ...                   # Other create-react-app files
```
