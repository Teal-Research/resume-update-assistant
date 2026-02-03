import { Router, Request, Response } from 'express';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { getSession, addSessionMessage, getSessionMessages, addSessionBullet } from '../services/session-store.js';
import { createScoredBullet } from '../services/bullet-scorer.js';
import { randomUUID } from 'crypto';

const router = Router();

// OpenRouter provider
let openrouter: ReturnType<typeof createOpenAI> | null = null;

function getProvider() {
  if (!openrouter) {
    openrouter = createOpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      compatibility: 'strict', // Force chat completions API
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
      const userName = resume.contact.name?.split(' ')[0] || 'there'; // First name only
      systemPrompt += `\n\nThe user's name is ${userName}. Address them by name occasionally to make the conversation more personal.`;
      systemPrompt += `\n\nTheir resume shows:\n`;
      systemPrompt += `Full name: ${resume.contact.name}\n`;
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
    
    // Add question guidance with recency weighting
    systemPrompt += `\n\nQuestion Guidelines:
- ASK ONLY ONE QUESTION AT A TIME. Never ask multiple questions in a single response.
- Keep responses concise - acknowledge briefly, then ask your single follow-up question
- Prioritize questions about the MOST RECENT role (highest weight)
- Topics to explore (one at a time): projects, challenges overcome, team leadership, metrics/impact, innovations
- Ask follow-up questions to get specific numbers and outcomes
- When the user shares an accomplishment, extract it as a bullet point
- Don't repeat topics already covered in the conversation
- Sample questions (pick ONE):
  * "Tell me about a project you led at [company]. What was the outcome?"
  * "What's the biggest challenge you faced as [title]? How did you solve it?"
  * "Did you improve any processes or metrics? By how much?"
  * "Did you mentor or lead anyone? What was the result?"
  * "What would your manager say was your biggest contribution?"`;
    
    // Add extraction instruction
    systemPrompt += `\n\nWhen the user describes an accomplishment, respond with your message AND include a JSON block at the end in this format:
\`\`\`bullet
{"company": "...", "title": "...", "text": "...", "isStrong": true/false}
\`\`\`
Only include the bullet block when you've extracted a clear accomplishment.`;
    
    // Build messages array with history
    const messages = [
      ...previousMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: message }
    ];
    
    const result = streamText({
      model: provider('openai/gpt-4-turbo'),
      system: systemPrompt,
      messages,
    });

    // Stream the response and capture full text
    let fullResponse = '';
    for await (const chunk of result.textStream) {
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
    }
    
    // Extract any bullets from the response
    const bulletMatch = fullResponse.match(/```bullet\n?([\s\S]*?)\n?```/);
    let extractedBullet = null;
    
    if (bulletMatch && sessionId) {
      try {
        const bulletData = JSON.parse(bulletMatch[1]);
        // Use scorer for proper strength evaluation
        extractedBullet = createScoredBullet(
          bulletData.company || '',
          bulletData.title || '',
          bulletData.text || '',
          randomUUID()
        );
        addSessionBullet(sessionId, extractedBullet);
      } catch (e) {
        console.error('Failed to parse bullet:', e);
      }
    }
    
    // Store assistant message (without the bullet block for cleaner history)
    const cleanResponse = fullResponse.replace(/```bullet\n?[\s\S]*?\n?```/g, '').trim();
    if (sessionId && cleanResponse) {
      addSessionMessage(sessionId, 'assistant', cleanResponse);
    }

    res.write(`data: ${JSON.stringify({ type: 'done', bullet: extractedBullet })}\n\n`);
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
