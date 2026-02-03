import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { extractTextFromPDF, looksLikeResume } from '../services/resume-parser.js';
import { extractResumeStructure, identifyMostRecentRole } from '../services/structure-extractor.js';

const router = Router();

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '/tmp');
  },
  filename: (req, file, cb) => {
    const uniqueName = `resume-${randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

router.post('/', upload.single('resume'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const sessionId = randomUUID();
    
    // Extract text from PDF
    const extracted = await extractTextFromPDF(req.file.path);
    
    // Validate it looks like a resume
    const isResume = looksLikeResume(extracted.text);
    
    // If it looks like a resume, extract structure with LLM
    let resume = null;
    let mostRecentRoleIndex = -1;
    
    if (isResume && extracted.text.length > 50) {
      try {
        resume = await extractResumeStructure(extracted.text);
        mostRecentRoleIndex = identifyMostRecentRole(resume.experience);
      } catch (error) {
        console.error('Structure extraction error:', error);
        // Continue without structured data
      }
    }
    
    res.json({
      success: true,
      sessionId,
      file: {
        originalName: req.file.originalname,
        size: req.file.size,
        numPages: extracted.numPages,
      },
      extracted: {
        text: extracted.text,
        charCount: extracted.text.length,
        isResume,
      },
      resume,
      mostRecentRoleIndex,
      warning: isResume ? undefined : 'This document may not be a resume. Please verify.',
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Error handler for multer
router.use((err: Error, req: Request, res: Response, next: Function) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
      return;
    }
  }
  if (err.message === 'Only PDF files are allowed') {
    res.status(400).json({ error: err.message });
    return;
  }
  next(err);
});

export default router;
