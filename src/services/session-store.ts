import type { ParsedResume, Bullet, Skill, Session } from '../types/index.js';

// In-memory session store
const sessions = new Map<string, Session>();

// Session TTL: 1 hour
const SESSION_TTL_MS = 60 * 60 * 1000;

/**
 * Create a new session
 */
export function createSession(id: string): Session {
  const now = new Date();
  const session: Session = {
    id,
    resume: undefined,
    bullets: [],
    skills: [],
    methodology: 'Open',
    messages: [],
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
  };
  
  sessions.set(id, session);
  return session;
}

/**
 * Get a session by ID
 */
export function getSession(id: string): Session | undefined {
  const session = sessions.get(id);
  
  if (!session) return undefined;
  
  // Check expiry
  if (new Date() > session.expiresAt) {
    sessions.delete(id);
    return undefined;
  }
  
  return session;
}

/**
 * Get or create a session
 */
export function getOrCreateSession(id: string): Session {
  return getSession(id) || createSession(id);
}

/**
 * Update session with parsed resume
 */
export function setSessionResume(id: string, resume: ParsedResume): void {
  const session = getOrCreateSession(id);
  session.resume = resume;
}

/**
 * Add a message to session history
 */
export function addSessionMessage(
  id: string, 
  role: 'user' | 'assistant', 
  content: string
): void {
  const session = getOrCreateSession(id);
  session.messages.push({ role, content });
  
  // Keep only last 20 messages to manage context size
  if (session.messages.length > 20) {
    session.messages = session.messages.slice(-20);
  }
}

/**
 * Get session messages for context
 */
export function getSessionMessages(id: string): Array<{ role: 'user' | 'assistant'; content: string }> {
  const session = getSession(id);
  return session?.messages || [];
}

/**
 * Set session methodology
 */
export function setSessionMethodology(
  id: string, 
  methodology: 'STAR' | 'XYZ' | 'CAR' | 'Open'
): void {
  const session = getOrCreateSession(id);
  session.methodology = methodology;
}

/**
 * Add a bullet to the session
 */
export function addSessionBullet(id: string, bullet: Bullet): void {
  const session = getOrCreateSession(id);
  session.bullets.push(bullet);
}

/**
 * Get all bullets for a session
 */
export function getSessionBullets(id: string): Bullet[] {
  const session = getSession(id);
  return session?.bullets || [];
}

/**
 * Add a skill to the session (avoids duplicates by name)
 */
export function addSessionSkill(id: string, skill: Skill): void {
  const session = getOrCreateSession(id);
  // Avoid duplicates
  if (!session.skills.some(s => s.name.toLowerCase() === skill.name.toLowerCase())) {
    session.skills.push(skill);
  }
}

/**
 * Get all skills for a session
 */
export function getSessionSkills(id: string): Skill[] {
  const session = getSession(id);
  return session?.skills || [];
}

/**
 * Clean up expired sessions (call periodically)
 */
export function cleanupExpiredSessions(): number {
  const now = new Date();
  let cleaned = 0;
  
  for (const [id, session] of sessions) {
    if (now > session.expiresAt) {
      sessions.delete(id);
      cleaned++;
    }
  }
  
  return cleaned;
}

/**
 * Get session count (for debugging)
 */
export function getSessionCount(): number {
  return sessions.size;
}

// Run cleanup every 10 minutes
setInterval(() => {
  const cleaned = cleanupExpiredSessions();
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} expired sessions`);
  }
}, 10 * 60 * 1000);
