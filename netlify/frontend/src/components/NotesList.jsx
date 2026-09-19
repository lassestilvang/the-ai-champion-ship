import React from 'react';

export default function NotesList({ notes, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-gray-500">Loading notes...</p>
      </div>
    );
  }

  return (
    <div>
      {notes.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No voice notes recorded yet. Start recording!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div key={note.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-gray-900">
                  {note.title || 'Untitled Note'}
                </h3>
                <span className="text-xs text-gray-500">
                  {new Date(note.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-gray-700 text-sm mb-2">
                {note.transcription}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {note.duration_seconds}s
                </span>
                {/* Future: Add play audio button here */}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
