/**
 * Text Protector Module - Masking & Unmasking Sensitive Data
 * 
 * Strategy:
 * 1. maskText: Replace blacklist terms with __PROTECTED_N__ placeholders before translation
 * 2. unmaskText: Restore original terms after translation
 * 
 * Features:
 * - Longest Match First algorithm (prevent "Project" from masking before "Project X")
 * - Case-sensitive & case-insensitive modes
 * - Special character escaping for regex safety
 * - JSON/XML-safe placeholder format
 */

export interface BlacklistItem {
  id: string;
  term: string;
  caseSensitive?: boolean;
  enabled?: boolean;
}

export interface ProtectionMap {
  [placeholder: string]: string;
}

export interface MaskResult {
  maskedText: string;
  protectionMap: ProtectionMap;
  maskedCount: number;
}

const escapeRegExp = (text: string): string => {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const maskText = (
  originalText: string,
  blacklistItems: BlacklistItem[]
): MaskResult => {
  if (!originalText || !blacklistItems || blacklistItems.length === 0) {
    return { maskedText: originalText, protectionMap: {}, maskedCount: 0 };
  }

  const enabledItems = blacklistItems
    .filter(item => item.enabled !== false && item.term.trim().length > 0)
    .sort((a, b) => b.term.length - a.term.length);

  if (enabledItems.length === 0) {
    return { maskedText: originalText, protectionMap: {}, maskedCount: 0 };
  }

  let maskedText = originalText;
  const protectionMap: ProtectionMap = {};
  let placeholderIndex = 0;
  const maskedPositions = new Set<number>();

  for (const item of enabledItems) {
    const escapedTerm = escapeRegExp(item.term);
    const flags = item.caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(escapedTerm, flags);

    const matches: Array<{ match: string; index: number }> = [];
    let match;
    while ((match = regex.exec(maskedText)) !== null) {
      const startPos = match.index;
      const endPos = match.index + match[0].length;
      let isOverlapping = false;

      for (let i = startPos; i < endPos; i++) {
        if (maskedPositions.has(i)) {
          isOverlapping = true;
          break;
        }
      }

      if (!isOverlapping) {
        matches.push({ match: match[0], index: match.index });
      }
    }

    matches.reverse().forEach(({ match, index }) => {
      const placeholder = `__PROTECTED_${placeholderIndex}__`;
      protectionMap[placeholder] = match;

      for (let i = index; i < index + match.length; i++) {
        maskedPositions.add(i);
      }

      maskedText = maskedText.substring(0, index) + placeholder + maskedText.substring(index + match.length);
      placeholderIndex++;
    });
  }

  return { maskedText, protectionMap, maskedCount: placeholderIndex };
};

export const unmaskText = (
  translatedText: string,
  protectionMap: ProtectionMap
): string => {
  if (!translatedText || !protectionMap || Object.keys(protectionMap).length === 0) {
    return translatedText;
  }

  let unmaskedText = translatedText;

  const placeholders = Object.keys(protectionMap).sort((a, b) => {
    const indexA = parseInt(a.match(/__PROTECTED_(\d+)__/)?.[1] || '0');
    const indexB = parseInt(b.match(/__PROTECTED_(\d+)__/)?.[1] || '0');
    return indexB - indexA;
  });

  for (const placeholder of placeholders) {
    const originalTerm = protectionMap[placeholder];
    const escapedPlaceholder = escapeRegExp(placeholder);
    unmaskedText = unmaskedText.replace(new RegExp(escapedPlaceholder, 'g'), originalTerm);
  }

  return unmaskedText;
};

export const maskBatchTexts = (
  originalTexts: string[],
  blacklistItems: BlacklistItem[]
): { maskedTexts: string[]; protectionMap: ProtectionMap } => {
  const globalProtectionMap: ProtectionMap = {};
  let globalPlaceholderIndex = 0;

  const maskedTexts = originalTexts.map(text => {
    const result = maskText(text, blacklistItems);
    
    let remappedText = result.maskedText;
    const localToGlobalMap: { [key: string]: string } = {};

    Object.keys(result.protectionMap).forEach(localPlaceholder => {
      const globalPlaceholder = `__PROTECTED_${globalPlaceholderIndex}__`;
      localToGlobalMap[localPlaceholder] = globalPlaceholder;
      globalProtectionMap[globalPlaceholder] = result.protectionMap[localPlaceholder];
      globalPlaceholderIndex++;
    });

    Object.keys(localToGlobalMap).forEach(localPh => {
      const globalPh = localToGlobalMap[localPh];
      remappedText = remappedText.replace(new RegExp(escapeRegExp(localPh), 'g'), globalPh);
    });

    return remappedText;
  });

  return { maskedTexts, protectionMap: globalProtectionMap };
};

export const unmaskBatchTexts = (
  translatedTexts: string[],
  protectionMap: ProtectionMap
): string[] => {
  return translatedTexts.map(text => unmaskText(text, protectionMap));
};

export const validateBlacklistTerm = (term: string): { valid: boolean; error?: string } => {
  if (!term || term.trim().length === 0) {
    return { valid: false, error: 'Term cannot be empty' };
  }

  if (term.length > 500) {
    return { valid: false, error: 'Term is too long (max 500 characters)' };
  }

  if (term.includes('__PROTECTED_') || term.includes('__P')) {
    return { valid: false, error: 'Term cannot contain placeholder patterns' };
  }

  return { valid: true };
};
