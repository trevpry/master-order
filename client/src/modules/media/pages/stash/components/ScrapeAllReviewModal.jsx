import React, { useEffect, useState } from 'react';
import { getSceneDisplayTitle, getSceneImageUrl } from '../../../utils/stashUtils';

export default function ScrapeAllReviewModal({
  isOpen,
  onClose,
  sceneData,
  scrapeData,
  selectedMultiSourceResults,
  onToggleSelection,
  onReviewResult,
  onShowSelectionView,
  onShowListView,
  onShowSelectedDetails,
  onAccept,
  onApply,
  performerSelections,
  onPerformerSelectionChange,
  groupSelections,
  onGroupSelectionChange,
  fieldSelections,
  onFieldSelectionChange,
  onCreateTag,
  onCreateGroup
}) {
  if (!isOpen || !scrapeData) {
    return null;
  }

  const isMultiSourceReview = Array.isArray(scrapeData?.multiSourceResults) && scrapeData.multiSourceResults.length > 0;
  const hasExistingLocalPerformers = Array.isArray(sceneData?.performers) && sceneData.performers.some((entry) => {
    const performer = entry?.performer || entry;
    return Boolean(performer?.name || entry?.name);
  });
  const shouldUseApplyAndNext = !hasExistingLocalPerformers && isMultiSourceReview;
  const [localPerformerSelections, setLocalPerformerSelections] = useState({});
  const [selectedTagSourceKeys, setSelectedTagSourceKeys] = useState([]);
  const [newTagName, setNewTagName] = useState('');

  const resolveDisplayName = (value) => {
    if (!value) return '';

    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);

    if (typeof value === 'object') {
      if (typeof value.name === 'string' && value.name.trim()) return value.name;
      if (typeof value.title === 'string' && value.title.trim()) return value.title;
      if (typeof value.tag?.name === 'string' && value.tag.name.trim()) return value.tag.name;
      if (typeof value.group?.name === 'string' && value.group.name.trim()) return value.group.name;
      if (typeof value.performer?.name === 'string' && value.performer.name.trim()) return value.performer.name;
      if (typeof value.value === 'string' && value.value.trim()) return value.value;
    }

    return '';
  };

  const normalizePerformers = (value) => {
    if (!value) return [];

    if (Array.isArray(value)) {
      return value
        .map((entry) => resolveDisplayName(entry))
        .filter(Boolean);
    }

    if (typeof value === 'string') {
      return value
        .split(/\s*(?:,|&|\/|\band\b|\bwith\b|\s*\|\s*)\s*/i)
        .map((entry) => entry.trim())
        .filter(Boolean);
    }

    if (typeof value === 'object') {
      const singleName = resolveDisplayName(value);
      return singleName ? [singleName] : [];
    }

    return [];
  };

  const normalizeTagValues = (value) => {
    if (!value) return [];

    if (Array.isArray(value)) {
      return value
        .map((entry) => resolveDisplayName(entry))
        .filter(Boolean);
    }

    if (typeof value === 'string') {
      return value
        .split(/\s*(?:,|&|\/|\band\b|\bwith\b|\s*\|\s*)\s*/i)
        .map((entry) => entry.trim())
        .filter(Boolean);
    }

    if (typeof value === 'object') {
      const singleName = resolveDisplayName(value);
      return singleName ? [singleName] : [];
    }

    return [];
  };

  const normalizeTagMatchValue = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const collectTagTextValues = (value) => {
    if (!value) return [];

    const values = [];
    const addCandidate = (candidate) => {
      if (!candidate) return;
      if (Array.isArray(candidate)) {
        candidate.forEach(addCandidate);
        return;
      }
      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        if (trimmed) values.push(trimmed);
        return;
      }
      if (typeof candidate === 'object') {
        if (typeof candidate.name === 'string' && candidate.name.trim()) values.push(candidate.name.trim());
        if (typeof candidate.title === 'string' && candidate.title.trim()) values.push(candidate.title.trim());
        if (typeof candidate.value === 'string' && candidate.value.trim()) values.push(candidate.value.trim());

        const aliasValue = candidate.alias;
        if (typeof aliasValue === 'string' && aliasValue.trim()) values.push(aliasValue.trim());
        if (Array.isArray(aliasValue)) {
          aliasValue.forEach(addCandidate);
        }
        if (aliasValue && typeof aliasValue === 'object') {
          addCandidate(aliasValue);
        }

        const aliasesValue = candidate.aliases;
        if (typeof aliasesValue === 'string' && aliasesValue.trim()) {
          aliasesValue.split(',').map((part) => part.trim()).filter(Boolean).forEach((part) => values.push(part));
        }
        if (Array.isArray(aliasesValue)) {
          aliasesValue.forEach(addCandidate);
        }
        if (aliasesValue && typeof aliasesValue === 'object') {
          addCandidate(aliasesValue);
        }

        if (Array.isArray(candidate.tags)) {
          candidate.tags.forEach(addCandidate);
        }
        if (candidate.tag) {
          addCandidate(candidate.tag);
        }
        if (candidate.parentTag) {
          addCandidate(candidate.parentTag);
        }
      }
    };

    addCandidate(value);

    return Array.from(new Set(values.filter(Boolean)));
  };

  const collectTagMatchCandidates = (value) => collectTagTextValues(value);

  const normalizeTagEntry = (value) => {
    if (!value) return null;

    if (typeof value === 'string') {
      return { name: value.trim(), aliases: [] };
    }

    if (typeof value === 'object') {
      const name = resolveDisplayName(value);
      const normalizedName = normalizeTagMatchValue(name);
      const aliases = collectTagTextValues(value)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .filter((entry) => normalizeTagMatchValue(entry) !== normalizedName);

      return {
        name: name || value?.tag?.name || value?.name || '',
        aliases: Array.from(new Set(aliases))
      };
    }

    return null;
  };

  const collectTagEntries = (value, sourceKey = '', sourceLabel = '', existingTagValues = []) => {
    if (!value) return [];

    const existingTagCandidates = (Array.isArray(existingTagValues) ? existingTagValues : [existingTagValues])
      .flatMap((entry) => collectTagMatchCandidates(entry))
      .map((entry) => normalizeTagMatchValue(entry))
      .filter(Boolean);

    const normalizedExistingNames = new Set(existingTagCandidates);

    const rawValues = Array.isArray(value) ? value : [value];
    return rawValues
      .map((entry) => normalizeTagEntry(entry))
      .filter((entry) => entry?.name)
      .map((entry) => {
        const candidateValues = Array.from(new Set([entry.name, ...(entry.aliases || []), ...collectTagTextValues(entry)].filter(Boolean)));
        const normalizedCandidates = candidateValues.map((candidate) => normalizeTagMatchValue(candidate));
        const matched = normalizedCandidates.some((candidate) => normalizedExistingNames.has(candidate));

        if (!matched && entry?.name) {
          console.log('🏷️ [REVIEW TAG MATCH] No existing-tag match for:', entry.name, 'aliases:', entry.aliases, 'existing:', Array.from(normalizedExistingNames).slice(0, 20));
        }

        return {
          ...entry,
          matched,
          sourceKey,
          sourceLabel
        };
      });
  };

  const getSceneBreakdownEntries = (result) => {
    if (Array.isArray(result?.scenes) && result.scenes.length > 0) return result.scenes;
    if (Array.isArray(result?.sceneBreakdown) && result.sceneBreakdown.length > 0) return result.sceneBreakdown;
    if (Array.isArray(result?.scraped?.scenes) && result.scraped.scenes.length > 0) return result.scraped.scenes;
    return [];
  };

  const renderPerformers = (performers) => {
    const normalized = normalizePerformers(performers);
    if (normalized.length === 0) return null;

    return (
      <div style={{ fontSize: '12px', color: '#4b5563', lineHeight: 1.4 }}>
        {normalized.map((performerName, performerIndex) => (
          <div key={`${performerName}-${performerIndex}`}>{performerName}</div>
        ))}
      </div>
    );
  };

  const parseActionCodeToTags = (actionCode) => {
    if (!actionCode) return [];

    const tags = [];
    const code = String(actionCode).toUpperCase();

    if (code.includes('OGR')) {
      tags.push('Oral - Give', 'Oral - Receive');
    } else if (code.includes('OG')) {
      tags.push('Oral - Give');
    } else if (code.includes('OR')) {
      tags.push('Oral - Receive');
    }

    if (code.includes('ATB')) {
      tags.push('Top', 'Bottom');
    } else if (code.includes('AT')) {
      tags.push('Top');
    } else if (code.includes('AB')) {
      tags.push('Bottom');
    }

    if (code.includes('RGR')) {
      tags.push('Rim - Give', 'Rim - Receive');
    } else if (code.includes('RG')) {
      tags.push('Rim - Give');
    } else if (code.includes('RR')) {
      tags.push('Rim - Receive');
    }

    return tags;
  };

  const buildPerformerReviewEntries = (performerItems = []) => {
    const entries = [];

    const normalizePerformerValue = (value) => {
      return String(value || '')
        .toLowerCase()
        .replace(/[:\-_]/g, ' ')
        .replace(/[()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const collectAliasValues = (entry) => {
      const values = [];

      if (typeof entry === 'string') {
        values.push(entry);
        return values;
      }

      if (entry?.alias) {
        if (Array.isArray(entry.alias)) {
          values.push(...entry.alias);
        } else if (typeof entry.alias === 'string') {
          values.push(...entry.alias.split(',').map((part) => part.trim()).filter(Boolean));
        }
      }

      if (entry?.aliases) {
        if (Array.isArray(entry.aliases)) {
          values.push(...entry.aliases);
        } else if (typeof entry.aliases === 'string') {
          values.push(...entry.aliases.split(',').map((part) => part.trim()).filter(Boolean));
        }
      }

      if (entry?.matchedAlias) {
        values.push(entry.matchedAlias);
      }

      if (entry?.matched?.matchedAlias) {
        values.push(entry.matched.matchedAlias);
      }

      const matchedEntry = entry?.matched;
      if (matchedEntry?.alternatives && Array.isArray(matchedEntry.alternatives)) {
        matchedEntry.alternatives.forEach((alternative) => {
          if (alternative?.name) values.push(alternative.name);
        });
      }

      return values.map((value) => String(value).trim()).filter(Boolean);
    };

    const findMatchingEntry = (candidateName, candidateAliases) => {
      const candidateKeys = [candidateName, ...candidateAliases]
        .map((value) => normalizePerformerValue(value))
        .filter(Boolean);

      return entries.find((entry) => {
        const existingNames = [entry.name, ...(entry.aliases || [])]
          .map((value) => normalizePerformerValue(value))
          .filter(Boolean);

        return candidateKeys.some((candidateKey) => existingNames.includes(candidateKey));
      });
    };

    const addEntry = (entry, fallbackName, sourceType) => {
      const rawName = typeof entry === 'string' ? entry : (entry?.name || entry?.performer?.name || fallbackName || '');
      const name = String(rawName || '').trim();
      if (!name) return;

      const aliases = collectAliasValues(entry);
      // Only treat entry.matched as a real match object; never fall back to entry itself.
      const matchedEntry = typeof entry === 'object' && entry?.matched && typeof entry.matched === 'object'
        ? entry.matched
        : null;
      const alternatives = [];
      if (matchedEntry?.alternatives && Array.isArray(matchedEntry.alternatives)) {
        matchedEntry.alternatives.forEach((alternative) => {
          if (alternative?.name) alternatives.push(alternative.name);
        });
      }

      const actionCode = typeof entry === 'object' && entry?.actionCode
        ? entry.actionCode
        : null;

      const matchedVia = matchedEntry?.matchedVia || entry?.matchedVia || entry?.matched?.matchedVia || null;
      const matchedAlias = matchedEntry?.matchedAlias || entry?.matchedAlias || entry?.matched?.matchedAlias || null;
      const matchedName = matchedEntry?.name || entry?.matched?.name || entry?.name || null;
      const matchLabel = matchedVia === 'alias' && matchedAlias
        ? `via alias: ${matchedAlias}`
        : (matchedAlias && (matchedVia === 'alias' || entry?.matchedVia === 'alias' || entry?.matched?.matchedVia === 'alias')
          ? `via alias: ${matchedAlias}`
          : null);

      const existingEntry = findMatchingEntry(name, aliases);
      if (existingEntry) {
        existingEntry.aliases = Array.from(new Set([...(existingEntry.aliases || []), ...aliases.filter((alias) => alias.toLowerCase() !== name.toLowerCase())]));
        existingEntry.options = Array.from(new Set([existingEntry.name, matchedName, ...alternatives].filter(Boolean)));
        existingEntry.actionCode = existingEntry.actionCode || actionCode;
        existingEntry.matched = existingEntry.matched || (sourceType === 'matched' || Boolean(matchedEntry));
        existingEntry.matchLabel = existingEntry.matchLabel || matchLabel;
        existingEntry.matchedVia = existingEntry.matchedVia || matchedVia;
        existingEntry.matchedAlias = existingEntry.matchedAlias || matchedAlias;
        existingEntry.defaultSelection = existingEntry.defaultSelection || matchedName || existingEntry.name;
        return;
      }

      entries.push({
        key: name.toLowerCase(),
        name,
        aliases: Array.from(new Set(aliases.filter((alias) => alias.toLowerCase() !== name.toLowerCase()))),
        sourceType,
        actionCode,
        options: Array.from(new Set([name, matchedName, ...alternatives].filter(Boolean))),
        matched: sourceType === 'matched' || Boolean(matchedEntry),
        matchLabel,
        matchedVia,
        matchedAlias,
        defaultSelection: matchedName || name
      });
    };

    performerItems.forEach(({ entry, sourceType }) => addEntry(entry, typeof entry === 'string' ? entry : (entry?.name || entry?.originalName || entry?.performer?.name || ''), sourceType));
    return entries;
  };

  const getPerformerReviewEntries = () => {
    if (isMultiSourceReview && Array.isArray(scrapeData?.selectedResults) && scrapeData.selectedResults.length > 0) {
      const performerItems = scrapeData.selectedResults.flatMap((selection) => [
        ...(selection?.matched?.performers || []).map((entry) => ({ entry, sourceType: 'matched' })),
        ...(selection?.unmatched?.performers || []).map((entry) => ({ entry, sourceType: 'unmatched' })),
        ...(selection?.scraped?.performers || []).map((entry) => ({ entry, sourceType: 'scraped' }))
      ]);

      return buildPerformerReviewEntries(performerItems);
    }

    const matchedPerformers = scrapeData?.matched?.performers || [];
    const unmatchedPerformers = scrapeData?.unmatched?.performers || [];
    const scrapedPerformers = scrapeData?.scraped?.performers || [];

    return buildPerformerReviewEntries([
      ...matchedPerformers.map((entry) => ({ entry, sourceType: 'matched' })),
      ...unmatchedPerformers.map((entry) => ({ entry, sourceType: 'unmatched' })),
      ...scrapedPerformers.map((entry) => ({ entry, sourceType: 'scraped' }))
    ]);
  };

  useEffect(() => {
    const entries = getPerformerReviewEntries();
    const nextSelectionState = {};

    entries.forEach((entry) => {
      const previousSelection = performerSelections?.[entry.key];
      const hasValidPreviousSelection = Boolean(previousSelection && entry.options.includes(previousSelection));
      nextSelectionState[entry.key] = hasValidPreviousSelection
        ? previousSelection
        : entry.defaultSelection || entry.options[0] || entry.name;
    });

    setLocalPerformerSelections(nextSelectionState);
    onPerformerSelectionChange?.(nextSelectionState);
  }, [scrapeData?.matched?.performers, scrapeData?.unmatched?.performers, scrapeData?.scraped?.performers, scrapeData?.selectedResults]);

  useEffect(() => {
    if (Array.isArray(fieldSelections?.tags)) {
      setSelectedTagSourceKeys(fieldSelections.tags);
    } else if (typeof fieldSelections?.tags === 'string') {
      setSelectedTagSourceKeys(fieldSelections.tags === 'existing' ? ['existing'] : ['scraped']);
    } else {
      setSelectedTagSourceKeys([]);
    }
  }, [fieldSelections?.tags]);

  const getGroupReviewEntries = () => {
    const addGroups = (groups, sourceType) => {
      if (!Array.isArray(groups)) return [];

      return groups
        .map((group) => {
          const name = resolveDisplayName(group);
          if (!name) return null;

          return {
            id: group?.id || null,
            name,
            url: group?.url || group?.sourceUrl || group?.urls?.[0] || null,
            sourceType,
            matched: sourceType === 'matched'
          };
        })
        .filter(Boolean);
    };

    const collectGroupCandidates = (value) => {
      if (!value) return [];

      if (Array.isArray(value?.groups)) return value.groups;
      if (Array.isArray(value?.movies)) return value.movies;
      return [];
    };

    if (isMultiSourceReview && Array.isArray(scrapeData?.selectedResults) && scrapeData.selectedResults.length > 0) {
      return scrapeData.selectedResults.flatMap((selection) => {
        // Prefer processed matched groups; fall back to raw result groups if processing dropped them
        const matchedGroupCandidates =
          collectGroupCandidates(selection?.matched).length > 0
            ? collectGroupCandidates(selection?.matched)
            : collectGroupCandidates(selection?.result?.matched);
        const unmatchedGroupCandidates =
          collectGroupCandidates(selection?.unmatched).length > 0
            ? collectGroupCandidates(selection?.unmatched)
            : collectGroupCandidates(selection?.result?.unmatched);
        const fromMatched = addGroups(matchedGroupCandidates, 'matched');
        const fromUnmatched = addGroups(unmatchedGroupCandidates, 'unmatched');
        // Only fall back to scraped.movies when there is no explicit matched/unmatched group data
        const fromScraped = (fromMatched.length > 0 || fromUnmatched.length > 0)
          ? []
          : addGroups(collectGroupCandidates(selection?.scraped), 'scraped');
        return [...fromMatched, ...fromUnmatched, ...fromScraped];
      });
    }

    const fromMatched = addGroups(collectGroupCandidates(scrapeData?.matched), 'matched');
    const fromUnmatched = addGroups(collectGroupCandidates(scrapeData?.unmatched), 'unmatched');
    const fromScraped = (fromMatched.length > 0 || fromUnmatched.length > 0)
      ? []
      : addGroups(collectGroupCandidates(scrapeData?.scraped), 'scraped');
    return [...fromMatched, ...fromUnmatched, ...fromScraped];
  };

  const normalizeGroupName = (value) => String(resolveDisplayName(value) || '').trim().toLowerCase();

  const getGroupDisplayEntries = (groups, existingGroups = []) => {
    const existingGroupNames = new Set(
      (Array.isArray(existingGroups) ? existingGroups : [])
        .map((entry) => normalizeGroupName(entry))
        .filter(Boolean)
    );

    if (!Array.isArray(groups)) return [];

    return groups
      .map((group) => {
        const name = resolveDisplayName(group);
        if (!name) return null;

        const normalizedName = normalizeGroupName(group);
        return {
          id: group?.id || null,
          originalName: group?.originalName || null,
          matchedVia: group?.matchedVia || null,
          studio: group?.studio || null,
          date: group?.date || null,
          frontImage: group?.frontImage || null,
          backImage: group?.backImage || null,
          alternatives: Array.isArray(group?.alternatives) ? group.alternatives : [],
          name,
          url: group?.url || group?.sourceUrl || group?.urls?.[0] || null,
          // honour a pre-computed matched flag when present (e.g. from DB-matched group data)
          matched: group?.matched !== undefined
            ? Boolean(group.matched)
            : Boolean(normalizedName && existingGroupNames.has(normalizedName))
        };
      })
      .filter(Boolean);
  };

  const renderChoiceCard = (isSelected, onSelect, title, content, accent = '#f9fafb') => (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      style={{
        flex: '1 1 220px',
        padding: '0.8rem',
        borderRadius: '8px',
        border: isSelected ? '2px solid #10b981' : '1px solid #d1d5db',
        background: isSelected ? '#dcfce7' : accent,
        cursor: 'pointer',
        minWidth: 0,
        boxShadow: isSelected ? '0 4px 12px rgba(16, 185, 129, 0.15)' : 'none'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280' }}>{title}</span>
        {isSelected && <span style={{ color: '#10b981', fontSize: '18px' }}>✓</span>}
      </div>
      {content}
    </div>
  );

  const getSelectionFieldValue = (selection, field) => {
    const candidate = selection?.scraped || selection?.result || selection || {};

    if (field === 'image') {
      return candidate.image || candidate.originalImage || candidate.displayImage || null;
    }

    if (field === 'tags') {
      return normalizeTagValues(candidate.tags || []);
    }

    if (field === 'title') {
      return candidate.title || candidate.name || '';
    }

    if (field === 'studio') {
      return typeof candidate.studio === 'string'
        ? candidate.studio
        : candidate.studio?.name || candidate.studio?.title || '';
    }

    if (field === 'date') {
      return candidate.date || candidate.releaseDate || candidate.released || candidate.release_date || '';
    }

    if (field === 'details') {
      return candidate.details || candidate.synopsis || candidate.description || candidate.summary || '';
    }

    if (field === 'url') {
      return candidate.url || candidate.sourceUrl || candidate.urls?.[0] || '';
    }

    if (field === 'performers') {
      const performers = candidate.performers || candidate.cast || [];
      return Array.isArray(performers)
        ? performers.map((entry) => {
            if (typeof entry === 'string') return entry;
            if (entry?.name) return entry.name;
            if (entry?.performer?.name) return entry.performer.name;
            return '';
          }).filter(Boolean)
        : [];
    }

    if (field === 'groups') {
      // Prefer DB-classified groups which carry the correct matched/unmatched status
      const matchedGroups = Array.isArray(selection?.matched?.groups) && selection.matched.groups.length > 0
        ? selection.matched.groups
        : (Array.isArray(selection?.result?.matched?.groups) ? selection.result.matched.groups : []);
      const unmatchedGroups = Array.isArray(selection?.unmatched?.groups) && selection.unmatched.groups.length > 0
        ? selection.unmatched.groups
        : (Array.isArray(selection?.result?.unmatched?.groups) ? selection.result.unmatched.groups : []);

      if (matchedGroups.length > 0 || unmatchedGroups.length > 0) {
        return [
          ...matchedGroups.map((entry) => ({
            id: entry?.id || null,
            originalName: entry?.originalName || null,
            matchedVia: entry?.matchedVia || null,
            studio: entry?.studio || null,
            date: entry?.date || null,
            frontImage: entry?.frontImage || null,
            backImage: entry?.backImage || null,
            alternatives: Array.isArray(entry?.alternatives) ? entry.alternatives : [],
            name: resolveDisplayName(entry),
            url: entry?.url || entry?.sourceUrl || null,
            matched: true
          })).filter((g) => g.name),
          ...unmatchedGroups.map((entry) => ({
            id: entry?.id || null,
            originalName: entry?.originalName || null,
            matchedVia: entry?.matchedVia || null,
            studio: entry?.studio || null,
            date: entry?.date || null,
            frontImage: entry?.frontImage || null,
            backImage: entry?.backImage || null,
            alternatives: Array.isArray(entry?.alternatives) ? entry.alternatives : [],
            name: resolveDisplayName(entry),
            url: entry?.url || entry?.sourceUrl || null,
            matched: false
          })).filter((g) => g.name)
        ];
      }

      // Fallback: read from scraped data (no explicit match status)
      const groupCandidate = selection?.scraped || selection?.result || selection || {};
      const groups = Array.isArray(groupCandidate.groups)
        ? groupCandidate.groups
        : Array.isArray(groupCandidate.movies)
          ? groupCandidate.movies
          : [];
      return groups
        .map((entry) => {
          const name = resolveDisplayName(entry);
          if (!name) return null;
          return {
            id: entry?.id || null,
            originalName: entry?.originalName || null,
            matchedVia: entry?.matchedVia || null,
            studio: entry?.studio || null,
            date: entry?.date || null,
            frontImage: entry?.frontImage || null,
            backImage: entry?.backImage || null,
            alternatives: Array.isArray(entry?.alternatives) ? entry.alternatives : [],
            name,
            url: entry?.url || entry?.sourceUrl || entry?.urls?.[0] || null
          };
        })
        .filter(Boolean);
    }

    if (field === 'episodeUrls') {
      const episodeUrls = [];
      if (Array.isArray(candidate.episodeUrls)) episodeUrls.push(...candidate.episodeUrls);
      if (Array.isArray(candidate.urls)) episodeUrls.push(...candidate.urls);
      return episodeUrls.filter(Boolean);
    }

    return '';
  };

  const getPerformerReviewEntriesForSelection = (selection) => {
    const performerSources = [];
    const addPerformerSource = (value, sourceType) => {
      if (!value) return;

      if (Array.isArray(value)) {
        performerSources.push(...value.map((entry) => ({ entry, sourceType })));
        return;
      }

      if (Array.isArray(value?.performers)) {
        performerSources.push(...value.performers.map((entry) => ({ entry, sourceType })));
      }

      if (Array.isArray(value?.cast)) {
        performerSources.push(...value.cast.map((entry) => ({ entry, sourceType })));
      }
    };

    const candidateObjects = [selection, selection?.scraped, selection?.result, selection?.scraped?.scraped, selection?.scraped?.metadata, selection?.result?.scraped, selection?.result?.metadata];

    candidateObjects.forEach((candidate) => {
      if (!candidate) return;

      addPerformerSource(candidate?.matched?.performers, 'matched');
      addPerformerSource(candidate?.unmatched?.performers, 'unmatched');
      addPerformerSource(candidate?.scraped?.performers, 'scraped');
      addPerformerSource(candidate?.performers, 'scraped');
      addPerformerSource(candidate?.cast, 'scraped');
    });

    return buildPerformerReviewEntries(performerSources);
  };

  const toggleTagSourceSelection = (sourceKey) => {
    if (!sourceKey) return;

    const nextSelection = selectedTagSourceKeys.includes(sourceKey)
      ? selectedTagSourceKeys.filter((entry) => entry !== sourceKey)
      : [...selectedTagSourceKeys, sourceKey];

    setSelectedTagSourceKeys(nextSelection);
    onFieldSelectionChange?.('tags', nextSelection);
  };

  const createTagFromModal = async (tagNameOverride) => {
    const tagName = String(tagNameOverride || newTagName || '').trim();
    if (!tagName) return;

    if (typeof onCreateTag === 'function') {
      await onCreateTag(tagName);
    }

    const nextSelection = selectedTagSourceKeys.includes(tagName)
      ? selectedTagSourceKeys
      : [...selectedTagSourceKeys, tagName];

    setSelectedTagSourceKeys(nextSelection);
    onFieldSelectionChange?.('tags', nextSelection);
    if (!tagNameOverride) {
      setNewTagName('');
    }
  };

  const handleReviewAction = (result, sourceResult) => {
    const geviMovieUrl = result?.url || result?.sourceUrl || result?.urls?.[0] || '';
    const isGeviMovieSource = sourceResult?.endpoint === 'gevi-movie-search' || result?.source === 'GEVI' || geviMovieUrl.includes('gayeroticvideoindex.com');

    if (isGeviMovieSource && geviMovieUrl) {
      window.open(geviMovieUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (typeof onReviewResult === 'function') {
      onReviewResult(result);
    }
  };

  const renderTagSelectionSection = (column, tagEntries) => {
    const isSelected = selectedTagSourceKeys.includes(column.key);
    const matchedEntries = tagEntries.filter((entry) => entry.matched);
    const unmatchedEntries = tagEntries.filter((entry) => !entry.matched);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        <button
          type="button"
          onClick={() => toggleTagSourceSelection(column.key)}
          style={{
            alignSelf: 'flex-start',
            padding: '0.35rem 0.55rem',
            borderRadius: '999px',
            border: isSelected ? '1px solid #10b981' : '1px solid #d1d5db',
            background: isSelected ? '#dcfce7' : '#fff',
            color: isSelected ? '#166534' : '#374151',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 700
          }}
        >
          {isSelected ? '✓ Selected source' : 'Select source'}
        </button>

        {matchedEntries.length > 0 ? (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', marginBottom: '0.25rem' }}>Matched with existing</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {matchedEntries.map((tagEntry, index) => (
                <div key={`${column.key}-${tagEntry.name}-${index}`} style={{ fontSize: '12px', color: '#111827' }}>
                  {tagEntry.name}
                  {tagEntry.aliases?.length > 0 ? <span style={{ color: '#6b7280', marginLeft: '0.25rem' }}>({tagEntry.aliases.join(' • ')})</span> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {unmatchedEntries.length > 0 ? (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', marginBottom: '0.25rem' }}>New / unmatched</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {unmatchedEntries.map((tagEntry, index) => (
                <div key={`${column.key}-${tagEntry.name}-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                  <div style={{ fontSize: '12px', color: '#111827' }}>
                    {tagEntry.name}
                    {tagEntry.aliases?.length > 0 ? <span style={{ color: '#6b7280', marginLeft: '0.25rem' }}>({tagEntry.aliases.join(' • ')})</span> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => createTagFromModal(tagEntry.name)}
                    title={`Create tag "${tagEntry.name}"`}
                    style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: '999px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#2563eb', fontSize: '14px', fontWeight: 700 }}
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {tagEntries.length === 0 ? <div style={{ fontSize: '13px', color: '#6b7280' }}>No tags</div> : null}
      </div>
    );
  };

  const renderTagFieldComparison = () => {
    const referenceTagValues = [
      ...(sceneData?.tags || []),
      ...(scrapeData?.matched?.tags || []),
      ...selectedMultiSourceResults.flatMap((selection) => selection?.result?.matched?.tags || [])
    ].map((tag) => tag?.tag || tag || '').filter(Boolean);

    const existingTagValues = referenceTagValues;
    const existingTags = collectTagEntries(existingTagValues, 'existing', 'Existing', existingTagValues);
    const sourceColumns = selectedMultiSourceResults.map((selection, index) => {
      const columnKey = selection.sourceKey || selection.sourceName || `source-${index}`;
      const columnLabel = selection.sourceName || `Source ${index + 1}`;
      const tagValues = selection?.result?.tags || selection?.result?.scraped?.tags || selection?.result?.metadata?.tags || [];
      return {
        key: columnKey,
        label: columnLabel,
        tagEntries: collectTagEntries(tagValues, columnKey, columnLabel, existingTagValues)
      };
    });

    const columns = [
      { key: 'existing', label: 'Existing', tagEntries: existingTags },
      ...sourceColumns
    ];

    const activeTagSources = Array.isArray(selectedTagSourceKeys) ? selectedTagSourceKeys : [];
    const mergedTagNames = columns.flatMap((column) => {
      if (!activeTagSources.includes(column.key)) return [];
      return column.tagEntries.map((tagEntry) => tagEntry.name).filter(Boolean);
    });

    const explicitTagNames = activeTagSources.filter((entry) => !columns.some((column) => column.key === entry));
    const selectedTagDisplayNames = Array.from(new Set([...mergedTagNames, ...explicitTagNames]));

    return (
      <div className="parse-field">
        <label>Tags:</label>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, minmax(200px, 1fr))`, gap: '10px', alignItems: 'start' }}>
          {columns.map((column) => (
            <div key={column.key} style={{ padding: '0.75rem', borderRadius: '10px', border: selectedTagSourceKeys.includes(column.key) ? '2px solid #10b981' : '1px solid #e5e7eb', background: selectedTagSourceKeys.includes(column.key) ? '#ecfdf5' : '#f9fafb', minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', marginBottom: '0.5rem' }}>{column.label}</div>
              {renderTagSelectionSection(column, column.tagEntries)}
            </div>
          ))}
        </div>
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            value={newTagName}
            onChange={(event) => setNewTagName(event.target.value)}
            placeholder="Create a new tag"
            style={{ flex: 1, padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
          />
          <button type="button" onClick={() => createTagFromModal()} style={{ padding: '0.45rem 0.7rem', borderRadius: '6px', background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer' }}>
            Create Tag
          </button>
        </div>
        <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.75rem', borderRadius: '8px', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#1d4ed8', marginBottom: '0.35rem' }}>Merged selection</div>
          {selectedTagDisplayNames.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {selectedTagDisplayNames.map((tagName, index) => (
                <span key={`${tagName}-${index}`} style={{ padding: '0.25rem 0.45rem', borderRadius: '999px', background: '#dbeafe', color: '#1e3a8a', fontSize: '12px' }}>
                  {tagName}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: '#6b7280' }}>No tags selected yet</div>
          )}
        </div>
      </div>
    );
  };

  const renderSelectedResultsComparison = () => {
    const selectedResults = scrapeData?.selectedResults || [];

    const existingImage = getSceneImageUrl(sceneData);
    const existingTitle = sceneData?.title || '';
    const existingStudio = sceneData?.studio?.name || sceneData?.studio || '';
    const existingDate = sceneData?.date || sceneData?.releaseDate || '';
    const existingDetails = sceneData?.details || sceneData?.synopsis || '';
    const existingUrl = sceneData?.url || sceneData?.urls?.[0] || '';
    const existingPerformers = (sceneData?.performers || []).map((entry) => {
      const performer = entry?.performer || entry;
      return performer?.name || entry?.name || '';
    }).filter(Boolean);
    const existingGroups = (sceneData?.groups || []).map((group) => resolveDisplayName(group)).filter(Boolean);
    const existingEpisodeUrls = Array.isArray(sceneData?.urls) ? sceneData.urls : [];

    const makeColumns = (field, getValue) => {
      const columns = [
        {
          key: 'existing',
          label: 'Existing',
          value: getValue('existing', null)
        }
      ];

      selectedResults.forEach((selection, index) => {
        const key = selection.sourceKey || selection.sourceName || `source-${index}`;
        columns.push({
          key,
          label: selection.sourceName || `Source ${index + 1}`,
          value: getValue(key, selection)
        });
      });

      return columns;
    };

    const renderColumnContent = (field, column) => {
      const value = column.value;

      if (field === 'image') {
        return value ? (
          <img src={value} alt={column.label} style={{ width: '100%', borderRadius: '4px', maxHeight: '180px', objectFit: 'contain', background: '#f3f4f6' }} />
        ) : (
          <div style={{ minHeight: '90px', borderRadius: '4px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>No image</div>
        );
      }

      if (field === 'details') {
        return <div style={{ fontSize: '13px', color: '#111827', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value || 'No details'}</div>;
      }

      if (field === 'url') {
        return <div style={{ fontSize: '13px', color: '#111827', overflowWrap: 'anywhere' }}>{value || 'No URL'}</div>;
      }

      if (field === 'performers') {
        if (column.key === 'existing') {
          const performers = Array.isArray(value) ? value : [];
          return (
            <div style={{ fontSize: '13px', color: '#111827', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {performers.length > 0 ? performers.map((performer, index) => <div key={`${performer}-${index}`}>{performer}</div>) : <div>No performers</div>}
            </div>
          );
        }

        const selection = selectedResults.find((entry) => (entry.sourceKey || entry.sourceName || '') === column.key);
        const performerEntries = getPerformerReviewEntriesForSelection(selection);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {performerEntries.length > 0 ? performerEntries.map((entry) => {
              const translatedTags = parseActionCodeToTags(entry.actionCode);
              const selectionKey = `${column.key}:${entry.key}`;
              const selectedValue = performerSelections?.[selectionKey] || performerSelections?.[entry.key] || entry.defaultSelection || entry.options[0] || '';

              return (
                <div key={selectionKey} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span
                      style={{
                        padding: '0.1rem 0.4rem',
                        borderRadius: '999px',
                        fontSize: '10px',
                        fontWeight: 700,
                        flexShrink: 0,
                        background: entry.matched ? '#dcfce7' : '#fef3c7',
                        color: entry.matched ? '#166534' : '#92400e'
                      }}
                    >
                      {entry.matched ? 'Matched' : 'New'}
                    </span>
                    {entry.name}
                    {entry.matchLabel ? (
                      <span style={{ color: '#6b7280', fontSize: '11px' }}>({entry.matchLabel})</span>
                    ) : null}
                  </div>
                  <select
                    className="performer-alternatives-dropdown"
                    value={selectedValue}
                    onChange={(event) => {
                      const nextValue = { ...(performerSelections || {}), [selectionKey]: event.target.value };
                      onPerformerSelectionChange?.(nextValue);
                    }}
                    style={{ fontSize: '12px', padding: '0.35rem 0.45rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
                  >
                    <option value="">Select action...</option>
                    {entry.options.map((option) => (
                      <option key={`${selectionKey}-${option}`} value={option}>
                        {option === entry.name ? `→ ${option}` : option}
                      </option>
                    ))}
                    <option value="__ADD_NEW__">➕ Add "{entry.name}" as new performer</option>
                  </select>
                  {entry.actionCode && translatedTags.length > 0 ? (
                    <div style={{ fontSize: '11px', color: '#1d4ed8' }}>{translatedTags.join(' • ')}</div>
                  ) : null}
                </div>
              );
            }) : <div>No performers</div>}
          </div>
        );
      }

      if (field === 'groups') {
        const groups = Array.isArray(value) ? value : [];
        const groupEntries = getGroupDisplayEntries(groups, existingGroups);
        const isExistingColumn = column.key === 'existing';
        const currentSelection = selectedResults.find((entry) => (entry.sourceKey || entry.sourceName || '') === column.key);
        const sourceKey = currentSelection?.sourceKey || currentSelection?.sourceName || column.key;

        return (
          <div style={{ fontSize: '13px', color: '#111827', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {groupEntries.length > 0 ? groupEntries.map((group, index) => {
              const selectionKey = `${sourceKey}::${group.originalName || group.name || index}`;
              const candidateGroups = [
                {
                  id: group.id,
                  name: group.name,
                  studio: group.studio || null,
                  date: group.date || null,
                  frontImage: group.frontImage || null,
                  backImage: group.backImage || null
                },
                ...(Array.isArray(group.alternatives) ? group.alternatives : [])
              ].filter((entry) => entry?.id && entry?.name);

              const selectedGroupId = (groupSelections && groupSelections[selectionKey]) || group.id;

              return (
                <div key={`${group.name}-${index}`} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.45rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                    <div style={{ fontWeight: 600 }}>{group.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ padding: '0.18rem 0.45rem', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: group.matched ? '#dcfce7' : '#f3f4f6', color: group.matched ? '#166534' : '#6b7280' }}>
                        {group.matched ? 'Matched' : 'New'}
                      </span>
                      {!isExistingColumn && !group.matched ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            const selectionCandidate = currentSelection?.scraped || currentSelection?.result || currentSelection || {};
                            const scrapedMovies = Array.isArray(selectionCandidate?.movies)
                              ? selectionCandidate.movies
                              : Array.isArray(selectionCandidate?.scraped?.movies)
                                ? selectionCandidate.scraped.movies
                                : [];
                            const matchingMovie = scrapedMovies.find((movieEntry) => {
                              const candidateName = resolveDisplayName(movieEntry);
                              return candidateName && candidateName.toLowerCase() === String(group.name || '').toLowerCase();
                            });

                            onCreateGroup?.({
                              name: group.name,
                              originalName: group.originalName || group.name,
                              sourceKey,
                              url: group.url || selectionCandidate?.url || selectionCandidate?.sourceUrl || null,
                              metadata: {
                                geviUrl: group.url || selectionCandidate?.url || selectionCandidate?.sourceUrl || null,
                                studio: group.studio || matchingMovie?.studio || selectionCandidate?.studio || null,
                                date: group.date || matchingMovie?.date || selectionCandidate?.date || null,
                                synopsis: selectionCandidate?.details || selectionCandidate?.synopsis || matchingMovie?.synopsis || null,
                                director: selectionCandidate?.director || matchingMovie?.director || null,
                                front_image: group.frontImage || matchingMovie?.front_image || null,
                                back_image: group.backImage || matchingMovie?.back_image || null,
                                image: matchingMovie?.image || selectionCandidate?.image || null
                              }
                            });
                          }}
                          title={`Create group "${group.name}"`}
                          style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: '999px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#2563eb', fontSize: '14px', fontWeight: 700 }}
                        >
                          +
                        </button>
                      ) : null}
                    </div>
                </div>

                  {!isExistingColumn && group.matched && candidateGroups.length > 1 ? (
                    <select
                      value={selectedGroupId || ''}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => onGroupSelectionChange?.(selectionKey, event.target.value)}
                      style={{ fontSize: '12px', padding: '0.35rem 0.45rem', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff' }}
                    >
                      {candidateGroups.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.name}{candidate.studio ? ` - ${candidate.studio}` : ''}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  {!isExistingColumn && group.matched ? (
                    <div style={{ fontSize: '11px', color: '#166534', fontWeight: 600 }}>
                      Applying group: {(candidateGroups.find((candidate) => candidate.id === selectedGroupId) || candidateGroups[0] || group).name}
                    </div>
                  ) : null}

                  {!isExistingColumn && group.matched && group.matchedVia === 'created' ? (
                    <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 600 }}>
                      New movie added to database
                    </div>
                  ) : null}

                  {!isExistingColumn && group.matched && candidateGroups.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {candidateGroups.map((candidate) => {
                        const isChosen = candidate.id === selectedGroupId;
                        const imageUrl = candidate.frontImage || candidate.backImage || null;
                        return (
                          <div key={candidate.id} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.3rem', borderRadius: '6px', background: isChosen ? '#ecfdf5' : '#f9fafb', border: isChosen ? '1px solid #34d399' : '1px solid #e5e7eb' }}>
                            {imageUrl ? (
                              <img src={imageUrl} alt={candidate.name} style={{ width: '44px', height: '62px', objectFit: 'cover', borderRadius: '4px', background: '#f3f4f6', flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: '44px', height: '62px', borderRadius: '4px', background: '#f3f4f6', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', flexShrink: 0 }}>No art</div>
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>{candidate.name}</div>
                              <div style={{ fontSize: '11px', color: '#6b7280' }}>{candidate.studio || 'Unknown studio'}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            }) : <div>No groups</div>}
          </div>
        );
      }

      if (field === 'tags') {
        const tags = normalizeTagValues(value);
        return (
          <div style={{ fontSize: '13px', color: '#111827', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {tags.length > 0 ? tags.map((tag, index) => <div key={`${tag}-${index}`}>{tag}</div>) : <div>No tags</div>}
          </div>
        );
      }

      if (field === 'episodeUrls') {
        const urls = Array.isArray(value) ? value : [];
        return (
          <div style={{ fontSize: '13px', color: '#111827', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {urls.length > 0 ? urls.map((url, index) => <div key={`${url}-${index}`} style={{ overflowWrap: 'anywhere' }}>{url}</div>) : <div>No URLs</div>}
          </div>
        );
      }

      return <div style={{ fontSize: '13px', color: '#111827', overflowWrap: 'anywhere' }}>{value || 'No value'}</div>;
    };

    const selectAllFieldsForSource = (sourceKey) => {
      if (!sourceKey || sourceKey === 'existing') return;

      const fieldsToUpdate = ['image', 'title', 'studio', 'date', 'details', 'url', 'performers', 'groups', 'tags', 'episodeUrls'];
      fieldsToUpdate.forEach((fieldName) => {
        onFieldSelectionChange?.(fieldName, sourceKey);
      });
    };

    const renderFieldComparison = (field, label, getValue) => {
      const columns = makeColumns(field, getValue);
      const selectedValue = fieldSelections?.[field] || 'existing';

      return (
        <div className="parse-field">
          <label>{label}:</label>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, minmax(180px, 1fr))`, gap: '10px', alignItems: 'start' }}>
            {columns.map((column) => {
              const isSelected = selectedValue === column.key;
              return (
                <div
                  key={column.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => onFieldSelectionChange?.(field, column.key)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onFieldSelectionChange?.(field, column.key);
                    }
                  }}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '10px',
                    border: isSelected ? '2px solid #10b981' : '1px solid #d1d5db',
                    background: isSelected ? '#dcfce7' : '#f9fafb',
                    cursor: 'pointer',
                    minWidth: 0,
                    boxShadow: isSelected ? '0 4px 12px rgba(16, 185, 129, 0.15)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (column.key !== 'existing') {
                          selectAllFieldsForSource(column.key);
                        }
                      }}
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#6b7280',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: column.key === 'existing' ? 'default' : 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      {column.label}
                    </button>
                    {isSelected && <span style={{ color: '#10b981', fontSize: '16px' }}>✓</span>}
                  </div>
                  {renderColumnContent(field, column)}
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontSize: '13px' }}>
          Choose one value for each field to apply across all selected scenes.
        </div>

        {renderFieldComparison('image', 'Cover Image', (key) => {
          if (key === 'existing') return existingImage;
          const selection = selectedResults.find((entry) => (entry.sourceKey || entry.sourceName || '') === key);
          return getSelectionFieldValue(selection, 'image');
        })}

        {renderFieldComparison('title', 'Title', (key) => {
          if (key === 'existing') return existingTitle;
          const selection = selectedResults.find((entry) => (entry.sourceKey || entry.sourceName || '') === key);
          return getSelectionFieldValue(selection, 'title');
        })}

        {renderFieldComparison('studio', 'Studio', (key) => {
          if (key === 'existing') return existingStudio;
          const selection = selectedResults.find((entry) => (entry.sourceKey || entry.sourceName || '') === key);
          return getSelectionFieldValue(selection, 'studio');
        })}

        {renderFieldComparison('date', 'Date', (key) => {
          if (key === 'existing') return existingDate;
          const selection = selectedResults.find((entry) => (entry.sourceKey || entry.sourceName || '') === key);
          return getSelectionFieldValue(selection, 'date');
        })}

        {renderFieldComparison('details', 'Details', (key) => {
          if (key === 'existing') return existingDetails;
          const selection = selectedResults.find((entry) => (entry.sourceKey || entry.sourceName || '') === key);
          return getSelectionFieldValue(selection, 'details');
        })}

        {renderFieldComparison('url', 'URL / Source', (key) => {
          if (key === 'existing') return existingUrl;
          const selection = selectedResults.find((entry) => (entry.sourceKey || entry.sourceName || '') === key);
          return getSelectionFieldValue(selection, 'url');
        })}

        {renderFieldComparison('performers', 'Performers', (key) => {
          if (key === 'existing') return existingPerformers;
          const selection = selectedResults.find((entry) => (entry.sourceKey || entry.sourceName || '') === key);
          return getSelectionFieldValue(selection, 'performers');
        })}

        {renderFieldComparison('groups', 'Matched Groups', (key) => {
          if (key === 'existing') return existingGroups;
          const selection = selectedResults.find((entry) => (entry.sourceKey || entry.sourceName || '') === key);
          return getSelectionFieldValue(selection, 'groups');
        })}

        {renderTagFieldComparison()}

        {renderFieldComparison('episodeUrls', 'Episode URLs', (key) => {
          if (key === 'existing') return existingEpisodeUrls;
          const selection = selectedResults.find((entry) => (entry.sourceKey || entry.sourceName || '') === key);
          return getSelectionFieldValue(selection, 'episodeUrls');
        })}

      </div>
    );
  };

  const renderSingleScrapeDetails = () => {
    const scraped = scrapeData?.scraped || {};
    const matchedPerformers = scrapeData?.matched?.performers || [];
    const unmatchedPerformers = scrapeData?.unmatched?.performers || [];
    const performerNames = [
      ...matchedPerformers.map((entry) => entry?.name || entry),
      ...unmatchedPerformers.map((entry) => (typeof entry === 'string' ? entry : entry?.name)).filter(Boolean)
    ].filter(Boolean);

    const existingImage = getSceneImageUrl(sceneData);
    const scrapedImage = scraped.image || scraped.originalImage || scraped.displayImage || null;
    const existingTitle = sceneData?.title || '';
    const scrapedTitle = scraped.title || '';
    const existingStudio = sceneData?.studio?.name || sceneData?.studio || '';
    const scrapedStudio = typeof scraped.studio === 'string' ? scraped.studio : scraped.studio?.name || '';
    const existingDate = sceneData?.date || sceneData?.releaseDate || '';
    const scrapedDate = scraped.date || '';
    const existingDetails = sceneData?.details || sceneData?.synopsis || '';
    const scrapedDetails = scraped.details || '';
    const existingUrl = sceneData?.url || sceneData?.urls?.[0] || '';
    const scrapedUrl = scraped.url || scrapeData?.sourceUrl || '';
    const existingTags = normalizeTagValues(sceneData?.tags || []);
    const scrapedTags = normalizeTagValues(scraped.tags || []);
    const existingEpisodeUrls = Array.isArray(sceneData?.urls) ? sceneData.urls : [];
    const scrapedEpisodeUrls = Array.isArray(scraped.episodeUrls) ? scraped.episodeUrls : Array.isArray(scraped.urls) ? scraped.urls : [];

    return (
      <div style={{ display: 'grid', gap: '1rem' }}>
        <div className="parse-field">
          <label>Cover Image:</label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {renderChoiceCard(
              (fieldSelections?.image || 'scraped') === 'existing',
              () => onFieldSelectionChange?.('image', 'existing'),
              'EXISTING',
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {existingImage ? (
                  <img src={existingImage} alt="Existing" style={{ width: '100%', borderRadius: '4px', maxHeight: '220px', objectFit: 'contain', background: '#f3f4f6' }} />
                ) : (
                  <div style={{ width: '100%', minHeight: '120px', borderRadius: '4px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>No image</div>
                )}
              </div>
            )}
            {renderChoiceCard(
              (fieldSelections?.image || 'scraped') === 'scraped',
              () => onFieldSelectionChange?.('image', 'scraped'),
              'SCRAPED',
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {scrapedImage ? (
                  <img src={scrapedImage} alt="Scraped" style={{ width: '100%', borderRadius: '4px', maxHeight: '220px', objectFit: 'contain', background: '#f3f4f6' }} />
                ) : (
                  <div style={{ width: '100%', minHeight: '120px', borderRadius: '4px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>No image</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="parse-field">
          <label>Title:</label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {renderChoiceCard(
              (fieldSelections?.title || 'scraped') === 'existing',
              () => onFieldSelectionChange?.('title', 'existing'),
              'EXISTING',
              <div style={{ fontSize: '14px', color: '#111827' }}>{existingTitle || 'No title'}</div>
            )}
            {renderChoiceCard(
              (fieldSelections?.title || 'scraped') === 'scraped',
              () => onFieldSelectionChange?.('title', 'scraped'),
              'SCRAPED',
              <div style={{ fontSize: '14px', color: '#111827' }}>{scrapedTitle || 'No title'}</div>
            )}
          </div>
        </div>

        <div className="parse-field">
          <label>Studio:</label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {renderChoiceCard(
              (fieldSelections?.studio || 'scraped') === 'existing',
              () => onFieldSelectionChange?.('studio', 'existing'),
              'EXISTING',
              <div style={{ fontSize: '14px', color: '#111827' }}>{existingStudio || 'No studio'}</div>
            )}
            {renderChoiceCard(
              (fieldSelections?.studio || 'scraped') === 'scraped',
              () => onFieldSelectionChange?.('studio', 'scraped'),
              'SCRAPED',
              <div style={{ fontSize: '14px', color: '#111827' }}>
                {scrapedStudio || 'No studio'}
                {scrapedStudio && scrapeData?.matched?.studio ? <span style={{ marginLeft: '0.5rem', color: '#10b981' }}>✓ Matched</span> : null}
              </div>
            )}
          </div>
        </div>

        <div className="parse-field">
          <label>Date:</label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {renderChoiceCard(
              (fieldSelections?.date || 'scraped') === 'existing',
              () => onFieldSelectionChange?.('date', 'existing'),
              'EXISTING',
              <div style={{ fontSize: '14px', color: '#111827' }}>{existingDate || 'No date'}</div>
            )}
            {renderChoiceCard(
              (fieldSelections?.date || 'scraped') === 'scraped',
              () => onFieldSelectionChange?.('date', 'scraped'),
              'SCRAPED',
              <div style={{ fontSize: '14px', color: '#111827' }}>{scrapedDate || 'No date'}</div>
            )}
          </div>
        </div>

        <div className="parse-field">
          <label>Details:</label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {renderChoiceCard(
              (fieldSelections?.details || 'scraped') === 'existing',
              () => onFieldSelectionChange?.('details', 'existing'),
              'EXISTING',
              <div style={{ fontSize: '13px', color: '#111827', whiteSpace: 'pre-wrap', maxHeight: '180px', overflow: 'auto' }}>{existingDetails || 'No details'}</div>
            )}
            {renderChoiceCard(
              (fieldSelections?.details || 'scraped') === 'scraped',
              () => onFieldSelectionChange?.('details', 'scraped'),
              'SCRAPED',
              <div style={{ fontSize: '13px', color: '#111827', whiteSpace: 'pre-wrap', maxHeight: '180px', overflow: 'auto' }}>{scrapedDetails || 'No details'}</div>
            )}
          </div>
        </div>

        <div className="parse-field">
          <label>URL / Source:</label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {renderChoiceCard(
              (fieldSelections?.url || 'scraped') === 'existing',
              () => onFieldSelectionChange?.('url', 'existing'),
              'EXISTING',
              <div style={{ fontSize: '13px', color: '#111827', wordBreak: 'break-all' }}>{existingUrl || 'No URL'}</div>
            )}
            {renderChoiceCard(
              (fieldSelections?.url || 'scraped') === 'scraped',
              () => onFieldSelectionChange?.('url', 'scraped'),
              'SCRAPED',
              <div style={{ fontSize: '13px', color: '#111827', wordBreak: 'break-all' }}>{scrapedUrl || 'No URL'}</div>
            )}
          </div>
        </div>

        {(existingTags.length > 0 || scrapedTags.length > 0) && (
          <div className="parse-field">
            <label>Tags:</label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {renderChoiceCard(
                (fieldSelections?.tags || 'scraped') === 'existing',
                () => onFieldSelectionChange?.('tags', 'existing'),
                'EXISTING',
                <div style={{ fontSize: '13px', color: '#111827', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {existingTags.length > 0 ? existingTags.map((tag, index) => <div key={`${tag}-${index}`}>{tag}</div>) : <div>No tags</div>}
                </div>
              )}
              {renderChoiceCard(
                (fieldSelections?.tags || 'scraped') === 'scraped',
                () => onFieldSelectionChange?.('tags', 'scraped'),
                'SCRAPED',
                <div style={{ fontSize: '13px', color: '#111827', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {scrapedTags.length > 0 ? scrapedTags.map((tag, index) => <div key={`${tag}-${index}`}>{tag}</div>) : <div>No tags</div>}
                </div>
              )}
            </div>
          </div>
        )}

        {scrapedEpisodeUrls.length > 0 && (
          <div className="parse-field">
            <label>Episode URLs ({scrapedEpisodeUrls.length}):</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {scrapedEpisodeUrls.map((url, urlIndex) => (
                <div key={`${url}-${urlIndex}`} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input className="parse-input" readOnly type="text" value={url} style={{ flex: 1, background: '#f3f4f6', cursor: 'default', fontSize: '13px' }} />
                  <a href={url} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 10px', background: '#6366f1', color: 'white', borderRadius: '4px', textDecoration: 'none', fontSize: '12px', whiteSpace: 'nowrap' }}>🔗</a>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '8px', padding: '8px 12px', background: '#dbeafe', borderRadius: '4px', fontSize: '13px', color: '#1d4ed8' }}>
              ℹ️ These URLs will be added to the scene in Stash.
            </div>
          </div>
        )}

        {performerNames.length > 0 && (
          <div className="parse-field">
            <label>Performers:</label>
            <div className="performers-list">
              {getPerformerReviewEntries().map((entry) => {
                const translatedTags = parseActionCodeToTags(entry.actionCode);
                const selectedValue = performerSelections?.[entry.key] || '';

                return (
                  <div key={entry.key} className={`performer-item ${entry.matched ? 'matched' : ''}`}>
                    <div className="performer-input-wrapper">
                      <span className="performer-name" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            padding: '0.1rem 0.45rem',
                            borderRadius: '999px',
                            fontSize: '10px',
                            fontWeight: 700,
                            flexShrink: 0,
                            background: entry.matched ? '#dcfce7' : '#fef3c7',
                            color: entry.matched ? '#166534' : '#92400e'
                          }}
                        >
                          {entry.matched ? 'Matched' : 'New'}
                        </span>
                        {entry.name}
                        {entry.matchLabel ? (
                          <span className="alias-info" style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                            ({entry.matchLabel})
                          </span>
                        ) : null}
                        {entry.actionCode ? (
                          <span className="action-code" style={{ color: '#10b981', fontSize: '0.875rem' }}>
                            ({entry.actionCode})
                          </span>
                        ) : null}
                      </span>
                      <select
                        className="performer-alternatives-dropdown"
                        value={selectedValue}
                        onChange={(event) => {
                          const nextValue = { ...(performerSelections || {}), [entry.key]: event.target.value };
                          onPerformerSelectionChange?.(nextValue);
                        }}
                      >
                        <option value="">Select action...</option>
                        {entry.options.map((option) => (
                          <option key={option} value={option}>
                            {option === entry.name ? `→ ${option}` : option}
                          </option>
                        ))}
                        <option value="__ADD_NEW__">➕ Add "{entry.name}" as new performer</option>
                      </select>
                    </div>
                    {entry.actionCode && translatedTags.length > 0 ? (
                      <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', color: '#1d4ed8' }}>
                        {translatedTags.join(' • ')}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(() => {
          const groupEntries = getGroupReviewEntries();
          const matchedGroups = groupEntries.filter((entry) => entry.matched);
          const unmatchedGroups = groupEntries.filter((entry) => !entry.matched);

          if (matchedGroups.length === 0 && unmatchedGroups.length === 0) {
            return null;
          }

          return (
            <div className="parse-field">
              <label>Groups:</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                {matchedGroups.length > 0 && (
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', marginBottom: '0.35rem' }}>Matched</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {matchedGroups.map((group, index) => (
                        <div key={`${group.id || group.name || index}`} style={{ fontSize: '13px', color: '#111827' }}>{group.name || 'Group'}</div>
                      ))}
                    </div>
                  </div>
                )}

                {unmatchedGroups.length > 0 && (
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', marginBottom: '0.35rem' }}>Available to create</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {unmatchedGroups.map((group, index) => (
                        <div key={`${group.id || group.name || index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                          <div style={{ fontSize: '13px', color: '#111827' }}>{group.name || 'Group'}</div>
                          <button
                            type="button"
                            onClick={() => onCreateGroup?.(group)}
                            title={`Create group "${group.name}"`}
                            style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: '999px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#2563eb', fontSize: '14px', fontWeight: 700 }}
                          >
                            +
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  return (
    <div className="modal-overlay" style={{ padding: 0 }}>
      <div className="modal-content scrape-review-modal" onClick={(e) => e.stopPropagation()} style={{ width: '100vw', height: '100vh', maxWidth: '100vw', maxHeight: '100vh', borderRadius: 0, overflowY: 'auto', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>📋 Review Scraped Metadata</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {!isMultiSourceReview && onAccept && (
              <button
                type="button"
                className="btn-primary"
                onClick={onAccept}
                style={{ padding: '0.35rem 0.75rem' }}
              >
                {shouldUseApplyAndNext ? 'Apply and Next' : 'Apply Scrape'}
              </button>
            )}
            {isMultiSourceReview && scrapeData?.reviewView === 'selected-detail' && (
              <button
                type="button"
                className="btn-primary"
                onClick={onApply}
                style={{ padding: '0.35rem 0.75rem' }}
              >
                {shouldUseApplyAndNext ? 'Apply and Next' : 'Apply'}
              </button>
            )}
            {isMultiSourceReview && scrapeData?.reviewView !== 'selected-detail' && (
              <button
                type="button"
                className="btn-primary"
                onClick={onShowSelectedDetails}
                disabled={selectedMultiSourceResults.length === 0}
                style={{ padding: '0.35rem 0.75rem' }}
              >
                Next
              </button>
            )}
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              style={{ padding: '0.35rem 0.75rem' }}
            >
              ✕ Close
            </button>
          </div>
        </div>

        <div className="scrape-results">
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1rem', padding: '1rem', borderRadius: '12px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
            <div style={{ flexShrink: 0, width: '260px', maxWidth: '40vw' }}>
              {sceneData ? (
                <img
                  src={getSceneImageUrl(sceneData)}
                  alt={sceneData?.title || 'Scene cover'}
                  style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', background: '#f3f4f6' }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <div style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: '8px', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
                  No image
                </div>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#111827', marginBottom: '0.35rem' }}>
                {sceneData?.id ? (
                  <a
                    href={`/media/stash/scenes/${sceneData.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#2563eb', textDecoration: 'none' }}
                    title={`Open ${getSceneDisplayTitle(sceneData)} in Stash`}
                  >
                    {getSceneDisplayTitle(sceneData)}
                  </a>
                ) : (
                  getSceneDisplayTitle(sceneData)
                )}
              </div>
              <div style={{ fontSize: '13px', color: '#4b5563', marginBottom: '0.35rem' }}>
                <span className="source-label">{isMultiSourceReview ? 'Compared across:' : 'Source:'}</span>
                <span className="source-url">{isMultiSourceReview ? `${scrapeData.multiSourceResults.length} source(s)` : (scrapeData.source || 'GEVI')}</span>
              </div>
              {sceneData?.performers && sceneData.performers.length > 0 ? (
                <div style={{ fontSize: '13px', color: '#374151' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Performers:</div>
                  <div style={{ display: 'block' }}>
                    {sceneData.performers.map((p) => {
                      const performer = p?.performer || p;
                      const name = performer?.name || p?.name || 'Unknown performer';
                      const alias = performer?.alias || p?.alias;
                      const disambiguation = performer?.disambiguation || p?.disambiguation;
                      const parts = [];

                      if (name) {
                        parts.push(<span key="name" style={{ fontWeight: 700 }}>{name}</span>);
                      }

                      if (alias) {
                        parts.push(<span key="alias">{' '}aka {alias}</span>);
                      }

                      if (disambiguation) {
                        parts.push(<span key="disambiguation">{' '}({disambiguation})</span>);
                      }

                      return <div key={performer?.id || p?.id || name}>{parts}</div>;
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  No performers linked to this scene.
                </div>
              )}
            </div>
          </div>

          {!isMultiSourceReview ? (
            renderSingleScrapeDetails()
          ) : scrapeData.reviewView === 'selected-detail' ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem' }}>
                <div style={{ fontWeight: 700, color: '#111827' }}>
                  Compare selected results and choose one value for each field
                </div>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={onShowSelectionView}
                  style={{ padding: '0.35rem 0.75rem' }}
                >
                  ← Back
                </button>
              </div>
              {renderSelectedResultsComparison()}
            </div>
          ) : scrapeData.reviewView === 'selection' ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 700, color: '#111827' }}>Selected scenes</div>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={onShowListView}
                  style={{ padding: '0.35rem 0.75rem' }}
                >
                  Back
                </button>
              </div>
              {selectedMultiSourceResults.length === 0 ? (
                <div style={{ color: '#6b7280' }}>No scenes selected yet.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  {selectedMultiSourceResults.map((selection, index) => {
                    const result = selection.result || {};
                    return (
                      <div
                        key={`${selection.sourceKey}-${index}`}
                        style={{
                          border: '1px solid #d1d5db',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          background: 'white',
                          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.06)'
                        }}
                      >
                        {result.image ? (
                          <img
                            src={result.image}
                            alt={result.title || 'Selected scene'}
                            style={{ width: '100%', maxHeight: '220px', objectFit: 'contain', background: '#f3f4f6' }}
                          />
                        ) : (
                          <div style={{ width: '100%', height: '220px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                            No image
                          </div>
                        )}
                        <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ fontWeight: 700, color: '#111827' }}>{result.title || `Scene ${index + 1}`}</div>
                          <div style={{ fontSize: '13px', color: '#4b5563' }}>{selection.sourceName}</div>
                          {result.studio && (
                            <div style={{ fontSize: '13px', color: '#4b5563' }}>Studio: {typeof result.studio === 'object' ? result.studio.name : result.studio}</div>
                          )}
                          {result.date && (
                            <div style={{ fontSize: '13px', color: '#4b5563' }}>Date: {result.date}</div>
                          )}
                          {result.details && (
                            <div style={{ fontSize: '13px', color: '#4b5563', whiteSpace: 'pre-wrap' }}>{result.details}</div>
                          )}
                          {result.performers && (
                            <div style={{ fontSize: '12px', color: '#4b5563', lineHeight: 1.4 }}>
                              {renderPerformers(result.performers)}
                            </div>
                          )}
                          {result.url && (
                            <a href={result.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#2563eb' }}>
                              Open source
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', alignItems: 'start', gridAutoFlow: 'dense' }}>
              {scrapeData.multiSourceResults.map((sourceResult, index) => (
                <div
                  key={sourceResult.id || `${sourceResult.endpoint || 'source'}-${index}`}
                  style={{
                    border: sourceResult.hasResults ? '1px solid #34d399' : '1px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '1rem',
                    background: sourceResult.hasResults ? '#f0fdf4' : '#f9fafb',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.06)'
                  }}
                >
                  <div style={{ fontWeight: '700', color: '#111827', marginBottom: '0.25rem' }}>
                    {sourceResult.name}
                  </div>
                  <div style={{ fontSize: '13px', color: '#4b5563', marginBottom: '0.75rem' }}>
                    {sourceResult.resultCount} result{sourceResult.resultCount === 1 ? '' : 's'}
                  </div>

                  {sourceResult.results.length === 0 ? (
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>
                      No matches returned from this source.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {sourceResult.results.map((result, resultIndex) => {
                        const selectionKey = sourceResult.endpoint || sourceResult.id || sourceResult.name;
                        const resultKey = [
                          result?.id,
                          result?.url,
                          result?.title,
                          result?.date,
                          typeof result?.studio === 'object' ? result?.studio?.name : result?.studio,
                          result?.image
                        ].filter(Boolean).join('::') || JSON.stringify(result || {});
                        const isSelected = selectedMultiSourceResults.some(selection => selection.sourceKey === selectionKey && selection.resultKey === resultKey);

                        return (
                          <div
                            key={`${sourceResult.endpoint || sourceResult.name}-${resultIndex}`}
                            style={{
                              background: 'white',
                              border: isSelected ? '2px solid #2563eb' : '1px solid #d1d5db',
                              borderRadius: '10px',
                              overflow: 'hidden',
                              display: 'flex',
                              flexDirection: 'column',
                              boxShadow: isSelected ? '0 0 0 1px rgba(37, 99, 235, 0.15)' : 'none'
                            }}
                          >
                            {result.image ? (
                              <img
                                src={result.image}
                                alt={result.title || `Result ${resultIndex + 1}`}
                                style={{ width: '100%', maxHeight: '220px', objectFit: 'contain', background: '#f3f4f6' }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div style={{ width: '100%', height: '220px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                                No image
                              </div>
                            )}
                            <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <div style={{ fontSize: '14px', color: '#111827', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                {result.title || `Result ${resultIndex + 1}`}
                                {sourceResult.endpoint === 'gevi-movie-search' && Array.isArray(result.matched?.groups) && result.matched.groups.length > 0 && (
                                  <span style={{ padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '10px', fontWeight: 700, background: '#dcfce7', color: '#166534', flexShrink: 0 }}>
                                    ✓ IN DATABASE
                                  </span>
                                )}
                                {sourceResult.endpoint === 'gevi-movie-search' && (!result.matched?.groups?.length) && Array.isArray(result.unmatched?.groups) && result.unmatched.groups.length > 0 && (
                                  <span style={{ padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '10px', fontWeight: 700, background: '#ffedd5', color: '#9a3412', flexShrink: 0 }}>
                                    ✦ NEW MOVIE
                                  </span>
                                )}
                              </div>
                              {renderPerformers(result.performers)}
                              {(() => {
                                const breakdowns = getSceneBreakdownEntries(result);
                                if (breakdowns.length === 0) {
                                  return null;
                                }

                                return (
                                  <div style={{ fontSize: '12px', color: '#4338ca' }}>
                                    <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Scene breakdown</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                      {breakdowns.map((movieScene, sceneIndex) => {
                                        const performerNames = (movieScene.performers || []).map((performer) => performer?.name || performer).filter(Boolean);
                                        const label = movieScene.sceneNumber ? `Scene ${movieScene.sceneNumber}` : `Scene ${sceneIndex + 1}`;
                                        return (
                                          <div key={`${label}-${sceneIndex}`} style={{ fontSize: '11px', color: '#374151', lineHeight: 1.3 }}>
                                            <span style={{ fontWeight: 600 }}>{label}</span>
                                            {performerNames.length > 0 ? <> • {performerNames.join(', ')}</> : null}
                                            {movieScene.details ? <> • {movieScene.details.length > 70 ? `${movieScene.details.slice(0, 70)}...` : movieScene.details}</> : null}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })()}
                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <button
                                  className="btn-primary"
                                  onClick={() => handleReviewAction(result, sourceResult)}
                                  style={{ padding: '0.35rem 0.6rem', fontSize: '12px', alignSelf: 'flex-start' }}
                                >
                                  Review
                                </button>
                                <button
                                  className={isSelected ? 'btn-primary' : 'btn-cancel'}
                                  onClick={() => onToggleSelection(sourceResult, result, selectionKey)}
                                  style={{ padding: '0.35rem 0.6rem', fontSize: '12px', alignSelf: 'flex-start' }}
                                >
                                  {isSelected ? 'Selected' : 'Select'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
