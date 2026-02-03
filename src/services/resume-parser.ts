import fs from 'fs/promises';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

export interface ExtractedText {
  text: string;
  numPages: number;
  info?: {
    title?: string;
    author?: string;
  };
}

/**
 * Extract text content from a PDF file
 */
export async function extractTextFromPDF(filePath: string): Promise<ExtractedText> {
  try {
    const buffer = await fs.readFile(filePath);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    
    // Clean up the extracted text
    const cleanedText = cleanText(result.text);
    
    return {
      text: cleanedText,
      numPages: result.numpages || 1,
      info: {
        title: result.info?.Title,
        author: result.info?.Author,
      },
    };
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * Clean up extracted text by removing extra whitespace and artifacts
 */
function cleanText(text: string): string {
  return text
    // Normalize line breaks
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove excessive blank lines
    .replace(/\n{3,}/g, '\n\n')
    // Remove excessive spaces
    .replace(/ {2,}/g, ' ')
    // Trim each line
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Final trim
    .trim();
}

/**
 * Check if the extracted text appears to be a resume
 */
export function looksLikeResume(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  // Common resume indicators
  const indicators = [
    'experience',
    'education',
    'skills',
    'work history',
    'employment',
    'professional',
    'summary',
    'objective',
  ];
  
  const matchCount = indicators.filter(ind => lowerText.includes(ind)).length;
  
  return matchCount >= 2;
}
