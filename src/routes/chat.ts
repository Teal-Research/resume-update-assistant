import { Router, Request, Response } from 'express';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

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
    const { message, sessionId } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const provider = getProvider();
    
    const result = streamText({
      model: provider('anthropic/claude-3.5-sonnet'),
      system: `You are a helpful resume coach. Help the user update their resume by asking targeted questions about their work experience and accomplishments.`,
      messages: [{ role: 'user', content: message }],
    });

    // Stream the response
    for await (const chunk of result.textStream) {
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
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
