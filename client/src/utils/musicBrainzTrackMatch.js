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

  const local = [...(albumTracks || [])].sort((left, right) => (left.index || 0) - (right.index || 0));
  const remote = flattenReleaseTracks(releaseDetails);
  const usedRemoteTrackKeys = new Set();

  const getTrackNumber = (track) => {
    const value = track?.index ?? track?.trackNumber ?? null;
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
  };

  const getTrackId = (track) => track?.musicBrainzTrackId || track?.recordingId || null;

  const findStrictMatch = (localTrack) => {
    const localTrackNumber = getTrackNumber(localTrack);
    const localTrackId = getTrackId(localTrack);

    if (localTrackId) {
      return remote.find((remoteTrack) => {
        if (usedRemoteTrackKeys.has(remoteTrack._previewKey)) {
          return false;
        }

        const remoteTrackId = getTrackId(remoteTrack);
        if (!remoteTrackId || remoteTrackId !== localTrackId) {
          return false;
        }

        const remoteTrackNumber = getTrackNumber(remoteTrack);
        if (localTrackNumber !== null && remoteTrackNumber !== null) {
          return remoteTrackNumber === localTrackNumber;
        }

        return true;
      }) || null;
    }

    if (localTrackNumber === null) {
      return null;
    }

    return remote.find((remoteTrack) => {
      if (usedRemoteTrackKeys.has(remoteTrack._previewKey)) {
        return false;
      }

      if (getTrackId(remoteTrack)) {
        return false;
      }

      return getTrackNumber(remoteTrack) === localTrackNumber;
    }) || null;
  };

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

      if ((localTrack.index || null) !== (remoteTrack.trackNumber || null)) {
        changes.push(`Track # ${localTrack.index || '—'} -> ${remoteTrack.trackNumber || '—'}`);
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

