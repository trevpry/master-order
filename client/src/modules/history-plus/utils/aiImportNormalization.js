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
