# AGENTS.md - Development Guidelines

## Build/Test Commands

**Backend (root):**
- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm run migrate` - Run database migrations

**Frontend (frontend/):**
- `npm start` - Start React dev server (usually localhost:3001)
- `npm run build` - Build for production
- `npm test` - Run tests (uses create-react-app)
- `npm test -- --testNamePattern="test name"` - Run single test

## Code Style Guidelines

**General:**
- Use ES6+ syntax with async/await
- Follow existing naming conventions (camelCase for variables, PascalCase for components)
- Use descriptive variable and function names
- Include JSDoc comments for functions

**React Components:**
- Use functional components with hooks
- Import React at top: `import React, { useState, useEffect } from 'react';`
- Use Tailwind CSS for styling (className prop)
- Export default: `export default function ComponentName()`

**Backend:**
- Use Express.js patterns with async route handlers
- Include error handling with try/catch blocks
- Use proper HTTP status codes
- Log operations with console.log for debugging

**Error Handling:**
- Always catch and log errors
- Return meaningful error messages to clients
- Use consistent error response format: `{ error: "message", details: "optional" }`

**Imports:**
- Group imports: React hooks first, then local components, then external libraries
- Use relative imports for local files: `./components/ComponentName`