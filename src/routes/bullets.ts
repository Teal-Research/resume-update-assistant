import { Router, Request, Response } from 'express';
import { getSessionBullets } from '../services/session-store.js';

const router = Router();

/**
 * Get all bullets for a session
 */
router.get('/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  if (!sessionId) {
    res.status(400).json({ error: 'Session ID is required' });
    return;
  }
  
  const bullets = getSessionBullets(sessionId as string);
  
  // Group bullets by company/title
  const grouped: Record<string, { company: string; title: string; bullets: typeof bullets }> = {};
  
  for (const bullet of bullets) {
    const key = `${bullet.company}|${bullet.title}`;
    if (!grouped[key]) {
      grouped[key] = {
        company: bullet.company,
        title: bullet.title,
        bullets: [],
      };
    }
    grouped[key].bullets.push(bullet);
  }
  
  res.json({
    success: true,
    total: bullets.length,
    groups: Object.values(grouped),
  });
});

export default router;
