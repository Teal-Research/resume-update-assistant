export interface Contact {
  name: string;
  email?: string;
  phone?: string;
  location?: string;
}

export interface Experience {
  company: string;
  title: string;
  startDate: string;
  endDate: string | 'Present';
  bullets: string[];
  isCurrentRole: boolean;
}

export interface Education {
  institution: string;
  degree: string;
  year?: string;
}

export interface ParsedResume {
  contact: Contact;
  experience: Experience[];
  education: Education[];
  skills: string[];
}

export interface Bullet {
  id: string;
  company: string;
  title: string;
  text: string;
  isStrong: boolean;
  score: number;
}

export interface Skill {
  id: string;
  name: string;
  category: 'technical' | 'tool' | 'soft' | 'methodology';
}

export interface Session {
  id: string;
  resume?: ParsedResume;
  bullets: Bullet[];
  skills: Skill[];
  methodology: 'STAR' | 'XYZ' | 'CAR' | 'Open';
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  createdAt: Date;
  expiresAt: Date;
}
