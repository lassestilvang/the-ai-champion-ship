require('dotenv').config();
const { Raindrop } = require('@liquidmetal-ai/lm-raindrop');
const runInitialSchema = require('./001_initial_schema');
const fs = require('fs');

const runMigrations = async () => {
  const raindropAgents = JSON.parse(fs.readFileSync('../raindrop.json', 'utf-8'));
  const raindrop = new Raindrop({
    apiKey: process.env.RAINDROP_API_KEY,
    projectId: process.env.RAINDROP_PROJECT_ID,
    agents: raindropAgents.agents
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
