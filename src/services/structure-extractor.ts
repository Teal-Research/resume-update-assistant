import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import type { ParsedResume, Experience, Education, Contact } from '../types/index.js';

// Initialize OpenRouter
let openrouter: ReturnType<typeof createOpenAI> | null = null;

function getProvider() {
  if (!openrouter) {
    openrouter = createOpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      headers: {
        'HTTP-Referer': 'https://github.com/teal-research/resume-update-assistant',
        'X-Title': 'Resume Update Assistant',
      },
    });
  }
  return openrouter;
}

/**
 * Extract structured resume data from raw text using LLM
 */
export async function extractResumeStructure(rawText: string): Promise<ParsedResume> {
  const provider = getProvider();
  
  const result = await generateText({
    model: provider('anthropic/claude-3.5-sonnet'),
    system: `You are a resume parser. Extract structured data from resume text and respond ONLY with valid JSON matching this schema:

{
  "contact": {
    "name": "string",
    "email": "string or null",
    "phone": "string or null",
    "location": "string or null"
  },
  "experience": [
    {
      "company": "string",
      "title": "string",
      "startDate": "string (e.g., Jan 2020)",
      "endDate": "string (e.g., Dec 2021 or Present)",
      "bullets": ["string array of accomplishments"],
      "isCurrentRole": true/false
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "year": "string or null"
    }
  ],
  "skills": ["string array"]
}

Important:
- Order experience from most recent to oldest
- Mark the most recent role as isCurrentRole: true
- Respond with ONLY the JSON, no other text`,
    prompt: rawText,
  });

  // Parse the JSON response
  try {
    // Clean up potential markdown code blocks
    let jsonText = result.text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    }
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();
    
    const parsed = JSON.parse(jsonText);
    
    // Validate and normalize the structure
    return normalizeResume(parsed);
  } catch (error) {
    console.error('Failed to parse LLM response:', result.text);
    throw new Error('Failed to parse resume structure from LLM response');
  }
}

/**
 * Normalize and validate the parsed resume structure
 */
function normalizeResume(data: any): ParsedResume {
  const contact: Contact = {
    name: data.contact?.name || 'Unknown',
    email: data.contact?.email || undefined,
    phone: data.contact?.phone || undefined,
    location: data.contact?.location || undefined,
  };

  const experience: Experience[] = (data.experience || []).map((exp: any) => ({
    company: exp.company || 'Unknown Company',
    title: exp.title || 'Unknown Title',
    startDate: exp.startDate || 'Unknown',
    endDate: exp.endDate || 'Unknown',
    bullets: Array.isArray(exp.bullets) ? exp.bullets : [],
    isCurrentRole: Boolean(exp.isCurrentRole),
  }));

  const education: Education[] = (data.education || []).map((edu: any) => ({
    institution: edu.institution || 'Unknown',
    degree: edu.degree || 'Unknown',
    year: edu.year || undefined,
  }));

  const skills: string[] = Array.isArray(data.skills) ? data.skills : [];

  return { contact, experience, education, skills };
}

/**
 * Identify which role is most recent based on dates
 */
export function identifyMostRecentRole(experience: ParsedResume['experience']): number {
  if (experience.length === 0) return -1;
  
  // Find the role marked as current
  const currentIndex = experience.findIndex(exp => 
    exp.isCurrentRole || 
    exp.endDate.toLowerCase() === 'present' ||
    exp.endDate.toLowerCase() === 'current'
  );
  
  if (currentIndex !== -1) return currentIndex;
  
  // Otherwise, assume first entry is most recent (as per extraction order)
  return 0;
}
