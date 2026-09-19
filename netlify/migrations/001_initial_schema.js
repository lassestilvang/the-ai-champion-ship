const runMigration = async (smartSQL) => {
  await smartSQL.query(`
    CREATE TABLE IF NOT EXISTS voice_notes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL,
      audio_file_path VARCHAR(500) NOT NULL,
      transcription TEXT NOT NULL,
      embedding_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      duration_seconds INTEGER,
      title VARCHAR(255),
      tags TEXT[]
    );

    CREATE INDEX IF NOT EXISTS idx_user_notes ON voice_notes(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_transcription_search ON voice_notes USING gin(to_tsvector('english', transcription));
  `);

  console.log('✓ Database schema created');
};

module.exports = runMigration;
