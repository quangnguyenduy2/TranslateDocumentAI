import { GoogleGenAI, Type } from "@google/genai";
import { SupportedLanguage, GlossaryItem } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const MODEL_FAST = 'gemini-3-flash-preview';

/**
 * Filters the master glossary to only include terms that appear in the source text.
 * This effectively creates a subset glossary for the specific translation task.
 * Case-insensitive matching.
 */
const filterRelevantGlossary = (text: string, fullGlossary: GlossaryItem[]): GlossaryItem[] => {
  if (!fullGlossary || fullGlossary.length === 0) return [];
  
  const textLower = text.toLowerCase();
  const relevantItems: GlossaryItem[] = [];
  
  // Optimization: If glossary is massive (e.g. 10k), looping every time might be slightly costly 
  // but still faster than network. For < 10k items, simple iteration is sub-10ms.
  for (const item of fullGlossary) {
    if (textLower.includes(item.term.toLowerCase())) {
      relevantItems.push(item);
    }
  }
  return relevantItems;
};

const buildSystemInstruction = (targetLang: SupportedLanguage, context: string, relevantGlossary: GlossaryItem[]) => {
  let instruction = `You are a Multimodal Translator Expert, capable of processing and translating complex documents and text extracted from images with high precision.

YOUR MISSION:
1. Translate the input content to ${targetLang}.
2. Auto-detect the source language.
3. If the input is structured text (Markdown from OCR), PRESERVE the layout, tables, code blocks, and special formatting strictly.
4. Do not simplify technical terms unless instructed. Maintain a professional tone.
`;

  if (context && context.trim()) {
    instruction += `\nCONTEXT INFO:\n${context}`;
  }

  if (relevantGlossary && relevantGlossary.length > 0) {
    instruction += `\n\nGLOSSARY (Strictly enforce these translations):\n`;
    relevantGlossary.forEach(item => {
      instruction += `- ${item.term} -> ${item.translation}\n`;
    });
  }

  return instruction;
};

// Helper to read file as Base64 (stripping the data URL prefix)
const fileToBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove "data:image/png;base64," prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

/**
 * Core function to extract text from Base64 image data
 */
export const extractTextFromBase64 = async (base64Data: string, mimeType: string = 'image/png'): Promise<string> => {
  const prompt = `
    You are an advanced OCR expert. Analyze this image and extract ALL visible text.

    CRITICAL RULES:
    1. Output ONLY the extracted text formatted as Markdown.
    2. PRESERVE the visual layout structure (headers, tables, lists, grids) as closely as possible.
    3. DO NOT IGNORE small, blurry, rotated, or low-contrast text. Transcribe everything readable.
    4. If there are charts, graphs, or diagrams, transcribe the visible text labels, legends, and data points into a structured Markdown representation (e.g., a table or a list).
    5. Do NOT translate yet. Just transcribe in the original language.
    6. If the image contains absolutely no text, return "NO_TEXT_FOUND".
    7. Do not describe visual elements (like "a photo of a sunset") unless they act as a caption for text.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: prompt }
          ]
        }
      ]
    });
    
    let text = response.text || '';
    if (text.startsWith('```markdown')) {
      text = text.replace(/^```markdown\s*/, '').replace(/\s*```$/, '');
    }
    return text;
  } catch (error) {
    console.error("Image OCR error:", error);
    // Return empty string on error so flow doesn't break, but log it
    return ""; 
  }
};

/**
 * Extracts text from an image file using multimodal capabilities (OCR).
 */
export const extractTextFromImage = async (file: File): Promise<string> => {
  const base64Data = await fileToBase64(file);
  return extractTextFromBase64(base64Data, file.type);
};

/**
 * Translates a plain text block (used for Markdown/Text).
 */
export const translateText = async (
  text: string,
  targetLang: SupportedLanguage,
  context: string = '',
  glossary: GlossaryItem[] = []
): Promise<string> => {
  if (!text.trim()) return '';

  // Filter glossary to only what's needed for THIS text block
  const relevantGlossary = filterRelevantGlossary(text, glossary);
  const systemInstruction = buildSystemInstruction(targetLang, context, relevantGlossary);

  const prompt = `
    ${systemInstruction}
    
    IMPORTANT RULES:
    1. Preserve ALL Markdown formatting (bold, italic, headers, links, tables).
    2. DO NOT translate code blocks (\`\`\` ... \`\`\`) or inline code.
    3. DO NOT translate Frontmatter keys (YAML headers), only values if they are prose.
    4. Keep HTML tags intact.
    5. Maintain the original tone and structure.
    6. Output ONLY the translated content, no introductory or concluding remarks.
    
    Content to translate:
    ${text}
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
    });
    
    let result = response.text || text;

    if (result.startsWith('```markdown')) {
        result = result.replace(/^```markdown\s*/, '').replace(/\s*```$/, '');
    } else if (result.startsWith('```')) {
        result = result.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    return result;
  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
};

/**
 * Translates an array of strings (used for Excel cells) using JSON schema for strict output.
 */
export const translateBatchStrings = async (
  texts: string[],
  targetLang: SupportedLanguage,
  context: string = '',
  glossary: GlossaryItem[] = []
): Promise<string[]> => {
  if (texts.length === 0) return [];

  // For batches, we join all texts to find relevant glossary terms for the whole batch
  const combinedText = texts.join(' ');
  const relevantGlossary = filterRelevantGlossary(combinedText, glossary);
  
  const systemInstruction = buildSystemInstruction(targetLang, context, relevantGlossary);

  const prompt = `
    ${systemInstruction}

    Task: Translate the following array of text strings to ${targetLang}.
    Return a JSON object containing an array of translated strings in the EXACT same order.
    
    IMPORTANT FORMATTING RULES:
    1. The input strings may contain HTML-like tags for formatting: <b> (bold), <i> (italic), <u> (underline), <s> (strikethrough).
    2. You MUST preserve these tags and wrap the corresponding translated words with them.
    3. Example: "The <b>red</b> apple" -> "Quả táo <b>màu đỏ</b>" (Vietnamese).
    4. If a string represents a number, formula, or code, keep it identical.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: [
        { role: 'user', parts: [{ text: prompt }, { text: JSON.stringify(texts) }] }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            translations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    const jsonStr = response.text;
    if (!jsonStr) return texts;

    const parsed = JSON.parse(jsonStr);
    const translations = parsed.translations;

    if (Array.isArray(translations) && translations.length === texts.length) {
      return translations;
    } else {
      console.warn("Mismatch in translation length, falling back to original.");
      return texts;
    }
  } catch (error) {
    console.error("Batch translation error:", error);
    return texts; // Fallback to original on error
  }
};