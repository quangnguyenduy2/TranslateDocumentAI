
import { GoogleGenAI, Type } from "@google/genai";
import { SupportedLanguage, GlossaryItem } from "../types";

// Always use process.env.API_KEY directly as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_FAST = 'gemini-3-flash-preview';
const MODEL_IMAGE = 'gemini-2.5-flash-image';

/**
 * Lọc glossary liên quan đến đoạn văn bản hiện tại.
 */
const filterRelevantGlossary = (text: string, fullGlossary: GlossaryItem[]): GlossaryItem[] => {
  if (!fullGlossary || fullGlossary.length === 0) return [];
  const textLower = text.toLowerCase();
  return fullGlossary.filter(item => textLower.includes(item.term.toLowerCase()));
};

const buildSystemInstruction = (targetLang: SupportedLanguage, context: string, relevantGlossary: GlossaryItem[]) => {
  let instruction = `You are a Multimodal Translator Expert. 
1. Translate to ${targetLang}.
2. Preserve formatting/layout.
3. Use professional tone.`;

  if (context?.trim()) instruction += `\nCONTEXT: ${context}`;
  if (relevantGlossary.length > 0) {
    instruction += `\n\nGLOSSARY:\n` + relevantGlossary.map(i => `- ${i.term} -> ${i.translation}`).join('\n');
  }
  return instruction;
};

/**
 * Convert SupportedLanguage enum to language code
 */
const getLanguageCode = (lang: SupportedLanguage): string => {
  const map: Record<string, string> = {
    'English': 'en',
    'Vietnamese': 'vi',
    'Japanese': 'ja',
    'Korean': 'ko',
    'Chinese (Simplified)': 'zh',
    'Chinese (Traditional)': 'zh',
    'Spanish': 'es',
    'French': 'fr',
    'German': 'de'
  };
  return map[lang] || 'en';
};

/**
 * Extract placeholders for content that doesn't need translation
 * Smart detection based on source → target language pair
 * Reduces token usage by 30-50%
 * Example: Japanese→Vietnamese: keep English words, numbers, URLs
 * Example: English→Vietnamese: keep Japanese/Chinese characters, numbers, URLs
 */
const extractPlaceholders = (
  text: string,
  sourceLang: string,
  targetLang: SupportedLanguage
): { cleanedText: string; placeholders: string[] } => {
  if (!text || text.trim().length === 0) return { cleanedText: text, placeholders: [] };

  const placeholders: string[] = [];
  let placeholderIndex = 0;
  let result = text;

  // Always preserve these regardless of language:
  // 1. URLs
  result = result.replace(/(https?:\/\/[^\s]+|ftp:\/\/[^\s]+)/gi, (match) => {
    placeholders.push(match);
    return `__P${placeholderIndex++}__`;
  });

  // 2. Email addresses
  result = result.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi, (match) => {
    placeholders.push(match);
    return `__P${placeholderIndex++}__`;
  });

  // 3. Code in backticks
  result = result.replace(/`[^`]+`/g, (match) => {
    placeholders.push(match);
    return `__P${placeholderIndex++}__`;
  });

  // 4. Numbers with units (including currency, percentage)
  result = result.replace(/\b[\d.,]+\s*(%|kg|km|m|cm|mm|g|L|ml|GB|MB|KB|TB|USD|EUR|JPY|VND|CNY|\$|€|¥|₫|£)\b/gi, (match) => {
    placeholders.push(match);
    return `__P${placeholderIndex++}__`;
  });

  // 5. Pure numbers (standalone)
  result = result.replace(/\b\d+(?:[.,]\d+)*\b/g, (match) => {
    placeholders.push(match);
    return `__P${placeholderIndex++}__`;
  });

  // Language-specific preservation:
  const targetLangCode = getLanguageCode(targetLang);

  // If translating FROM Japanese TO non-English: Keep English words
  if (sourceLang === 'ja' && targetLangCode !== 'en') {
    result = result.replace(/\b[a-zA-Z]{3,}(?:[-_][a-zA-Z0-9]+)*\b/g, (match) => {
      placeholders.push(match);
      return `__P${placeholderIndex++}__`;
    });
  }
  // If translating FROM English TO non-Japanese/Chinese: Keep Japanese/Chinese characters
  else if (sourceLang === 'en' && targetLangCode !== 'ja' && targetLangCode !== 'zh') {
    result = result.replace(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+/g, (match) => {
      placeholders.push(match);
      return `__P${placeholderIndex++}__`;
    });
  }
  // If translating between two non-English languages: Keep English words
  else if (sourceLang !== 'en' && targetLangCode !== 'en') {
    result = result.replace(/\b[a-zA-Z]{2,}(?:[-_][a-zA-Z0-9]+)*\b/g, (match) => {
      placeholders.push(match);
      return `__P${placeholderIndex++}__`;
    });
  }

  return { cleanedText: result, placeholders };
};

/**
 * Restore placeholders back to original text
 */
const restorePlaceholders = (translatedText: string, placeholders: string[]): string => {
  let result = translatedText;
  placeholders.forEach((placeholder, index) => {
    result = result.replace(new RegExp(`__P${index}__`, 'g'), placeholder);
  });
  return result;
};

/**
 * Parse Gemini API error to extract error code and message
 */
const parseApiError = (error: any): { code: number | null; message: string; status: string | null } => {
  // Case 1: SDK throws ApiError with status property directly
  if (error?.status && typeof error.status === 'number') {
    // Try to parse message as JSON to get detailed error info
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.error) {
        return {
          code: parsed.error.code || error.status,
          message: parsed.error.message || error.message,
          status: parsed.error.status || null
        };
      }
    } catch {
      // If message is not JSON, use status directly
      return {
        code: error.status,
        message: error.message || 'API Error',
        status: null
      };
    }
  }
  
  // Case 2: Response object with nested error (from API response)
  if (error?.error?.code) {
    return {
      code: error.error.code,
      message: error.error.message || 'Unknown API error',
      status: error.error.status || null
    };
  }
  
  // Case 3: Standard Error object
  if (error instanceof Error) {
    return { code: null, message: error.message, status: null };
  }
  
  return { code: null, message: String(error), status: null };
};

/**
 * Detect language of text using character patterns
 * Returns: 'vi' | 'ja' | 'en' | 'ko' | 'zh' | 'unknown'
 */
export const detectLanguage = (text: string): string => {
  if (!text || text.trim().length === 0) return 'unknown';
  
  const cleanText = text.replace(/<\/?[biusOBIUS]>/g, '').trim(); // Remove formatting tags
  
  // Vietnamese: Latin chars + Vietnamese diacritics
  const viPattern = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸ]/;
  if (viPattern.test(cleanText)) return 'vi';
  
  // Japanese: Hiragana, Katakana, Kanji
  const jaPattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
  if (jaPattern.test(cleanText)) return 'ja';
  
  // Korean: Hangul
  const koPattern = /[\uAC00-\uD7AF\u1100-\u11FF]/;
  if (koPattern.test(cleanText)) return 'ko';
  
  // Chinese: CJK Unified Ideographs (overlaps with Japanese but check context)
  const zhPattern = /[\u4E00-\u9FFF]/;
  const hasJapanese = jaPattern.test(cleanText);
  if (zhPattern.test(cleanText) && !hasJapanese) return 'zh';
  
  // English: mostly Latin alphabet without Vietnamese diacritics
  const enPattern = /^[a-zA-Z0-9\s.,;:!?'"-()\[\]{}@#$%^&*+=/<>|\\~`]+$/;
  if (enPattern.test(cleanText)) return 'en';
  
  return 'unknown';
};

/**
 * Dịch nội dung ảnh: Trả về base64 của ảnh đã được thay thế chữ.
 */
export const translateImageContent = async (
  base64Data: string, 
  mimeType: string, 
  targetLang: string,
  context: string = ''
): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_IMAGE,
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { 
            text: `Translate all text in this image into ${targetLang}. 
            Context: ${context}.
            CRITICAL: Preserve the background, layout, colors, and font styles exactly. 
            The output must be the modified image data.` 
          },
        ],
      },
    });

    // Check if response contains API error
    if ((response as any).error) {
      const errorData = parseApiError(response);
      console.error(`API Error in image translation: ${errorData.code} - ${errorData.message}`);
      throw response;
    }

    // Iterate through candidates and parts to find the image part
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return part.inlineData.data;
      }
    }
    return null;
  } catch (error) {
    console.error("Image translation error:", error);
    return null;
  }
};

export const extractTextFromBase64 = async (base64Data: string, mimeType: string = 'image/png'): Promise<string> => {
  const prompt = `OCR expert: Extract ALL text as Markdown. Preserve layout. Do not translate.`;
  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: { parts: [{ inlineData: { mimeType, data: base64Data } }, { text: prompt }] }
    });
    
    // Check if response contains API error
    if ((response as any).error) {
      const errorData = parseApiError(response);
      console.error(`API Error in OCR: ${errorData.code} - ${errorData.message}`);
      throw response;
    }
    
    return response.text?.replace(/^```markdown\s*|```$/g, '') || '';
  } catch { return ""; }
};

export const extractTextFromImage = async (file: File): Promise<string> => {
  const reader = new FileReader();
  const base64 = await new Promise<string>((res) => {
    reader.onload = () => res((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return extractTextFromBase64(base64, file.type);
};

export const translateText = async (
  text: string,
  targetLang: SupportedLanguage,
  context: string = '',
  glossary: GlossaryItem[] = [],
  sourceLangOverride?: string // Optional: 'auto' uses detectLanguage(), or specify 'vi'/'ja'/'en' etc.
): Promise<string> => {
  if (!text.trim()) return '';
  
  // Detect source language (or use override if provided)
  const sourceLang = sourceLangOverride && sourceLangOverride !== 'auto' 
    ? sourceLangOverride 
    : detectLanguage(text);
  
  // Extract placeholders to save tokens (smart: based on source→target)
  const { cleanedText, placeholders } = extractPlaceholders(text, sourceLang, targetLang);
  
  // If nothing left to translate (all placeholders), return original
  const textToTranslate = cleanedText.replace(/__P\d+__/g, '').trim();
  if (textToTranslate.length === 0) {
    return text;
  }
  
  const relevantGlossary = filterRelevantGlossary(cleanedText, glossary);
  const instruction = buildSystemInstruction(targetLang, context, relevantGlossary);
  const prompt = placeholders.length > 0
    ? `${instruction}\n\nTranslate this (keep __P0__, __P1__, etc. as-is):\n${cleanedText}`
    : `${instruction}\n\nTranslate this:\n${cleanedText}`;
  
  const response = await ai.models.generateContent({ model: MODEL_FAST, contents: prompt });
  
  // Check if response contains API error
  if ((response as any).error) {
    const errorData = parseApiError(response);
    console.error(`API Error in translateText: ${errorData.code} - ${errorData.message}`);
    throw response;
  }
  
  const translated = response.text?.replace(/^```markdown\s*|```$/g, '') || cleanedText;
  
  // Restore placeholders if any
  return placeholders.length > 0 ? restorePlaceholders(translated, placeholders) : translated;
};

export const translateBatchStrings = async (
  texts: string[],
  targetLang: SupportedLanguage,
  context: string = '',
  glossary: GlossaryItem[] = [],
  sourceLangOverride?: string // Optional: 'auto' uses detectLanguage(), or specify 'vi'/'ja'/'en' etc.
): Promise<string[]> => {
  if (texts.length === 0) return [];
  
  // Detect source language from first non-empty text (or use override if provided)
  const firstText = texts.find(t => t.trim().length > 0) || '';
  const sourceLang = sourceLangOverride && sourceLangOverride !== 'auto'
    ? sourceLangOverride
    : detectLanguage(firstText);
  
  // Extract placeholders from all texts (smart: based on source→target)
  const extractedData = texts.map(text => extractPlaceholders(text, sourceLang, targetLang));
  const cleanedTexts = extractedData.map(d => d.cleanedText);
  
  const relevantGlossary = filterRelevantGlossary(cleanedTexts.join(' '), glossary);
  const instruction = buildSystemInstruction(targetLang, context, relevantGlossary);
  const hasPlaceholders = extractedData.some(d => d.placeholders.length > 0);
  const prompt = hasPlaceholders
    ? `${instruction}\n\nTranslate this JSON array. Keep __P0__, __P1__ placeholders as-is. Maintain order.`
    : `${instruction}\n\nTranslate this JSON array of strings. Maintain order.`;
  
  // Retry with exponential backoff (3 attempts with longer delays)
  let lastError: any;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL_FAST,
        contents: { parts: [{ text: prompt }, { text: JSON.stringify(cleanedTexts) }] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: { translations: { type: Type.ARRAY, items: { type: Type.STRING } } }
          }
        }
      });
      
      // Check if response contains API error (quota/rate limit)
      // SDK may return error object instead of throwing exception
      if ((response as any).error) {
        const errorData = parseApiError(response);
        console.error(`🛑 API returned error object: ${errorData.code} - ${errorData.message}`);
        
        // Create error object to throw (will be caught by catch block below)
        const errorToThrow = new Error(errorData.message);
        (errorToThrow as any).error = (response as any).error; // Preserve error structure
        throw errorToThrow;
      }
      
      const translations = JSON.parse(response.text || '{}').translations;
      if (translations && Array.isArray(translations) && translations.length === texts.length) {
        // Restore placeholders for all translations
        return translations.map((translated, index) =>
          extractedData[index].placeholders.length > 0
            ? restorePlaceholders(translated, extractedData[index].placeholders)
            : translated
        );
      }
    } catch (error) {
      lastError = error;
      
      // Parse error to check code (works for both Error objects and API error responses)
      const errorData = parseApiError(error);
      
      // If quota/auth/forbidden error, throw immediately - NO RETRY
      if (errorData.code === 429 || errorData.code === 401 || errorData.code === 403) {
        console.error(`❌ CRITICAL ERROR ${errorData.code}: ${errorData.message}`);
        throw error; // Throw immediately to stop processing
      }
      
      // For other errors, retry with exponential backoff
      if (attempt < 3) {
        const baseDelay = Math.pow(2, attempt) * 2000;
        console.warn(`Batch translation attempt ${attempt}/3 failed (${errorData.message}), retrying in ${baseDelay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, baseDelay));
      }
    }
  }
  
  // All retries failed - check if it was critical error
  const lastErrorData = parseApiError(lastError);
  if (lastErrorData.code === 429 || lastErrorData.code === 401 || lastErrorData.code === 403) {
    console.error(`❌ CRITICAL ERROR ${lastErrorData.code} after all retries - STOPPING`);
    throw lastError; // Stop processing completely
  }
  
  // For non-critical errors: Fallback to individual translation
  console.warn('Batch translation failed after 3 retries, falling back to individual translation');
  const individualTranslations = await Promise.all(
    texts.map(async (text) => {
      try {
        return await translateText(text, targetLang, context, glossary);
      } catch (error) {
        // Check quota exhaustion in individual translation
        const errorData = parseApiError(error);
        if (errorData.code === 429 || errorData.code === 401 || errorData.code === 403) {
          console.error(`❌ CRITICAL ERROR ${errorData.code} in individual translation - STOPPING`);
          throw error; // Stop immediately
        }
        console.warn(`Individual translation failed for text, returning original: ${errorData.message}`);
        return text; // Last resort: return original
      }
    })
  );
  return individualTranslations;
};
