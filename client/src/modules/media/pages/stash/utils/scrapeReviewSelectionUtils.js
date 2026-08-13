export const buildSelectedPerformersForApply = ({ reviewEntries = [], matchedPerformers = [], scrapedPerformers = [], performerSelections = {} }) => {
  const scrapedByOriginalName = new Map(
    scrapedPerformers.map((entry) => [String(entry?.name || '').trim().toLowerCase(), entry])
  );

  const normalize = (value) => String(value || '').trim().toLowerCase();

  // Flatten direct matches + alternatives so explicit dropdown selections can
  // resolve to the selected performer's ID rather than always falling back to
  // the original matched performer.
  const matchedCandidates = matchedPerformers.flatMap((entry) => {
    const direct = [{
      id: entry?.id || null,
      name: entry?.name || '',
      originalName: entry?.originalName || null,
      actionCode: entry?.actionCode || null
    }];

    const alternatives = Array.isArray(entry?.alternatives)
      ? entry.alternatives.map((alternative) => ({
          id: alternative?.id || null,
          name: alternative?.name || '',
          originalName: entry?.originalName || null,
          actionCode: alternative?.actionCode || entry?.actionCode || null
        }))
      : [];

    return [...direct, ...alternatives];
  });

  // Build base from ALL scraped performers (matched + unmatched) so __ADD_NEW__ selections
  // for unmatched performers are preserved when reviewEntries aren't available.
  const base = Array.isArray(reviewEntries) && reviewEntries.length > 0
    ? reviewEntries
    : (() => {
        const seen = new Set();
        const result = [];
        for (const entry of [...matchedPerformers, ...scrapedPerformers]) {
          const rawName = String(entry?.originalName || entry?.name || '').trim();
          if (!rawName || seen.has(rawName.toLowerCase())) continue;
          seen.add(rawName.toLowerCase());
          result.push({
            key: rawName.toLowerCase(),
            name: rawName,
            originalName: rawName,
            actionCode: entry.actionCode || null,
            defaultSelection: entry.name || rawName,
            options: [entry.name || rawName].filter(Boolean)
          });
        }
        return result;
      })();

  return base.filter((entry) => entry?.name || entry?.originalName).map((entry) => {
    const entryName = String(entry.originalName || entry.name || '').trim();
    const entryKeyLower = entryName.toLowerCase();

    // Compound keys ("sourceKey:performerKey") come from the multi-source column view;
    // the useEffect also seeds simple-key defaults — prefer __ADD_NEW__ from any source,
    // then compound keys, then the simple key, so a user's explicit choice always wins.
    const compoundCandidates = Object.entries(performerSelections || {})
      .filter(([k]) => k.endsWith(':' + entry.key) || k.endsWith(':' + entryKeyLower))
      .map(([, v]) => v)
      .filter(Boolean);

    const simpleCandidates = [
      performerSelections?.[entry.key],
      performerSelections?.[entryKeyLower]
    ].filter(Boolean);

    const allCandidates = [...compoundCandidates, ...simpleCandidates];

    const selectionValue = allCandidates.find((v) => v === '__ADD_NEW__')
      || compoundCandidates.find((v) => v && v !== (entry.defaultSelection || entry.options?.[0]))
      || simpleCandidates[0]
      || entry.defaultSelection || entry.options?.[0] || '';
    const selectedName = selectionValue && selectionValue !== '__ADD_NEW__' ? selectionValue : entryName;

    const defaultSelection = entry.defaultSelection || entry.options?.[0] || '';
    const isExplicitOverride = Boolean(selectionValue && selectionValue !== '__ADD_NEW__' && selectionValue !== defaultSelection);

    const matchedBySelectedName = matchedCandidates.find((candidate) =>
      normalize(candidate?.name) === normalize(selectedName)
    );

    const fallbackMatchedPerformer = isExplicitOverride
      ? null
      : matchedPerformers.find((candidate) =>
          normalize(candidate?.name) === normalize(entryName) ||
          normalize(candidate?.originalName) === normalize(entryName)
        );

    const matchedPerformer = matchedBySelectedName || fallbackMatchedPerformer;

    const scrapedPerformer = scrapedByOriginalName.get(entryName.toLowerCase())
      || scrapedPerformers.find((candidate) =>
          String(candidate?.name || '').trim().toLowerCase() === entryName.toLowerCase()
        );

    return {
      id: matchedPerformer?.id || null,
      name: matchedPerformer?.name || selectedName || entryName,
      originalName: matchedPerformer?.originalName || entryName,
      actionCode: matchedPerformer?.actionCode || scrapedPerformer?.actionCode || entry.actionCode || null,
      selectionValue
    };
  });
};
