import { tool } from 'ai';
import { z } from 'zod';

/**
 * Tool for adding a resume bullet point
 * The AI calls this when it has gathered enough information to create a bullet
 */
export const addBulletTool = tool({
  description: `Add a polished bullet point to the user's resume. Call this when you have:
- A specific accomplishment with clear action taken
- Either quantifiable metrics (%, $, time, users) OR significant qualitative impact
- Enough context to write a professional, impactful bullet

BULLET QUALITY GUIDELINES:
- isStrong=true: Has specific metrics (e.g., "reduced latency by 60%", "saved $50K/year")
- isStrong=false: Significant impact without exact numbers (e.g., "led critical migration", "mentored junior engineers")

WRITING STYLE:
- Lead with strong action verbs: Spearheaded, Architected, Drove, Slashed, Boosted, Streamlined, Orchestrated
- Calculate percentages when impactful: "8 hours to 20 minutes" → "96% reduction"
- Structure: [Action verb] + [what you did] + [quantified result] + [how/technologies]
- DON'T copy user's words verbatim - polish into professional resume language
- Round numbers sensibly: 95.83% → ~96%

EXAMPLES:
- User: "made the api faster, went from 2 seconds to 200ms"
  → "Optimized API response time by 90% (2s → 200ms) through query optimization and Redis caching"
- User: "led a team of 4 to ship the new checkout flow"
  → "Spearheaded cross-functional team of 4 engineers to deliver redesigned checkout flow, increasing conversion by 15%"`,
  parameters: z.object({
    company: z.string().describe('Company name where this accomplishment occurred'),
    title: z.string().describe('Job title at the time of this accomplishment'),
    text: z.string().describe('The polished, professional bullet point text (use strong action verbs, include metrics)'),
    isStrong: z.boolean().describe('true if bullet has specific quantifiable metrics, false for qualitative impact'),
  }),
  execute: async ({ company, title, text, isStrong }) => {
    // Tool execution returns data that the chat handler will process
    return {
      success: true,
      bullet: { company, title, text, isStrong },
      message: `Bullet added for ${title} at ${company}`,
    };
  },
});

/**
 * Tool for extracting skills from the conversation
 */
export const addSkillTool = tool({
  description: `Extract a skill mentioned in the conversation. Call this when the user mentions or demonstrates a skill.
  
Categories:
- "technical": Programming languages, frameworks (Python, React, SQL, TypeScript, etc.)
- "tool": Software/platforms (AWS, Docker, Kubernetes, Jira, Figma, etc.)  
- "soft": Interpersonal skills (Leadership, Communication, Mentoring, Problem-solving, etc.)
- "methodology": Processes/practices (Agile, Scrum, TDD, CI/CD, Code Review, etc.)

Call this tool whenever you notice a skill - don't wait for bullet extraction.`,
  parameters: z.object({
    name: z.string().describe('Name of the skill (e.g., "Python", "AWS", "Leadership")'),
    category: z.enum(['technical', 'tool', 'soft', 'methodology']).describe('Category of the skill'),
  }),
  execute: async ({ name, category }) => {
    return {
      success: true,
      skill: { name, category },
      message: `Skill "${name}" (${category}) noted`,
    };
  },
});
