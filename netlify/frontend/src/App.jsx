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
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/voice-notes`, {
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
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/stats`, {
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
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          {/* Header */}
          <header className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Voice Notes
            </h1>
            <p className="text-gray-600">
              Record and search your voice notes
            </p>
          </header>

          {/* Recording and Query Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <VoiceRecorder onNoteUploaded={handleNoteUploaded} />
            <VoiceQuery />
          </div>
        </div>

        {/* Recent Notes Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            Recent Notes
          </h2>
          <NotesList notes={notes} loading={loading} />
        </div>

        {/* Cache Stats Dashboard */}
        {stats && <CacheStats stats={stats} />}
      </div>
    </div>
  );
}

export default App;
