import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { fetchLinkedInProfile, parseLinkedInHTML, isLinkedInUrl } from '../services/linkedin-parser.js';
import { extractResumeStructure, identifyMostRecentRole } from '../services/structure-extractor.js';
import { createSession, setSessionResume } from '../services/session-store.js';

const router = Router();

/**
 * Parse a LinkedIn profile URL
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url) {
      res.status(400).json({ error: 'URL is required' });
      return;
    }

    if (!isLinkedInUrl(url)) {
      res.status(400).json({ 
        error: 'Invalid LinkedIn URL',
        hint: 'Please use a URL like: https://linkedin.com/in/username'
      });
      return;
    }

    // Fetch the profile
    const { html, isPublic } = await fetchLinkedInProfile(url);

    if (!isPublic) {
      res.status(400).json({
        error: 'Profile is not public',
        hint: 'LinkedIn profiles must be set to public for us to read them. You can paste your profile text instead.',
      });
      return;
    }

    // Try to parse the HTML
    const partialResume = parseLinkedInHTML(html);

    const sessionId = randomUUID();
    createSession(sessionId);

    // If we got partial data, try to enhance it with LLM
    // For now, we'll extract what we can and let the user fill in gaps
    if (partialResume && partialResume.contact?.name) {
      // Create a text representation for LLM enhancement
      let textForLLM = `Name: ${partialResume.contact.name}\n`;
      if (partialResume.contact.location) {
        textForLLM += `Location: ${partialResume.contact.location}\n`;
      }
      if (partialResume.experience && partialResume.experience.length > 0) {
        textForLLM += '\nExperience:\n';
        for (const exp of partialResume.experience) {
          textForLLM += `- ${exp.title} at ${exp.company}\n`;
        }
      }

      // Try to get more structure via LLM
      let resume = null;
      let mostRecentRoleIndex = -1;

      try {
        resume = await extractResumeStructure(textForLLM);
        mostRecentRoleIndex = identifyMostRecentRole(resume.experience);
        setSessionResume(sessionId, resume);
      } catch (e) {
        // Use partial resume if LLM fails
        resume = partialResume;
      }

      res.json({
        success: true,
        sessionId,
        resume,
        mostRecentRoleIndex,
        note: 'LinkedIn data may be incomplete. Please verify and add missing details.',
      });
    } else {
      res.json({
        success: false,
        sessionId,
        error: 'Could not extract profile data',
        hint: 'LinkedIn may be blocking access. Please try pasting your profile text instead.',
      });
    }

  } catch (error: any) {
    console.error('LinkedIn parse error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to parse LinkedIn profile',
      hint: 'LinkedIn profiles can be tricky to access. Try pasting your profile text instead.'
    });
  }
});

export default router;
