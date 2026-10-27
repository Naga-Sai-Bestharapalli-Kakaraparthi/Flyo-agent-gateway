// src/index.ts
import express from 'express';
import path from 'path';
import { createApp } from './app';
import { createRedisClient } from './cache';
// CHANGE HERE: Use the python agent instead of mockLlm
import { pythonAiAgent } from './travelAgent'; 
import { logger } from './logger';

if (require.main === module) {
  const redis = createRedisClient();
  // CHANGE HERE:
  const app = createApp({ redis, llm: pythonAiAgent }); 

  app.use(express.static(path.join(__dirname, '..', 'public')));
  // ... rest of the file remains exactly the same
