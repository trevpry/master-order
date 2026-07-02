const normalizeDetailsQuotes = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.replaceAll('"', "'");
};

const normalizeSuggestionDetails = (suggestion) => {
  if (!suggestion || typeof suggestion !== 'object') {
    return suggestion;
  }

  const normalizedSuggestion = {
    ...suggestion,
    details: normalizeDetailsQuotes(suggestion.details)
  };

  if (suggestion.newEventSuggestion && typeof suggestion.newEventSuggestion === 'object') {
    normalizedSuggestion.newEventSuggestion = {
      ...suggestion.newEventSuggestion,
      details: normalizeDetailsQuotes(suggestion.newEventSuggestion.details)
    };
  }

  return normalizedSuggestion;
};

export const normalizeHistoryPlusAiImportData = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const normalizedPayload = { ...payload };

  if (Array.isArray(payload.suggestions)) {
    normalizedPayload.suggestions = payload.suggestions.map(normalizeSuggestionDetails);
  }

  if (payload.suggestion && typeof payload.suggestion === 'object') {
    normalizedPayload.suggestion = normalizeSuggestionDetails(payload.suggestion);
  }

  return normalizedPayload;
};

const repairUnescapedQuotesForKeys = (rawText, keys = []) => {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    return rawText;
  }

  let text = rawText;

  const getNextNonWhitespaceChar = (value, index) => {
    let i = index;
    while (i < value.length && /\s/.test(value[i])) {
      i += 1;
    }
    return i < value.length ? value[i] : null;
  };

  for (const key of keys) {
    const keyPattern = new RegExp(`\\"${key}\\"\\s*:\\s*\\"`, 'g');
    let match;

    while ((match = keyPattern.exec(text)) !== null) {
      const valueStart = match.index + match[0].length;
      let i = valueStart;

      while (i < text.length) {
        const ch = text[i];

        if (ch === '\\') {
          i += 2;
          continue;
        }

        if (ch === '"') {
          const nextChar = getNextNonWhitespaceChar(text, i + 1);
          const isTerminator = nextChar === ',' || nextChar === '}' || nextChar === ']';

          if (isTerminator) {
            break;
          }

          // Unescaped quote inside string content; normalize to single quote.
          text = `${text.slice(0, i)}'${text.slice(i + 1)}`;
          keyPattern.lastIndex = i + 1;
          i += 1;
          continue;
        }

        i += 1;
      }
    }
  }

  return text;
};

export const parseHistoryPlusAiImportJson = (rawText) => {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    throw new Error('Please enter valid JSON data');
  }

  try {
    return JSON.parse(rawText);
  } catch (initialParseError) {
    const repaired = repairUnescapedQuotesForKeys(rawText, ['details', 'description']);
    return JSON.parse(repaired);
  }
};
