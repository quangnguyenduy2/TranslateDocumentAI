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
  let instruction = `You are a professional technical translator. Translate the content to ${targetLang}.`;

  if (context && context.trim()) {
    instruction += `\n\nCONTEXT:\n${context}`;
  }

  if (relevantGlossary && relevantGlossary.length > 0) {
    instruction += `\n\nGLOSSARY (Strictly enforce these translations):\n`;
    relevantGlossary.forEach(item => {
      instruction += `- ${item.term} -> ${item.translation}\n`;
    });
  }

  return instruction;
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