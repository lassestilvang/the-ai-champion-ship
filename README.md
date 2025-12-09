# VoiceNote Knowledge Base

This project is a scaffold for a Raindrop MCP Server-based AI application called **VoiceNote Knowledge Base**. It allows you to submit audio notes, have them automatically transcribed and summarized, and then query the resulting knowledge base.

## Features

- **Audio Transcription**: Converts audio notes into text using a (stubbed) Vultr Whisper API.
- **Intelligent Extraction**: Pulls out summaries and keywords from transcriptions.
- **Vector-Based Search**: Embeds notes and performs semantic search over them.
- **Raindrop MCP Server Integration**: Implements a 4-agent workflow within a mock Raindrop server environment.
- **HTTP API**: Exposes simple endpoints for submitting notes and queries.

## Project Structure

```
/
├── src/
│   ├── agents/             # Contains individual AI agents
│   │   ├── TranscriptionAgent.ts
│   │   ├── ExtractionAgent.ts
│   │   ├── EmbeddingAgent.ts
│   │   └── QueryAgent.ts
│   ├── workflows/          # Defines the sequence of agent operations
│   │   └── voiceNoteWorkflow.ts
│   ├── server/             # Server implementation
│   │   ├── raindropServer.ts # Mock Raindrop MCP Server setup
│   │   └── httpServer.ts       # Express.js HTTP server
│   └── utils/              # Shared utilities and types
│       ├── vultrWhisperClient.ts
│       ├── vectorDB.ts
│       └── types.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (v18 or later recommended)
- npm or yarn

### Installation

1. Clone the repository.
2. Install the dependencies:
    ```bash
    npm install
    ```

### Running the Application

You can run the application in development mode, which will automatically transpile and restart the server on changes.

```bash
npm run dev
```

This will start two servers:
- **HTTP Server** on `http://localhost:8080`
- **Mock Raindrop MCP Server** on port `8081`

For production, first build the project and then start it:

```bash
npm run build
npm run start
```

## API Endpoints

### 1. Submit a Note

- **Endpoint**: `POST /api/notes`
- **Body**: `multipart/form-data`
- **Field**: `audio` (must be an audio file)

#### Example using cURL:

```bash
curl -X POST -F "audio=@/path/to/your/audio.mp3" http://localhost:8080/api/notes
```

- **Success Response (201)**:
  ```json
  {
    "id": "a1b2c3d4-…",
    "transcription": "This is a transcribed note…",
    "summary": "Summary of the text: 'This is a transcribed note…'",
    "keywords": ["transcribed", "note", "meeting"],
    "createdAt": "2025-12-09T10:00:00.000Z"
  }
  ```

### 2. Query Your Notes

- **Endpoint**: `POST /api/query`
- **Body**: `application/json`

#### Example using cURL:

```bash
curl -X POST -H "Content-Type: application/json" \
     -d '{"query": "what were the quarterly goals?"}' \
     http://localhost:8080/api/query
```

- **Success Response (200)**:
  ```json
  {
    "summary": "Based on your notes, here's a summary: …",
    "citations": [
      {
        "noteId": "a1b2c3d4-…",
        "textChunk": "This is a transcribed note about the team meeting. We discussed the quarterly goals…"
      }
    ]
  }
  ```

## Connecting to Raindrop Desktop App

*This section provides a conceptual overview, as it requires the actual Raindrop ecosystem.*

1.  **Run the MCP Server**: Ensure this project is running (`npm run dev`). The `raindropServer.ts` file starts a service that the Raindrop app can connect to.
2.  **Configure Raindrop App**: In the Raindrop Desktop App settings, you would typically find a section for "Local MCP Servers" or "Development Services".
3.  **Add a New Service**:
    - **Name**: VoiceNote Knowledge Base
    - **Address**: `mcp://localhost:8081`
4.  **Expose the Workflow**: The `raindropServer.ts` file registers agents as "tools". To make the workflow directly callable from the Raindrop App, you would expose the `runVoiceNoteWorkflow` function as a "workflow" and define its input/output schema. The app would then discover and allow you to trigger this workflow, likely by right-clicking an audio file and selecting "Process with VoiceNote KB".
