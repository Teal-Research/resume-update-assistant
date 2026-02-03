import type { Bullet } from '../types/index.js';

// Strong action verbs
const STRONG_VERBS = [
  'led', 'launched', 'built', 'created', 'designed', 'developed', 'drove',
  'established', 'generated', 'grew', 'implemented', 'improved', 'increased',
  'initiated', 'managed', 'orchestrated', 'pioneered', 'reduced', 'saved',
  'scaled', 'spearheaded', 'streamlined', 'transformed', 'delivered',
  'achieved', 'accelerated', 'automated', 'consolidated', 'doubled', 'tripled',
];

// Patterns indicating quantified impact
const QUANTIFIED_PATTERNS = [
  /\d+%/,                          // Percentages: 40%, 100%
  /\$[\d,]+[KMB]?/i,               // Dollar amounts: $50K, $1M
  /\d+[KMB]\+?/i,                  // Large numbers: 10K, 1M
  /\d+x/i,                         // Multipliers: 2x, 10x
  /\d+\s*(users?|clients?|customers?)/i,  // User counts
  /\d+\s*(team|engineers?|developers?|people)/i,  // Team size
  /\d+\s*(days?|weeks?|months?|hours?)/i,  // Time savings
];

/**
 * Score a bullet point for strength
 * Returns a score from 0-8 and determines if it's "strong" (>=4)
 */
export function scoreBullet(text: string): { score: number; isStrong: boolean; reasons: string[] } {
  const lowerText = text.toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  // Check for quantified impact (+2)
  const hasQuantified = QUANTIFIED_PATTERNS.some(pattern => pattern.test(text));
  if (hasQuantified) {
    score += 2;
    reasons.push('Quantified impact');
  }

  // Check for strong action verb (+1)
  const firstWord = lowerText.split(/\s+/)[0];
  const hasStrongVerb = STRONG_VERBS.some(verb => 
    firstWord === verb || firstWord === verb + 'd' || firstWord === verb + 'ed'
  );
  if (hasStrongVerb) {
    score += 1;
    reasons.push('Strong action verb');
  }

  // Check for specific outcome words (+1)
  const outcomeWords = ['result', 'outcome', 'impact', 'achieved', 'delivered', 'success'];
  const hasOutcome = outcomeWords.some(word => lowerText.includes(word));
  if (hasOutcome) {
    score += 1;
    reasons.push('Specific outcome');
  }

  // Check for technical/relevant keywords (+1)
  const technicalPatterns = [
    /\b(api|database|system|platform|infrastructure|architecture)\b/i,
    /\b(agile|scrum|ci\/cd|devops|automation)\b/i,
    /\b(revenue|profit|efficiency|performance|scalability)\b/i,
  ];
  const hasTechnical = technicalPatterns.some(pattern => pattern.test(text));
  if (hasTechnical) {
    score += 1;
    reasons.push('Relevant keywords');
  }

  // Bonus for multiple metrics (+1)
  const metricCount = QUANTIFIED_PATTERNS.filter(pattern => pattern.test(text)).length;
  if (metricCount >= 2) {
    score += 1;
    reasons.push('Multiple metrics');
  }

  // Length bonus - not too short, not too long (+1)
  const wordCount = text.split(/\s+/).length;
  if (wordCount >= 10 && wordCount <= 30) {
    score += 1;
    reasons.push('Good length');
  }

  return {
    score,
    isStrong: score >= 4,
    reasons,
  };
}

/**
 * Create a scored bullet object
 */
export function createScoredBullet(
  company: string,
  title: string,
  text: string,
  id?: string
): Bullet {
  const { score, isStrong } = scoreBullet(text);
  
  return {
    id: id || crypto.randomUUID(),
    company,
    title,
    text,
    isStrong,
    score,
  };
}
