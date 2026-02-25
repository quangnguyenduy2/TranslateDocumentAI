/**
 * Translation Client - Wrapper around backend API
 * Replaces direct geminiService calls with backend API calls
 */
import { translationAPI } from './apiClient';
import { SupportedLanguage, GlossaryItem, BlacklistItem } from '../types';

/**
 * Translate single text via backend API
 */
export const translateText = async (
  text: string,
  targetLang: SupportedLanguage,
  context: string = '',
  glossary: GlossaryItem[] = [],
  sourceLangOverride?: string,
  blacklist: BlacklistItem[] = []
): Promise<string> => {
  try {
    const response = await translationAPI.translateText({
      text,
      targetLang,
      sourceLang: sourceLangOverride,
      context,
      glossary: glossary.map(g => ({ source: g.term, target: g.translation })),
      blacklist: blacklist.filter(b => b.enabled !== false).map(b => ({ text: b.term, caseSensitive: b.caseSensitive })),
    });
    
    return response.data.translatedText;
  } catch (error: any) {
    console.error('Translation error:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Translate batch of strings via backend API
 */
export const translateBatchStrings = async (
  texts: string[],
  targetLang: SupportedLanguage,
  context: string = '',
  glossary: GlossaryItem[] = [],
  sourceLangOverride?: string,
  blacklist: BlacklistItem[] = []
): Promise<string[]> => {
  try {
    const response = await translationAPI.translateBatch({
      texts,
      targetLang,
      sourceLang: sourceLangOverride,
      context,
      glossary: glossary.map(g => ({ source: g.term, target: g.translation })),
      blacklist: blacklist.filter(b => b.enabled !== false).map(b => ({ text: b.term, caseSensitive: b.caseSensitive })),
    });
    
    return response.data.translations;
  } catch (error: any) {
    console.error('Batch translation error:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Extract text from base64 image via backend API (OCR)
 */
export const extractTextFromBase64 = async (
  base64Data: string,
  mimeType: string = 'image/png'
): Promise<string> => {
  try {
    const response = await translationAPI.extractText({
      base64Data,
      mimeType,
    });
    
    return response.data.extractedText;
  } catch (error: any) {
    console.error('OCR error:', error.response?.data || error.message);
    return '';
  }
};

/**
 * Extract text from image file
 */
export const extractTextFromImage = async (file: File): Promise<string> => {
  const reader = new FileReader();
  const base64 = await new Promise<string>((resolve) => {
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return extractTextFromBase64(base64, file.type);
};

/**
 * Detect language of text using character patterns
 * Note: This is done on frontend for quick detection before sending to backend
 * Returns: 'vi' | 'ja' | 'en' | 'ko' | 'zh' | 'unknown'
 */
export const detectLanguage = (text: string): string => {
  if (!text || text.trim().length === 0) return 'unknown';
  
  const cleanText = text.replace(/<\/?[biusOBIUS]>/g, '').trim();
  
  // Vietnamese: Latin chars + Vietnamese diacritics
  const viPattern = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸ]/;
  if (viPattern.test(cleanText)) return 'vi';
  
  // Japanese: Hiragana, Katakana, Kanji
  const jaPattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
  if (jaPattern.test(cleanText)) return 'ja';
  
  // Korean: Hangul
  const koPattern = /[\uAC00-\uD7AF\u1100-\u11FF]/;
  if (koPattern.test(cleanText)) return 'ko';
  
  // Chinese: CJK Unified Ideographs
  const zhPattern = /[\u4E00-\u9FFF]/;
  const hasJapanese = jaPattern.test(cleanText);
  if (zhPattern.test(cleanText) && !hasJapanese) return 'zh';
  
  // English: mostly Latin alphabet
  const enPattern = /^[a-zA-Z0-9\s.,;:!?'"-()\[\]{}@#$%^&*+=/<>|\\~`]+$/;
  if (enPattern.test(cleanText)) return 'en';
  
  return 'unknown';
};
