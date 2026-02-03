import { Router, Request, Response } from 'express';
import { streamText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { getSession, addSessionMessage, getSessionMessages, addSessionBullet, addSessionSkill } from '../services/session-store.js';
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
    const openrouter = createOpenAICompatible({
      name: 'openrouter',
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
1. DON'T just ask "what did you accomplish?" - that's the blank page problem they already have!
2. Instead, SUGGEST LIKELY ACCOMPLISHMENTS based on their role and help them remember
3. ASK FOLLOW-UP QUESTIONS to get details and metrics
4. Once you have enough detail, EXTRACT THE BULLET
5. After extracting, suggest another likely accomplishment or move to next role

PROACTIVE SUGGESTIONS (CRITICAL - help users remember what they did):
Based on their job title, suggest specific accomplishments they likely had:

For Engineers/Developers:
- "As a [title], did you ever optimize something that was slow? Maybe a database query or API endpoint?"
- "Did you mentor any junior developers or lead code reviews?"
- "Were you involved in any migrations - like upgrading a framework or moving to the cloud?"
- "Did you implement any CI/CD improvements or reduce deployment friction?"
- "Did you fix any critical production bugs or improve system reliability?"

For Data roles:
- "Did you build any dashboards or reports that leadership relied on?"
- "Did you automate any manual data processes?"
- "Did you improve data quality or catch data issues before they caused problems?"

For Product/Management:
- "Did you launch any features that moved key metrics?"
- "Did you streamline any processes for your team?"
- "Did you lead any cross-functional initiatives?"

For ANY role:
- "What would your manager say was your biggest win?"
- "What's something you built/did that's still being used today?"
- "Was there a fire drill or crisis you helped resolve?"

When user says "I don't know" or seems stuck, OFFER 2-3 SPECIFIC SUGGESTIONS based on their role.

Question Guidelines:
- ASK ONLY ONE QUESTION AT A TIME. Never ask multiple questions in a single response.
- Keep responses concise - acknowledge briefly, then ask your single follow-up question
- Prioritize questions about the MOST RECENT role (highest weight)
- Topics to explore (one at a time): projects, challenges overcome, team leadership, metrics/impact, innovations
- Don't repeat the same type of question - VARY YOUR APPROACH

SMART METRIC SUGGESTIONS (suggest specific metrics based on accomplishment type):

For API/Backend work, suggest:
- "What was the latency before vs after? Like 500ms down to 50ms?"
- "How many requests per second could it handle?"
- "Did uptime improve? From 99% to 99.9%?"

For Process/Automation work, suggest:
- "How long did this take manually before? Hours per week?"
- "How many manual steps were eliminated?"
- "Did error rates go down? Like from 5% to under 1%?"

For Data/Analytics work, suggest:
- "How much data does this process? GBs, millions of rows?"
- "How much faster are reports generated now?"
- "How many people use these dashboards/reports?"

For Leadership/Team work, suggest:
- "How many people did you lead or mentor?"
- "How many PRs did you review per week?"
- "Did the team's velocity or output improve?"

For Features/Products, suggest:
- "How many users adopted this feature?"
- "Did engagement/retention metrics improve?"
- "What was the revenue impact, even roughly?"

ALWAYS give a specific example with numbers: "For instance, did response time drop from 2 seconds to 200ms?"

After 2-3 attempts to get metrics, ACCEPT QUALITATIVE IMPACT:
- "It sounds like this significantly improved team productivity. Let's capture that!"
- Strong qualitative impact (critical bug fix, major feature, team enablement) is still valuable

Sample questions (ROTATE through different approaches):
- Opening: "Tell me about a project you're proud of at [company]"
- Digging deeper: "Walk me through what you actually built or did"
- Getting metrics: "Did this save time? How much roughly - hours, days?"
- Offering examples: "Did it affect revenue? Like even $10K saved would be notable"
- Team angle: "How big was the team? What was your specific role?"
- Scale angle: "How many users/customers/transactions did this touch?"
- Before/after: "What was life like before this? What changed after?"
- If stuck: "What would your manager say was the biggest win here?"`;
    
    // Add extraction instruction
    systemPrompt += `\n\nBullet Extraction Rules:
- Extract a bullet when you have: specific action + measurable OR significant qualitative result
- A STRONG bullet (isStrong: true) has specific metrics (%, $, time, users)
- A GOOD bullet (isStrong: false) describes significant impact without exact numbers
- It's OK to extract a bullet without hard metrics if:
  * The impact was clearly significant (shipped major feature, fixed critical bug)
  * User has tried to quantify but can't remember exact numbers
  * The accomplishment is impressive even without metrics (led team, learned new tech fast)
- After extracting a bullet, transition with: "Great! What else did you accomplish at [company]?" or "Let's talk about your time at [next company]."
- Do NOT extract a new bullet if the user is just adding details to the previous accomplishment - instead, acknowledge the detail and ask what else they did.

BULLET WRITING STYLE (CRITICAL - never copy user's words verbatim):
- REWRITE user input into polished, professional resume language
- Calculate percentages when impactful: "8 hours to 20 minutes" → "by 96% (8 hrs → 20 min)"
- Use strong action verbs: Spearheaded, Architected, Drove, Slashed, Boosted, Streamlined, Orchestrated, Pioneered
- Structure: [Strong verb] + [what you did] + [quantified result] + [how/technologies]
- Round numbers sensibly: "95.83%" → "~96%", "1,847 users" → "1,800+ users"
- Make it sound impressive but honest

Examples of GOOD vs BAD bullet writing:
- User: "reduced response times from 8 hours to 20 minutes"
  ❌ BAD: "Reduced response times from 8 hours to 20 minutes"
  ✅ GOOD: "Slashed report generation time by 96% (8 hrs → 20 min) through query optimization and strategic caching"

- User: "built an api that handles lots of requests really fast"
  ❌ BAD: "Built an API that handles lots of requests really fast"  
  ✅ GOOD: "Architected high-performance API achieving 10K+ requests/sec with sub-100ms latency"

- User: "led a team and we shipped the feature"
  ❌ BAD: "Led a team and shipped the feature"
  ✅ GOOD: "Spearheaded cross-functional team of 5 engineers to deliver [feature] 2 weeks ahead of schedule"

BULLET POLISH RULES (IMPORTANT - don't copy user's words verbatim):
- REWRITE the user's input into professional resume language
- Calculate and include percentages when impactful (e.g., "8 hours to 20 minutes" → "reduced by 96%")
- Lead with strong action verbs: Spearheaded, Architected, Drove, Slashed, Boosted, Streamlined
- Structure for impact: [Action verb] + [what you did] + [measurable result] + [how/using what]
- Clean up awkward phrasing - make it sound polished
- Round numbers sensibly (don't say "reduced by 95.83%", say "reduced by ~96%")

Examples of POLISHING:
- User says: "reduced response times from 8 hours to 20 minutes"
  BAD bullet: "Reduced response times from 8 hours to 20 minutes"
  GOOD bullet: "Slashed report generation time by 96% (from 8 hours to 20 minutes) by optimizing database queries and implementing caching"
  
- User says: "built an API that handles lots of requests"
  BAD bullet: "Built an API that handles lots of requests"
  GOOD bullet: "Architected high-throughput REST API capable of processing 10,000+ requests/second using Redis caching and connection pooling"

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

The JSON block MUST be included at the end. Without it, the bullet won't be saved to the sidebar.

SKILLS EXTRACTION:
As you discuss accomplishments, identify skills the user demonstrates. Extract them using:
\`\`\`skills
[{"name": "Python", "category": "technical"}, {"name": "Leadership", "category": "soft"}]
\`\`\`

Categories:
- "technical": Programming languages, frameworks (Python, React, SQL, etc.)
- "tool": Software/platforms (AWS, Docker, Jira, Figma, etc.)
- "soft": Interpersonal skills (Leadership, Communication, Mentoring, etc.)
- "methodology": Processes/practices (Agile, Scrum, TDD, CI/CD, etc.)

You can include skills in ANY response - not just when extracting bullets. Look for technologies, tools, and abilities mentioned in the conversation.`;
    
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
      model: openrouter.chatModel('openai/gpt-4-turbo'),
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
    
    // Extract any skills from the response
    const skillsMatch = fullResponse.match(/```skills\n?([\s\S]*?)\n?```/);
    let extractedSkills: Array<{name: string, category: string}> = [];
    
    if (skillsMatch && sessionId) {
      try {
        const skillsData = JSON.parse(skillsMatch[1]);
        if (Array.isArray(skillsData)) {
          extractedSkills = skillsData;
          for (const skill of skillsData) {
            addSessionSkill(sessionId, {
              id: randomUUID(),
              name: skill.name,
              category: skill.category || 'technical'
            });
          }
        }
      } catch (e) {
        console.error('Failed to parse skills:', e);
      }
    }
    
    // Store assistant message (without the extraction blocks)
    const cleanResponse = fullResponse
      .replace(/```bullet\n?[\s\S]*?\n?```/g, '')
      .replace(/```skills\n?[\s\S]*?\n?```/g, '')
      .trim();
    if (sessionId && cleanResponse) {
      addSessionMessage(sessionId, 'assistant', cleanResponse);
    }

    res.write(`data: ${JSON.stringify({ type: 'done', bullet: extractedBullet, skills: extractedSkills })}\n\n`);
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
