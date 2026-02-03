import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { looksLikeResume } from '../services/resume-parser.js';
import { extractResumeStructure, identifyMostRecentRole } from '../services/structure-extractor.js';
import { createSession, setSessionResume, getSessionBullets } from '../services/session-store.js';

const router = Router();

/**
 * Parse raw text into structured resume data
 * Useful for testing and for LinkedIn text paste
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text is required' });
      return;
    }

    const sessionId = randomUUID();
    createSession(sessionId);
    const isResume = looksLikeResume(text);
    
    let resume = null;
    let mostRecentRoleIndex = -1;
    
    if (text.length > 50) {
      resume = await extractResumeStructure(text);
      mostRecentRoleIndex = identifyMostRecentRole(resume.experience);
      // Store resume in session
      setSessionResume(sessionId, resume);
    }
    
    // Get imported bullets from session
    const bullets = getSessionBullets(sessionId);
    
    res.json({
      success: true,
      sessionId,
      extracted: {
        charCount: text.length,
        isResume,
      },
      resume,
      bullets, // Include imported bullets
      mostRecentRoleIndex,
    });

  } catch (error) {
    console.error('Parse text error:', error);
    res.status(500).json({ error: 'Failed to parse text' });
  }
});

export default router;
