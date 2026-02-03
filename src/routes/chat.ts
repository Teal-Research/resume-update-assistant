import { Router, Request, Response } from 'express';
import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getSession, addSessionMessage, getSessionMessages, addSessionBullet, addSessionSkill } from '../services/session-store.js';
import { createScoredBullet } from '../services/bullet-scorer.js';
import { addBulletTool, addSkillTool } from '../tools/resume-tools.js';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// Load the skill file for system prompt
function loadSkillPrompt(): string {
  const skillPath = path.join(process.cwd(), 'src', 'skills', 'resume-coach', 'SKILL.md');
  try {
    const content = fs.readFileSync(skillPath, 'utf-8');
    // Extract just the System Prompt section
    const systemPromptMatch = content.match(/## System Prompt\n\n([\s\S]*?)(?=\n## (?:Examples|Notes)|$)/);
    return systemPromptMatch ? systemPromptMatch[1].trim() : '';
  } catch (e) {
    console.error('Failed to load skill:', e);
    return '';
  }
}

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

    // Build system prompt from skill file + resume context
    let systemPrompt = loadSkillPrompt();
    
    if (session?.resume) {
      const resume = session.resume;
      const userName = resume.contact.name?.split(' ')[0] || 'there';
      systemPrompt += `\n\n---\n\n### User Context\n\n`;
      systemPrompt += `The user's name is ${userName}. Address them by name occasionally.\n\n`;
      systemPrompt += `**Their resume shows:**\n`;
      systemPrompt += `- Full name: ${resume.contact.name}\n`;
      if (resume.experience.length > 0) {
        systemPrompt += `\n**Experience:**\n`;
        resume.experience.forEach((exp, i) => {
          systemPrompt += `${i + 1}. ${exp.title} at ${exp.company} (${exp.startDate} - ${exp.endDate})${exp.isCurrentRole ? ' [CURRENT]' : ''}\n`;
        });
      }
      systemPrompt += `\nFocus on their most recent role first.`;
    }
    
    // Add methodology guidance
    const method = methodology || session?.methodology || 'Open';
    if (method !== 'Open') {
      const methodologyGuides: Record<string, string> = {
        'STAR': '\n\n**Methodology: STAR**\nFormat accomplishments using STAR: Situation, Task, Action, Result. Ask follow-up questions to get all four components.',
        'XYZ': '\n\n**Methodology: XYZ**\nFormat accomplishments as: "Accomplished [X] as measured by [Y] by doing [Z]". Ask for metrics and specific actions.',
        'CAR': '\n\n**Methodology: CAR**\nFormat accomplishments using CAR: Challenge, Action, Result. Focus on problems solved and outcomes.',
      };
      systemPrompt += methodologyGuides[method] || '';
    }
    
    // Build messages array for AI SDK
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...previousMessages.map(m => ({ 
        role: m.role as 'user' | 'assistant', 
        content: m.content 
      })),
      { role: 'user', content: message }
    ];

    // Track extracted items to send to frontend
    const extractedBullets: Array<{ company: string; title: string; text: string; isStrong: boolean }> = [];
    const extractedSkills: Array<{ name: string; category: string }> = [];
    
    // Use AI SDK streamText with tools
    const result = streamText({
      model: openrouter.chat('openai/gpt-4-turbo'),
      system: systemPrompt,
      messages,
      tools: {
        addBullet: addBulletTool,
        addSkill: addSkillTool,
      },
      maxSteps: 5, // Allow multiple tool calls per turn
      onStepFinish: async ({ toolResults }) => {
        // Process tool results
        if (toolResults && toolResults.length > 0) {
          for (const toolResult of toolResults) {
            const output = (toolResult as any).output;
            if (toolResult.toolName === 'addBullet' && output?.bullet) {
              const bulletData = output.bullet;
              extractedBullets.push(bulletData);
              
              // Add to session
              if (sessionId) {
                const scoredBullet = createScoredBullet(
                  bulletData.company,
                  bulletData.title,
                  bulletData.text,
                  randomUUID()
                );
                // Override isStrong from tool call if explicitly set
                scoredBullet.isStrong = bulletData.isStrong;
                addSessionBullet(sessionId, scoredBullet);
                
                // Stream bullet to frontend immediately
                res.write(`data: ${JSON.stringify({ type: 'bullet', bullet: scoredBullet })}\n\n`);
              }
            } else if (toolResult.toolName === 'addSkill' && output?.skill) {
              const skillData = output.skill;
              extractedSkills.push(skillData);
              
              // Add to session
              if (sessionId) {
                const skill = {
                  id: randomUUID(),
                  name: skillData.name,
                  category: skillData.category,
                };
                addSessionSkill(sessionId, skill);
                
                // Stream skill to frontend immediately
                res.write(`data: ${JSON.stringify({ type: 'skill', skill })}\n\n`);
              }
            }
          }
        }
      },
    });

    // Stream the text response
    let fullResponse = '';
    
    try {
      for await (const chunk of result.textStream) {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      }
    } catch (streamError) {
      console.error('Stream error:', streamError);
    }
    
    // Get final text if textStream was empty (can happen with tool-only responses)
    if (!fullResponse) {
      try {
        const finalResult = await result.text;
        if (finalResult) {
          fullResponse = finalResult;
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: finalResult })}\n\n`);
        }
      } catch (e) {
        // Ignore - just means no text was generated
      }
    }
    
    // If tools were called but no text response, generate one
    if (!fullResponse && (extractedBullets.length > 0 || extractedSkills.length > 0)) {
      let generatedResponse = '';
      
      if (extractedBullets.length > 0) {
        const bullet = extractedBullets[extractedBullets.length - 1];
        generatedResponse = `Great! I've captured that accomplishment:\n\n"${bullet.text}"\n\n`;
        generatedResponse += `What other wins did you have at ${bullet.company}? For example, did you mentor anyone, improve processes, or tackle any challenging technical problems?`;
      }
      
      if (generatedResponse) {
        fullResponse = generatedResponse;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: generatedResponse })}\n\n`);
      }
    }
    
    // Store assistant message
    if (sessionId && fullResponse.trim()) {
      addSessionMessage(sessionId, 'assistant', fullResponse.trim());
    }

    // Send final done event with summary
    res.write(`data: ${JSON.stringify({ 
      type: 'done', 
      bulletCount: extractedBullets.length,
      skillCount: extractedSkills.length,
    })}\n\n`);
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
