# VoiceNote - AI-Powered Voice Notes

A voice-first knowledge management system for The AI Champion Ship hackathon. Record voice memos and search them instantly with AI.

## 🚀 Quick Start

### Development Environment

1. **Start the development environment:**
   ```bash
   cd netlify
   ./dev-start.sh
   ```

2. **Open your browser:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

### Manual Setup

If you prefer to start services manually:

1. **Start the mock backend:**
   ```bash
   cd netlify
   node mock-server.js
   ```

2. **Start the frontend (in another terminal):**
   ```bash
   cd netlify/frontend
   npm start
   ```

## 🎯 Features

### 🎤 Voice Recording
- Click the microphone button to record voice notes
- Real-time duration tracking
- Visual recording feedback

### 🔍 AI-Powered Search
- Voice search your recordings
- Text search queries
- Find specific information across all notes
- Relevance scoring for results

### 📊 Dashboard
- View all your voice notes
- Cache performance statistics
- Search history and sources

## 🛠️ Architecture

### Frontend (React)
- **Location:** `frontend/`
- **Tech Stack:** React 18, Tailwind CSS
- **Components:**
  - `VoiceRecorder` - Record and upload voice notes
  - `VoiceQuery` - Search notes with voice queries
  - `NotesList` - Display all voice notes
  - `CacheStats` - Show performance metrics

### Backend (Express.js)
- **Location:** `netlify/server.js` (production)
- **Mock Server:** `netlify/mock-server.js` (development)
- **Services:**
  - VoiceNoteService - Handle audio processing
  - ElevenLabsService - Speech-to-text and text-to-speech
  - MockVultrCache - Caching layer

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/voice-notes` | Upload voice note |
| GET | `/api/voice-notes` | Get recent notes |
| POST | `/api/query/voice` | Voice search |
| POST | `/api/query/text` | Text search |
| GET | `/api/stats` | Get statistics |
| GET | `/api/health` | Health check |

## 🔧 Configuration

### Environment Variables

Create `.env.development` for development:
```env
PORT=3001
RAINDROP_API_KEY=your_api_key
RAINDROP_PROJECT_ID=your_project_id
ELEVENLABS_API_KEY=your_api_key
```

Create `frontend/.env` for frontend:
```env
REACT_APP_API_URL=http://localhost:3001
PORT=3000
```

## 🧪 Testing

### Development Mode
The mock server provides realistic responses without requiring API keys:
- Mock voice transcriptions
- Simulated search results
- Fake cache statistics

### Production Mode
For full functionality, you'll need:
1. **Raindrop AI** - Vector database and AI services
2. **ElevenLabs** - Speech-to-text and text-to-speech
3. **Vultr Cache** - High-performance caching

## 🐛 Troubleshooting

### Common Issues

1. **Frontend shows loading but no data:**
   - Make sure the mock backend is running on port 3001
   - Check browser console for API errors

2. **Microphone access denied:**
   - Allow microphone permissions in your browser
   - Use HTTPS in production (required for microphone)

3. **Port conflict:**
   - Frontend uses port 3000
   - Backend uses port 3001
   - Kill existing processes: `lsof -ti:3000 | xargs kill`

### API Testing

Test the API directly:
```bash
# Health check
curl http://localhost:3001/api/health

# Get voice notes
curl -H "x-user-id: demo-user" http://localhost:3001/api/voice-notes

# Get stats
curl -H "x-user-id: demo-user" http://localhost:3001/api/stats
```

## 🚀 Production Deployment

### Netlify Deployment
1. Connect your GitHub repository to Netlify
2. Set environment variables in Netlify dashboard
3. Deploy the `frontend/build` directory

### Backend Deployment
Deploy the Express server to any Node.js hosting platform:
- Heroku, Railway, Render, or AWS
- Set production environment variables
- Use HTTPS for microphone access

## 📝 Development Notes

### Mock Data Structure
```javascript
{
  id: string,
  title: string,
  transcription: string,
  duration_seconds: number,
  createdAt: string
}
```

### Search Response
```javascript
{
  query: string,
  answer: string,
  sources: Array<{
    excerpt: string,
    relevanceScore: number
  }>,
  fromCache: boolean,
  searchTime: number
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with the mock server
5. Submit a pull request

---

Built for **The AI Champion Ship** hackathon 🏆