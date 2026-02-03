import { Router, Request, Response } from 'express';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { getSession, addSessionMessage, getSessionMessages } from '../services/session-store.js';

const router = Router();

// Create provider on first request to ensure env vars are loaded
let openrouter: ReturnType<typeof createOpenAI> | null = null;

function getProvider() {
  if (!openrouter) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not set');
    }
    openrouter = createOpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
      headers: {
        'HTTP-Referer': 'https://github.com/teal-research/resume-update-assistant',
        'X-Title': 'Resume Update Assistant',
      },
    });
  }
  return openrouter;
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const { message, sessionId, methodology } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Get session context
    const session = sessionId ? getSession(sessionId) : null;
    const previousMessages = session ? getSessionMessages(sessionId) : [];
    
    // Store user message
    if (sessionId) {
      addSessionMessage(sessionId, 'user', message);
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const provider = getProvider();
    
    // Build system prompt with resume context
    let systemPrompt = `You are a helpful resume coach. Help the user update their resume by asking targeted questions about their work experience and accomplishments.`;
    
    if (session?.resume) {
      const resume = session.resume;
      systemPrompt += `\n\nThe user's resume shows:\n`;
      systemPrompt += `Name: ${resume.contact.name}\n`;
      if (resume.experience.length > 0) {
        systemPrompt += `\nExperience:\n`;
        resume.experience.forEach((exp, i) => {
          systemPrompt += `${i + 1}. ${exp.title} at ${exp.company} (${exp.startDate} - ${exp.endDate})${exp.isCurrentRole ? ' [CURRENT]' : ''}\n`;
        });
      }
      systemPrompt += `\nFocus on asking about their most recent role and uncovering quantifiable accomplishments they may have forgotten.`;
    }
    
    // Add methodology guidance
    const method = methodology || session?.methodology || 'Open';
    if (method !== 'Open') {
      const methodologyGuides: Record<string, string> = {
        'STAR': 'Format accomplishments using STAR: Situation, Task, Action, Result. Ask follow-up questions to get all four components.',
        'XYZ': 'Format accomplishments as: "Accomplished [X] as measured by [Y] by doing [Z]". Ask for metrics and specific actions.',
        'CAR': 'Format accomplishments using CAR: Challenge, Action, Result. Focus on problems solved and outcomes.',
      };
      systemPrompt += `\n\n${methodologyGuides[method] || ''}`;
    }
    
    // Build messages array with history
    const messages = [
      ...previousMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: message }
    ];
    
    const result = streamText({
      model: provider('anthropic/claude-3.5-sonnet'),
      system: systemPrompt,
      messages,
    });

    // Stream the response and capture full text
    let fullResponse = '';
    for await (const chunk of result.textStream) {
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
    }
    
    // Store assistant message
    if (sessionId && fullResponse) {
      addSessionMessage(sessionId, 'assistant', fullResponse);
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Chat error:', error);
    
    // If headers already sent, try to send error via SSE
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Stream error' })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: 'Failed to process chat' });
    }
  }
});

export default router;
