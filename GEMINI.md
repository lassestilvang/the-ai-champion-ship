# GEMINI.md - VoiceNote Knowledge Base

## Project Overview

This project is a voice-first knowledge management system. Users can record voice memos, which are automatically transcribed, stored, and made searchable via voice or text queries. The system uses a Node.js backend with Express.js, a React.js frontend, and a PostgreSQL database. It integrates with the Raindrop and ElevenLabs APIs for AI/ML features and voice services.

## Building and Running

### Backend

To run the backend server:

```bash
npm install
npm run dev
```

The server will start on `http://localhost:3000`.

### Frontend

To run the frontend application:

```bash
cd frontend
npm install
npm start
```

The frontend will start on `http://localhost:3001`.

### Database Migrations

To run the database migrations:

```bash
npm run migrate
```

## Development Conventions

*   **Backend**: The backend is written in Node.js using Express.js. It follows a service-oriented architecture, with services for voice notes and ElevenLabs integration.
*   **Frontend**: The frontend is a React.js application.
*   **API**: The backend exposes a RESTful API. The available endpoints are:
    *   `POST /api/voice-notes`: Upload and process a voice note.
    *   `GET /api/voice-notes`: Get recent voice notes.
    *   `POST /api/query/voice`: Query voice notes using a voice recording.
    *   `POST /api/query/text`: Query voice notes using text.
    *   `GET /api/stats`: Get cache and note statistics.
    *   `GET /api/health`: Health check endpoint.
*   **Authentication**: A simple `x-user-id` header is used for authentication in development.
*   **Caching**: A mock Vultr/Redis cache is used for demonstration purposes.
*   **Dependencies**: The project uses a private `raindrop-sdk` package. For development without access, this may need to be mocked or stubbed.
