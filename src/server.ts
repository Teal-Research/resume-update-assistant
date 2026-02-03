import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import chatRouter from './routes/chat.js';
import uploadRouter from './routes/upload.js';
import parseTextRouter from './routes/parse-text.js';
import bulletsRouter from './routes/bullets.js';
import linkedinRouter from './routes/linkedin.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../web')));

// Routes
app.use('/api/chat', chatRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/parse-text', parseTextRouter);
app.use('/api/bullets', bulletsRouter);
app.use('/api/linkedin', linkedinRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../web/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Resume Update Assistant running at http://localhost:${PORT}`);
});
