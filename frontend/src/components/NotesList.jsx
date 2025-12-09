import React from 'react';

export default function NotesList({ notes, loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 flex items-center justify-center">
        <p className="text-gray-500">Loading notes...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        Your Voice Notes ({notes.length})
      </h2>

      {notes.length === 0 ? (
        <p className="text-gray-500">No voice notes recorded yet. Start recording!</p>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div key={note.id} className="bg-gray-50 p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500 mb-1">
                {new Date(note.createdAt).toLocaleString()} | {note.duration_seconds}s
              </p>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {note.title}
              </h3>
              <p className="text-gray-700 text-sm italic">
                "{note.transcription.substring(0, 150)}..."
              </p>
              {/* Future: Add play audio button here */}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
