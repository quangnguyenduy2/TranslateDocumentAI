
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
  glossary: GlossaryItem[] = []
): Promise<string> => {
  if (!text.trim()) return '';
  const relevantGlossary = filterRelevantGlossary(text, glossary);
  const prompt = `${buildSystemInstruction(targetLang, context, relevantGlossary)}\n\nTranslate this:\n${text}`;
  const response = await ai.models.generateContent({ model: MODEL_FAST, contents: prompt });
  return response.text?.replace(/^```markdown\s*|```$/g, '') || text;
};

export const translateBatchStrings = async (
  texts: string[],
  targetLang: SupportedLanguage,
  context: string = '',
  glossary: GlossaryItem[] = []
): Promise<string[]> => {
  if (texts.length === 0) return [];
  const relevantGlossary = filterRelevantGlossary(texts.join(' '), glossary);
  const prompt = `${buildSystemInstruction(targetLang, context, relevantGlossary)}\n\nTranslate this JSON array of strings. Maintain order.`;
  
  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: { parts: [{ text: prompt }, { text: JSON.stringify(texts) }] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: { translations: { type: Type.ARRAY, items: { type: Type.STRING } } }
        }
      }
    });
    return JSON.parse(response.text || '{}').translations || texts;
  } catch { return texts; }
};
