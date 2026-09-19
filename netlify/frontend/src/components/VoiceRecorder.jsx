import React, { useState, useRef } from 'react';

export default function VoiceRecorder({ onNoteUploaded }) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = handleStop;
      mediaRecorder.start();
      setRecording(true);
      setDuration(0);

      // Start duration timer
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);

    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const handleStop = async () => {
    const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
    await uploadAudio(audioBlob);
  };

  const uploadAudio = async (audioBlob) => {
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/voice-notes`, {
        method: 'POST',
        headers: { 'x-user-id': 'demo-user' },
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        onNoteUploaded(result.data);
        alert('✓ Voice note saved!');
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload voice note');
    } finally {
      setUploading(false);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="text-center">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">
        Record
      </h3>

      <div className="flex flex-col items-center space-y-6">
        {/* Recording Button */}
        <button
          onClick={recording ? stopRecording : startRecording}
          disabled={uploading}
          className={`
            w-20 h-20 rounded-full flex items-center justify-center
            transition-all duration-300 transform hover:scale-105
            ${recording
              ? 'bg-red-500 hover:bg-red-600 animate-pulse'
              : 'bg-blue-500 hover:bg-blue-600'
            }
            ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            shadow-lg
          `}
        >
          <span className="text-white text-2xl">
            {recording ? '⏹' : '🎙️'}
          </span>
        </button>

        {/* Waveform Visualization */}
        {recording && (
          <div className="flex items-center justify-center space-x-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-blue-500 rounded-full animate-pulse"
                style={{
                  height: `${20 + Math.random() * 20}px`,
                  animationDelay: `${i * 0.1}s`
                }}
              />
            ))}
          </div>
        )}

        {/* Status and Timer */}
        <div className="text-center">
          {recording && (
            <div className="space-y-2">
              <div className="text-lg font-mono text-gray-700">
                {formatDuration(duration)}
              </div>
              <div className="text-sm text-red-500 font-medium">
                Recording...
              </div>
            </div>
          )}
          {uploading && (
            <div className="text-blue-600 font-medium">
              Processing...
            </div>
          )}
          {!recording && !uploading && (
            <div className="text-gray-500 text-sm">
              Tap to record
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
