import React, { useState, useEffect } from 'react';
import VoiceRecorder from './components/VoiceRecorder';
import VoiceQuery from './components/VoiceQuery';
import NotesList from './components/NotesList';
import CacheStats from './components/CacheStats';
import './App.css';

function App() {
  const [notes, setNotes] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchNotes();
    fetchStats();

    // Refresh stats every 10 seconds
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/voice-notes', {
        headers: { 'x-user-id': 'demo-user' }
      });
      const data = await response.json();
      setNotes(data.data);
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats', {
        headers: { 'x-user-id': 'demo-user' }
      });
      const data = await response.json();
      setStats(data.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleNoteUploaded = (newNote) => {
    setNotes([newNote, ...notes]);
    fetchStats();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            🎙️ VoiceNote Knowledge Base
          </h1>
          <p className="text-xl text-gray-600">
            Record voice memos, search them instantly with AI
          </p>
        </header>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Left Column: Recording & Query */}
          <div className="lg:col-span-1 space-y-6">
            <VoiceRecorder onNoteUploaded={handleNoteUploaded} />
            <VoiceQuery />
          </div>

          {/* Right Column: Notes List */}
          <div className="lg:col-span-2">
            <NotesList notes={notes} loading={loading} />
          </div>
        </div>

        {/* Cache Stats Dashboard */}
        {stats && <CacheStats stats={stats} />}

        {/* Footer */}
        <footer className="text-center mt-12 text-gray-600">
          <p className="mb-2">
            Built with 💙 using Raindrop Platform + Vultr + ElevenLabs
          </p>
          <p className="text-sm">
            Deployed on Netlify | The AI Champion Ship Hackathon 2025
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
