/**
 * Shared helpers for comparing a local album's tracklist against a MusicBrainz
 * release's tracklist. Used to render the "existing track next to pulled track"
 * comparison columns after accepting a MusicBrainz identification candidate.
 */

const getRelationWorkTitle = (entity) => {
  const relationLists = [
    entity?.relations,
    entity?.['relation-list'],
    entity?.['work-relation-list'],
    entity?.['work-rels']
  ].filter(Array.isArray);

  const relations = relationLists.flat();

  const preferred = relations.find((relation) => relation?.work && relation?.type === 'performance')
    || relations.find((relation) => relation?.work && relation?.type === 'related works')
    || relations.find((relation) => relation?.work)
    || null;

  return preferred?.work?.title || null;
};

/**
 * Best-effort disc number for a local track: the synced Plex value, else the disc encoded in the
 * file path/name for libraries that were synced before disc numbers were stored.
 */
export const inferLocalDiscNumber = (track) => {
  const extractedDisc = Number.isInteger(track?.discNumber) ? track.discNumber : null;
  if (extractedDisc) {
    return extractedDisc;
  }

  const directDisc = Number.isInteger(track?.parentIndex) ? track.parentIndex : null;
  if (directDisc) {
    return directDisc;
  }

  const filePath = String(track?.file || '').trim();
  if (!filePath) {
    return null;
  }

  const folderDiscMatch = filePath.match(/[\\/](?:disc|cd)\s*(\d{1,2})[\\/]/i);
  if (folderDiscMatch) {
    const parsed = Number.parseInt(folderDiscMatch[1], 10);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }

  const filename = filePath.split(/[\\/]/).pop() || '';
  const filenameDiscMatch = filename.match(/^(\d{1,2})\s*[-._]\s*\d{1,3}\b/);
  if (filenameDiscMatch) {
    const parsed = Number.parseInt(filenameDiscMatch[1], 10);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }

  return null;
};

export const flattenReleaseTracks = (releaseDetails) => {
  return (releaseDetails?.media || []).flatMap((medium, mediumIndex) => {
    const discNumber = medium?.position || mediumIndex + 1;

    return (medium?.tracks || []).map((track, trackIndex) => ({
      _previewKey: `${discNumber}-${track?.position || track?.number || trackIndex + 1}-${track?.recording?.id || track?.id || trackIndex}`,
      discNumber,
      trackNumber: track?.position || track?.number || trackIndex + 1,
      title: track?.title || 'Untitled',
      length: track?.length || null,
      recordingId: track?.recording?.id || null,
      recordingTitle: track?.recording?.title || null,
      workTitle: getRelationWorkTitle(track) || getRelationWorkTitle(track?.recording),
      mediumTitle: medium?.title || null
    }));
  });
};

/**
 * Builds row-by-row matches between local album tracks and a MusicBrainz release's tracks.
 * @param {Array} albumTracks - local tracks (e.g. from PlexTrack)
 * @param {Object} releaseDetails - raw MusicBrainz release data (with `media`)
 * @param {Object} [manualMatchesByLocalKey] - optional map of localTrack.ratingKey -> remote track's
 *   `_previewKey`, used to force a specific pairing instead of the automatic strict match
 * @returns {{ rows: Array, unmatchedRemoteTracks: Array }}
 */
export const buildTrackPreview = (albumTracks, releaseDetails, manualMatchesByLocalKey = {}) => {
  if (!releaseDetails) {
    return { rows: [], unmatchedRemoteTracks: [] };
  }

  const getTrackNumber = (track) => {
    const value = track?.trackNumber ?? track?.index ?? null;
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
  };

  const getDiscNumber = (track) => (
    Number.isInteger(track?.discNumber) ? track.discNumber : inferLocalDiscNumber(track)
  );

  const local = [...(albumTracks || [])].sort((left, right) => {
    const discDelta = (getDiscNumber(left) || Number.MAX_SAFE_INTEGER) - (getDiscNumber(right) || Number.MAX_SAFE_INTEGER);
    if (discDelta !== 0) {
      return discDelta;
    }
    return (getTrackNumber(left) || 0) - (getTrackNumber(right) || 0);
  });
  const remote = flattenReleaseTracks(releaseDetails);
  const usedRemoteTrackKeys = new Set();

  // Discs only disqualify a pairing when both sides know their disc, so single-disc releases and
  // libraries synced before disc numbers existed still match on track number alone.
  const discsAreCompatible = (localTrack, remoteTrack) => {
    const localDisc = getDiscNumber(localTrack);
    const remoteDisc = getDiscNumber(remoteTrack);
    if (localDisc === null || remoteDisc === null) {
      return true;
    }
    return localDisc === remoteDisc;
  };

  const getTrackId = (track) => track?.musicBrainzTrackId || track?.recordingId || null;

  // Mirrors the server's matchLocalTracksToReleaseTracks so the preview shows exactly what will
  // be applied: recording IDs win when both sides have one, otherwise pair on disc + track number.
  const isCompatible = (localTrack, remoteTrack) => {
    if (!discsAreCompatible(localTrack, remoteTrack)) {
      return false;
    }

    const localTrackNumber = getTrackNumber(localTrack);
    const remoteTrackNumber = getTrackNumber(remoteTrack);
    const numbersMatch = localTrackNumber !== null
      && remoteTrackNumber !== null
      && localTrackNumber === remoteTrackNumber;

    const localTrackId = getTrackId(localTrack);
    const remoteTrackId = getTrackId(remoteTrack);

    if (localTrackId && remoteTrackId) {
      if (localTrackId !== remoteTrackId) {
        return false;
      }
      return localTrackNumber === null || remoteTrackNumber === null || numbersMatch;
    }

    return numbersMatch;
  };

  const findStrictMatch = (localTrack) => remote.find((remoteTrack) => (
    !usedRemoteTrackKeys.has(remoteTrack._previewKey) && isCompatible(localTrack, remoteTrack)
  )) || null;

  // Reserve manual matches first so the automatic matching pass below can't steal a remote
  // track the user has already manually assigned to a different local track.
  const manualRemoteTrackByLocalKey = new Map();
  for (const localTrack of local) {
    const manualPreviewKey = manualMatchesByLocalKey?.[localTrack.ratingKey] || null;
    if (!manualPreviewKey) {
      continue;
    }

    const remoteTrack = remote.find((candidate) => candidate._previewKey === manualPreviewKey && !usedRemoteTrackKeys.has(candidate._previewKey));
    if (remoteTrack) {
      usedRemoteTrackKeys.add(remoteTrack._previewKey);
      manualRemoteTrackByLocalKey.set(localTrack.ratingKey, remoteTrack);
    }
  }

  const rows = local.map((localTrack) => {
    const manualRemoteTrack = manualRemoteTrackByLocalKey.get(localTrack.ratingKey) || null;
    const remoteTrack = manualRemoteTrack || findStrictMatch(localTrack);
    if (remoteTrack && !manualRemoteTrack) {
      usedRemoteTrackKeys.add(remoteTrack._previewKey);
    }

    const changes = [];

    if (remoteTrack) {
      if (manualRemoteTrack) {
        changes.push('Manually matched');
      }

      if (getDiscNumber(localTrack) !== remoteTrack.discNumber) {
        changes.push(`Disc # ${getDiscNumber(localTrack) || '—'} -> ${remoteTrack.discNumber || '—'}`);
      }

      if (getTrackNumber(localTrack) !== (remoteTrack.trackNumber || null)) {
        changes.push(`Track # ${getTrackNumber(localTrack) || '—'} -> ${remoteTrack.trackNumber || '—'}`);
      }

      if ((localTrack.title || '') !== (remoteTrack.title || '')) {
        changes.push(`Title -> ${remoteTrack.title}`);
      }

      if ((localTrack.musicBrainzTrackId || '') !== (remoteTrack.recordingId || '')) {
        changes.push('MusicBrainz recording ID');
      }
    } else {
      changes.push('No matching MusicBrainz track found');
    }

    return {
      localTrack,
      remoteTrack,
      isManualMatch: Boolean(manualRemoteTrack),
      changes: changes.length > 0 ? changes.join(', ') : 'No change'
    };
  });

  const unmatchedRemoteTracks = remote.filter((remoteTrack) => !usedRemoteTrackKeys.has(remoteTrack._previewKey));

  return { rows, unmatchedRemoteTracks };
};

