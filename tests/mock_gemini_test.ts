import { translateText, translateBatchStrings, setAIClientForTest } from '../services/geminiService.ts';
import { SupportedLanguage } from '../types.ts';

// Minimal mock AI client matching used interface: getAI().models.generateContent
const mockAI = {
  models: {
    generateContent: async (opts: any) => {
      const text = (() => {
        if (typeof opts === 'string') return opts;
        if (opts?.contents) {
          if (typeof opts.contents === 'string') return opts.contents;
          // For batch: parts contain prompt + JSON array string
          if (opts.contents.parts && Array.isArray(opts.contents.parts)) {
            // Return a simple translation: append " [TR]" to each string in JSON
            const jsonPart = opts.contents.parts.find((p: any) => typeof p.text === 'string' && p.text.trim().startsWith('['));
            const candidate = opts.contents.parts.find((p: any) => typeof p.text === 'string' && !p.text.trim().startsWith('['));
            // If there's a following JSON part, simulate translation
            return 'SIMULATED_RESPONSE';
          }
        }
        if (opts?.parts && Array.isArray(opts.parts)) {
          // treat as generateContent({ model, contents: { parts: [...] }}) pattern from image/text
          return opts.parts.map((p: any) => p.text || '').join('\n');
        }
        return '';
      })();

      // If called in batch mode with responseSchema, return translations json
      if (opts?.config?.responseSchema) {
        // try parse the JSON array from second part
        try {
          const raw = opts.contents?.parts?.[1]?.text || opts.contents?.[1]?.text || '';
          const arr = JSON.parse(raw || '[]');
          const translations = arr.map((s: string) => normalizeForTest(s));
          return { text: JSON.stringify({ translations }) };
        } catch (e) {
          return { text: JSON.stringify({ translations: [] }) };
        }
      }

      // Default simple wrapper
      return { text: `\n${normalizeForTest(text)}\n` };
    }
  }
};

function normalizeForTest(s: string) {
  // Simulate model returning escaped newlines for inputs containing actual newlines
  if (!s) return '';
  return s.replace(/\\n/g, '\\n').replace(/\n/g, '\\n') + ' [MOCK_TR]';
}

// We need to import normalize helper from geminiService? to avoid circular, re-implement small normalizer

// Inject mock
setAIClientForTest(mockAI as any);

(async () => {
  console.log('--- Running mock translateText test ---');
  const single = await translateText('Line1\nLine2', SupportedLanguage.VIETNAMESE, 'ctx', [] as any[]);
  console.log('translateText result:', single);

  console.log('\n--- Running mock translateBatchStrings test ---');
  const arr = ['Cell1\nCell2', 'NoNewline here'];
  const batch = await translateBatchStrings(arr, SupportedLanguage.VIETNAMESE, 'ctx', [] as any[]);
  console.log('translateBatchStrings result:', batch);
})();
