import { Router, Request, Response } from 'express';
import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getSession, addSessionMessage, getSessionMessages, addSessionBullet } from '../services/session-store.js';
import { createScoredBullet } from '../services/bullet-scorer.js';
import { randomUUID } from 'crypto';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { message, sessionId, methodology } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Configure OpenRouter as the provider (inside handler so env is loaded)
    const openrouter = createOpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY!,
      compatibility: 'strict', // Use strict OpenAI API compatibility (not Responses API)
    });

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

    // Build system prompt with resume context
    let systemPrompt = `You are a helpful resume coach. Help the user update their resume by asking targeted questions about their work experience and accomplishments.`;
    
    if (session?.resume) {
      const resume = session.resume;
      const userName = resume.contact.name?.split(' ')[0] || 'there';
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
    
    // Add question guidance
    systemPrompt += `\n\nConversation Flow:
1. ASK about an accomplishment or project
2. ASK FOLLOW-UP QUESTIONS to get:
   - Specific metrics (%, $, time saved, users impacted)
   - Technologies/tools used
   - Your specific role/contribution (especially for team projects)
3. Once you have enough detail (metrics + action + result), EXTRACT THE BULLET
4. After extracting a bullet, ASK: "What else did you accomplish at [company]?" or move to their next role

Question Guidelines:
- ASK ONLY ONE QUESTION AT A TIME. Never ask multiple questions in a single response.
- Keep responses concise - acknowledge briefly, then ask your single follow-up question
- Prioritize questions about the MOST RECENT role (highest weight)
- Topics to explore (one at a time): projects, challenges overcome, team leadership, metrics/impact, innovations
- A bullet is NOT ready until you have QUANTIFIABLE IMPACT (numbers, percentages, dollar amounts)
- Keep asking until you get specific metrics - don't settle for vague answers
- Don't repeat topics already covered in the conversation

Sample questions (pick ONE per turn):
- "Tell me about a project you're proud of at [company]. What was the outcome?"
- "What's a challenge you faced as [title]? How did you solve it?"
- "Did you improve any processes or metrics? By how much specifically?"
- "How many people/users/customers were impacted?"
- "What was the dollar value or time saved?"
- "Did you mentor or lead anyone? What results did they achieve?"`;
    
    // Add extraction instruction
    systemPrompt += `\n\nBullet Extraction Rules:
- ONLY extract a bullet when you have: specific action + quantifiable result
- A strong bullet needs at least ONE metric (%, $, time, users, etc.)
- After extracting a bullet, transition with: "Great! What else did you accomplish at [company]?" or "Let's talk about your time at [next company]."
- Do NOT extract a new bullet if the user is just adding details to the previous accomplishment - instead, acknowledge the detail and ask what else they did.

CRITICAL: When you show a bullet point to the user, you MUST ALSO include this JSON block at the END of your message (after your conversational text). This is required for the bullet to be saved.

Example of a CORRECT response when extracting a bullet:
---
Great accomplishment! Here's how we can phrase that for your resume:

"Reduced API response time by 60% and increased throughput by 3x by redesigning the microservices architecture using Kubernetes and Redis caching."

What else did you accomplish at TechCorp?

\`\`\`bullet
{"company": "TechCorp", "title": "Senior Software Engineer", "text": "Reduced API response time by 60% and increased throughput by 3x by redesigning the microservices architecture using Kubernetes and Redis caching.", "isStrong": true}
\`\`\`
---

The JSON block MUST be included at the end. Without it, the bullet won't be saved to the sidebar.`;
    
    // Build messages array for AI SDK
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...previousMessages.map(m => ({ 
        role: m.role as 'user' | 'assistant', 
        content: m.content 
      })),
      { role: 'user', content: message }
    ];
    
    // Use AI SDK streamText
    const result = streamText({
      model: openrouter('openai/gpt-4-turbo'),
      system: systemPrompt,
      messages,
    });

    // Stream the response
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
    
    // Store assistant message (without the bullet block)
    const cleanResponse = fullResponse.replace(/```bullet\n?[\s\S]*?\n?```/g, '').trim();
    if (sessionId && cleanResponse) {
      addSessionMessage(sessionId, 'assistant', cleanResponse);
    }

    res.write(`data: ${JSON.stringify({ type: 'done', bullet: extractedBullet })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Chat error:', error);
    
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Stream error' })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: 'Failed to process chat' });
    }
  }
});

export default router;
