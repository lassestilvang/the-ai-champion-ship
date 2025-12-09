require('dotenv').config();
const { RaindropClient } = require('raindrop-sdk');
const runInitialSchema = require('./001_initial_schema');

const runMigrations = async () => {
  const raindrop = new RaindropClient({
    apiKey: process.env.RAINDROP_API_KEY,
    projectId: process.env.RAINDROP_PROJECT_ID
  });

  try {
    console.log('Starting database migrations...');
    await runInitialSchema(raindrop.smartSQL);
    console.log('Database migrations completed successfully.');
  } catch (error) {
    console.error('Database migration failed:', error);
    process.exit(1);
  }
};

runMigrations();
