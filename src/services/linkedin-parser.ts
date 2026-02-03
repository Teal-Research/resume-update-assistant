import type { ParsedResume } from '../types/index.js';

/**
 * Fetch and parse a public LinkedIn profile
 * Note: LinkedIn heavily restricts scraping, so this works best with public profiles
 * and may require fallback to manual entry
 */
export async function fetchLinkedInProfile(url: string): Promise<{ html: string; isPublic: boolean }> {
  // Validate URL
  if (!url.includes('linkedin.com/in/')) {
    throw new Error('Invalid LinkedIn profile URL. Please use a URL like: https://linkedin.com/in/username');
  }

  try {
    // Fetch with a browser-like user agent
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch profile: ${response.status}`);
    }

    const html = await response.text();
    
    // Check if we got a public profile or a login wall
    const isPublic = !html.includes('authwall') && !html.includes('sign-in');
    
    return { html, isPublic };
  } catch (error) {
    console.error('LinkedIn fetch error:', error);
    throw new Error('Failed to fetch LinkedIn profile. The profile may be private or LinkedIn may be blocking requests.');
  }
}

/**
 * Extract experience data from LinkedIn HTML
 * Attempts to parse JSON-LD schema first, then falls back to HTML parsing
 */
export function parseLinkedInHTML(html: string): Partial<ParsedResume> | null {
  try {
    // Try to extract JSON-LD data
    const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    
    if (jsonLdMatch) {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      
      if (jsonLd['@type'] === 'Person') {
        return parseJsonLdPerson(jsonLd);
      }
    }

    // Fallback: try to extract from HTML meta tags
    const nameMatch = html.match(/<title>([^|<]+)/);
    const descMatch = html.match(/<meta name="description" content="([^"]+)"/);
    
    if (nameMatch) {
      return {
        contact: {
          name: nameMatch[1].trim(),
        },
        experience: [],
        education: [],
        skills: [],
      };
    }

    return null;
  } catch (error) {
    console.error('LinkedIn parse error:', error);
    return null;
  }
}

/**
 * Parse JSON-LD Person schema into resume format
 */
function parseJsonLdPerson(data: any): Partial<ParsedResume> {
  const experience: ParsedResume['experience'] = [];
  
  // Parse work experience if available
  if (data.worksFor) {
    const companies = Array.isArray(data.worksFor) ? data.worksFor : [data.worksFor];
    for (const work of companies) {
      experience.push({
        company: work.name || work.organization?.name || 'Unknown',
        title: work.jobTitle || 'Unknown',
        startDate: 'Unknown',
        endDate: 'Present',
        bullets: [],
        isCurrentRole: true,
      });
    }
  }

  return {
    contact: {
      name: data.name || 'Unknown',
      location: data.address?.addressLocality,
    },
    experience,
    education: [],
    skills: [],
  };
}

/**
 * Check if a URL is a valid LinkedIn profile URL
 */
export function isLinkedInUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('linkedin.com') && parsed.pathname.startsWith('/in/');
  } catch {
    return false;
  }
}
