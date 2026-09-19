import React, { useState, useRef } from 'react';

export default function VoiceQuery() {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [playingAudio, setPlayingAudio] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioRef = useRef(null);

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
      setResult(null);

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
    }
  };

  const handleStop = async () => {
    const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
    await processQuery(audioBlob);
  };

  const processQuery = async (audioBlob) => {
    setProcessing(true);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'query.webm');

      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/query/voice`, {
        method: 'POST',
        headers: { 'x-user-id': 'demo-user' },
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.data);
      } else {
        throw new Error(data.error);
      }

    } catch (error) {
      console.error('Query failed:', error);
      alert('Failed to process query');
    } finally {
      setProcessing(false);
    }
  };

  const playAudio = () => {
    if (result && result.audioResponse) {
      const audioData = atob(result.audioResponse);
      const arrayBuffer = new ArrayBuffer(audioData.length);
      const view = new Uint8Array(arrayBuffer);

      for (let i = 0; i < audioData.length; i++) {
        view[i] = audioData.charCodeAt(i);
      }

      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
        setPlayingAudio(true);
      }
    }
  };

  return (
    <div className="text-center">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">
        Search
      </h3>

      <div className="flex flex-col items-center space-y-6">
        {/* Search Button */}
        <button
          onClick={recording ? stopRecording : startRecording}
          disabled={processing}
          className={`
            w-20 h-20 rounded-full flex items-center justify-center
            transition-all duration-300 transform hover:scale-105
            ${recording
              ? 'bg-green-500 hover:bg-green-600 animate-pulse'
              : 'bg-gray-700 hover:bg-gray-800'
            }
            ${processing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            shadow-lg
          `}
        >
          <span className="text-white text-2xl">
            {recording ? '⏹' : '🔍'}
          </span>
        </button>

        {/* Status */}
        <div className="text-center">
          {recording && (
            <div className="text-green-600 font-medium animate-pulse">
              Listening...
            </div>
          )}
          {processing && (
            <div className="text-gray-600 font-medium">
              Searching...
            </div>
          )}
          {!recording && !processing && (
            <div className="text-gray-500 text-sm">
              Tap to search
            </div>
          )}
        </div>

        {/* Result */}
        {result && (
          <div className="w-full mt-6 space-y-4">
            {/* Query */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 font-medium mb-1">
                Question:
              </p>
              <p className="text-gray-900">{result.query}</p>
            </div>

            {/* Answer */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm text-blue-700 font-medium">
                  Answer:
                </p>
                <div className="flex items-center space-x-2">
                  {result.fromCache && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      Cached
                    </span>
                  )}
                </div>
              </div>
              <p className="text-gray-900">{result.answer}</p>

              {/* Play Audio Button */}
              <button
                onClick={playAudio}
                className="mt-3 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 text-sm"
              >
                <span>{playingAudio ? '🔊' : '🔈'}</span>
                <span>Play Answer</span>
              </button>
            </div>

            {/* Sources */}
            {result.sources && result.sources.length > 0 && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-700 font-medium mb-2">
                  Sources:
                </p>
                <div className="space-y-2">
                  {result.sources.map((source, idx) => (
                    <div key={idx} className="text-sm border-l-2 border-gray-300 pl-3">
                      <p className="text-gray-600 italic">"{source.excerpt}"</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Relevance: {(source.relevanceScore * 100).toFixed(1)}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <audio ref={audioRef} onEnded={() => setPlayingAudio(false)} />
      </div>
    </div>
  );
}
