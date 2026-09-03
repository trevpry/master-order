import React, { useState, useEffect, useMemo } from 'react';
import config from '../../../../../config';
import TracksPlaylistPlayer from './TracksPlaylistPlayer';
import StarRating from '../../../../../components/StarRating';
import IdentifyModal from '../../../../../components/IdentifyModal';
import MetadataEditor from '../../../../../components/MetadataEditor';
import EmbeddedPicardTagsPanel from './EmbeddedPicardTagsPanel';
import { buildTrackPreview, inferLocalDiscNumber } from '../../../../../utils/musicBrainzTrackMatch';
import './AlbumDetail.css';

const AlbumDetail = ({
  album,
  tracks: initialTracks,
  currentTrack,
  isPlaying,
  playlists,
  selectedSection,
  backLabel = 'Back to Albums',
  onMergeWorks,
  onGoBack,
  onPlayTrack,
  onSelectArtist,
  onSelectTrack,
  onAddTrackToCustomPlaylist,
  formatDuration,
  formatFileSize
}) => {
  if (!album) return null;
  
  const [tracks, setTracks] = useState(initialTracks);
  const [showIdentifyModal, setShowIdentifyModal] = useState(false);
  const [mbTrackMatchPreview, setMbTrackMatchPreview] = useState(null);
  const [manualTrackMatchOverrides, setManualTrackMatchOverrides] = useState({});
  const [editingUnmatchedRowKey, setEditingUnmatchedRowKey] = useState(null);
  const [isApplyingMbMetadata, setIsApplyingMbMetadata] = useState(false);
  const [applyMbMetadataError, setApplyMbMetadataError] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showMusicBrainzData, setShowMusicBrainzData] = useState(false);
  const [albumData, setAlbumData] = useState(album);
  const [isSplittingByAlbumId, setIsSplittingByAlbumId] = useState(false);
  const [workSelectionMode, setWorkSelectionMode] = useState(false);
  const [selectedWorkIds, setSelectedWorkIds] = useState(new Set());
  const [mergeMode, setMergeMode] = useState('existing');
  const [mergeTargetWorkId, setMergeTargetWorkId] = useState('');
  const [mergeTitle, setMergeTitle] = useState('');
  const [isMergingWorks, setIsMergingWorks] = useState(false);
  const [showLinkWorkModal, setShowLinkWorkModal] = useState(false);
  const [trackToLink, setTrackToLink] = useState(null);
  const [bulkTrackLinkSelectionMode, setBulkTrackLinkSelectionMode] = useState(false);
  const [selectedTrackKeysToLink, setSelectedTrackKeysToLink] = useState(new Set());
  const [composerSearch, setComposerSearch] = useState('');
  const [composerResults, setComposerResults] = useState([]);
  const [searchingComposer, setSearchingComposer] = useState(false);
  const [selectedComposer, setSelectedComposer] = useState(null);
  const [composerWorks, setComposerWorks] = useState([]);
  const [workSearch, setWorkSearch] = useState('');
  const [selectedWork, setSelectedWork] = useState(null);
  const [selectedPart, setSelectedPart] = useState(null);
  const [bulkPartTitle, setBulkPartTitle] = useState('');
  const [linkingTrack, setLinkingTrack] = useState(false);
  const [disconnectingTrackKey, setDisconnectingTrackKey] = useState(null);
  const [disconnectingWorkTrackKey, setDisconnectingWorkTrackKey] = useState(null);
  const [discogsUrl, setDiscogsUrl] = useState('');
  const [importingDiscogs, setImportingDiscogs] = useState(false);
  const [discogsPreview, setDiscogsPreview] = useState(null);
  const [showDiscogsPreviewModal, setShowDiscogsPreviewModal] = useState(false);
  const [discogsTrackMatches, setDiscogsTrackMatches] = useState([]);
  const [discogsLinkAllToAlbumWork, setDiscogsLinkAllToAlbumWork] = useState(false);
  const [discogsExcludedCreditKeys, setDiscogsExcludedCreditKeys] = useState(new Set());
  const [discogsSearchQuery, setDiscogsSearchQuery] = useState('');
  const [searchingDiscogs, setSearchingDiscogs] = useState(false);
  const [discogsSearchResults, setDiscogsSearchResults] = useState([]);
  const [showDiscogsSearchModal, setShowDiscogsSearchModal] = useState(false);
  
  // Sync local state when prop changes
  useEffect(() => {
    setTracks(initialTracks);
  }, [initialTracks]);
  
  // Sync album data when prop changes
  useEffect(() => {
    setAlbumData(album);
  }, [album]);

  useEffect(() => {
    setWorkSelectionMode(false);
    setSelectedWorkIds(new Set());
    setMergeMode('existing');
    setMergeTargetWorkId('');
    setMergeTitle('');
    setIsMergingWorks(false);
  }, [album?.ratingKey]);
  
  const handleRatingChange = async (trackRatingKey, newRating) => {
    try {
      console.log('📊 Setting rating:', { trackRatingKey, rating: newRating });
      
      const response = await fetch(`${config.apiBaseUrl}/api/music/tracks/${trackRatingKey}/rating`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rating: newRating }),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Rating updated successfully:', data.track.userRating);
        // Update local state with new rating
        setTracks(prevTracks =>
          prevTracks.map(t =>
            t.ratingKey === trackRatingKey
              ? { ...t, userRating: data.track.userRating }
              : t
          )
        );
      } else {
        console.error('Failed to update rating:', await response.text());
      }
    } catch (error) {
      console.error('Error updating rating:', error);
    }
  };
  
  const handleAlbumUpdate = (updatedAlbum) => {
    setAlbumData(updatedAlbum);
    console.log('Album updated with MusicBrainz metadata:', updatedAlbum);

    const refreshAlbumAndTracks = async () => {
      try {
        const [albumRes, tracksRes] = await Promise.all([
          fetch(`${config.apiBaseUrl}/api/music/albums/${album.ratingKey}`),
          fetch(`${config.apiBaseUrl}/api/music/tracks/album/${album.ratingKey}`),
        ]);

        if (albumRes.ok) {
          const refreshedAlbum = await albumRes.json();
          setAlbumData(refreshedAlbum);
        }

        if (tracksRes.ok) {
          const refreshedTracks = await tracksRes.json();
          setTracks(refreshedTracks);
        }
      } catch (error) {
        console.error('Error refreshing album after identification:', error);
      }
    };

    refreshAlbumAndTracks();
  };

  const refreshAlbumAndTracks = async () => {
    try {
      const [albumRes, tracksRes] = await Promise.all([
        fetch(`${config.apiBaseUrl}/api/music/albums/${album.ratingKey}`),
        fetch(`${config.apiBaseUrl}/api/music/tracks/album/${album.ratingKey}`),
      ]);

      if (albumRes.ok) {
        const refreshedAlbum = await albumRes.json();
        setAlbumData(refreshedAlbum);
      }

      if (tracksRes.ok) {
        const refreshedTracks = await tracksRes.json();
        setTracks(refreshedTracks);
      }
    } catch (error) {
      console.error('Error refreshing album and tracks:', error);
    }
  };

  const handleApplyMbTrackMatchMetadata = async () => {
    const candidateId = mbTrackMatchPreview?.candidate?.id;
    if (!candidateId || isApplyingMbMetadata) {
      return;
    }

    setIsApplyingMbMetadata(true);
    setApplyMbMetadataError(null);

    try {
      const trackMatchOverrides = (mbTrackPreview?.rows || [])
        .filter((row) => row.isManualMatch && row.localTrack?.ratingKey && row.remoteTrack?.recordingId)
        .map((row) => ({
          localTrackKey: row.localTrack.ratingKey,
          recordingId: row.remoteTrack.recordingId
        }));

      // Reuse the release data already fetched during accept to avoid re-hitting the
      // rate-limited MusicBrainz API (which can stall for many seconds on retries).
      const response = await fetch(`${config.apiBaseUrl}/api/identification/apply/${candidateId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: mbTrackMatchPreview?.trackMatchData || null, trackMatchOverrides })
      });

      const data = await response.json();

      if (!data.success) {
        setApplyMbMetadataError(data.error || 'Failed to apply metadata');
        return;
      }

      await refreshAlbumAndTracks();
      setMbTrackMatchPreview(null);
      setManualTrackMatchOverrides({});
      setEditingUnmatchedRowKey(null);
    } catch (error) {
      console.error('Error applying MusicBrainz metadata:', error);
      setApplyMbMetadataError('Failed to apply metadata');
    } finally {
      setIsApplyingMbMetadata(false);
    }
  };

  const handleManualTrackMatchSelect = (localTrackKey, remotePreviewKey) => {
    if (!localTrackKey) return;

    setManualTrackMatchOverrides((prev) => {
      if (!remotePreviewKey) {
        const next = { ...prev };
        delete next[localTrackKey];
        return next;
      }
      return { ...prev, [localTrackKey]: remotePreviewKey };
    });
    setEditingUnmatchedRowKey(null);
  };

  const handleClearManualTrackMatch = (localTrackKey) => {
    if (!localTrackKey) return;

    setManualTrackMatchOverrides((prev) => {
      const next = { ...prev };
      delete next[localTrackKey];
      return next;
    });
  };

  const handleSplitByAlbumId = async () => {
    if (!albumData?.ratingKey || isSplittingByAlbumId) {
      return;
    }

    const confirmed = window.confirm('Split this album by embedded MusicBrainz album IDs? Tracks will be moved to matching albums.');
    if (!confirmed) {
      return;
    }

    try {
      setIsSplittingByAlbumId(true);

      const splitResponse = await fetch(`${config.apiBaseUrl}/api/music/albums/${albumData.ratingKey}/split-by-album-id`, {
        method: 'POST',
      });

      if (!splitResponse.ok) {
        const errorData = await splitResponse.json().catch(() => null);
        throw new Error(errorData?.error || `Failed to split album (${splitResponse.status})`);
      }

      const splitResult = await splitResponse.json();
      const resultData = splitResult?.data || {};

      await refreshAlbumAndTracks();

      const unresolvedCount = resultData?.unresolvedTracks?.length || 0;
      alert(
        `Split complete. Moved ${resultData.movedTrackCount || 0} track(s) across ${resultData.groupsFound || 0} album ID group(s).`
        + (unresolvedCount > 0 ? `\n${unresolvedCount} track(s) could not be classified by album ID.` : '')
      );
    } catch (error) {
      console.error('Error splitting album by album ID:', error);
      alert(`Failed to split album by album ID: ${error.message}`);
    } finally {
      setIsSplittingByAlbumId(false);
    }
  };

  const handleImportFromDiscogs = async () => {
    const normalizedUrl = String(discogsUrl || '').trim();
    if (!normalizedUrl) {
      alert('Enter a Discogs release URL first.');
      return;
    }

    try {
      setImportingDiscogs(true);
      const response = await fetch(`${config.apiBaseUrl}/api/music/albums/${albumData.ratingKey}/discogs-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: normalizedUrl, apply: false })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to import Discogs metadata');
      }

      setDiscogsPreview(result?.data || null);
      setDiscogsTrackMatches(result?.data?.mapping?.defaultTrackMappings || []);
      setDiscogsLinkAllToAlbumWork(false);
      setDiscogsExcludedCreditKeys(new Set());
      setShowDiscogsPreviewModal(true);
    } catch (error) {
      console.error('Error importing Discogs metadata:', error);
      alert(`Discogs import failed: ${error.message}`);
    } finally {
      setImportingDiscogs(false);
    }
  };

  const handleSearchDiscogs = async () => {
    let query = String(discogsSearchQuery || '').trim();
    
    // If no query provided, automatically use album title and artists
    if (!query) {
      const albumArtists = albumData?.albumArtists || [];
      const albumTitle = albumData?.title || '';
      
      // Build search query from album title and artists
      const artistNames = albumArtists
        .map(a => a?.artist?.title || '')
        .filter(name => name)
        .slice(0, 3) // Limit to first 3 artists
        .join(' ');
      
      if (artistNames && albumTitle) {
        query = `${albumTitle} ${artistNames}`;
      } else if (albumTitle) {
        query = albumTitle;
      } else {
        alert('No album information available for search.');
        return;
      }
      
      // Show the search query in the input
      setDiscogsSearchQuery(query);
    }

    try {
      setSearchingDiscogs(true);
      const response = await fetch(`${config.apiBaseUrl}/api/music/discogs-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, limit: 10 })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to search Discogs');
      }

      setDiscogsSearchResults(result?.data?.releases || []);
      setShowDiscogsSearchModal(true);
    } catch (error) {
      console.error('Error searching Discogs:', error);
      alert(`Discogs search failed: ${error.message}`);
    } finally {
      setSearchingDiscogs(false);
    }
  };

  const closeDiscogsSearchModal = () => {
    setShowDiscogsSearchModal(false);
    setDiscogsSearchResults([]);
    setDiscogsSearchQuery('');
  };

  const handleSelectDiscogsRelease = async (release) => {
    // Set the release URL and trigger import
    const releaseUrl = `https://www.discogs.com/release/${release.id}`;
    setDiscogsUrl(releaseUrl);
    closeDiscogsSearchModal();
    
    // Trigger import
    try {
      setImportingDiscogs(true);
      const response = await fetch(`${config.apiBaseUrl}/api/music/albums/${albumData.ratingKey}/discogs-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: releaseUrl, apply: false })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to import Discogs metadata');
      }

      setDiscogsPreview(result?.data || null);
      setDiscogsTrackMatches(result?.data?.mapping?.defaultTrackMappings || []);
      setDiscogsLinkAllToAlbumWork(false);
      setDiscogsExcludedCreditKeys(new Set());
      setShowDiscogsPreviewModal(true);
    } catch (error) {
      console.error('Error importing Discogs metadata:', error);
      alert(`Discogs import failed: ${error.message}`);
    } finally {
      setImportingDiscogs(false);
    }
  };

  const handleDeleteAlbum = async () => {
    const confirmed = window.confirm('Are you sure you want to delete this album? This will permanently remove it and all its tracks.');
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/music/albums/${albumData.ratingKey}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Failed to delete album (${response.status})`);
      }

      alert('Album deleted successfully');
      
      // Navigate back to albums view
      if (onGoBack) {
        onGoBack();
      }
    } catch (error) {
      console.error('Error deleting album:', error);
      alert(`Failed to delete album: ${error.message}`);
    }
  };

  const closeDiscogsPreviewModal = () => {
    setShowDiscogsPreviewModal(false);
    setDiscogsPreview(null);
    setDiscogsTrackMatches([]);
    setDiscogsLinkAllToAlbumWork(false);
    setDiscogsExcludedCreditKeys(new Set());
  };

  const toggleDiscogsExcludedCredit = (creditKey) => {
    const normalizedKey = String(creditKey || '').trim();
    if (!normalizedKey) {
      return;
    }

    setDiscogsExcludedCreditKeys((prev) => {
      const next = new Set(prev);
      if (next.has(normalizedKey)) {
        next.delete(normalizedKey);
      } else {
        next.add(normalizedKey);
      }
      return next;
    });
  };

  const updateDiscogsTrackMatch = (discogsOrdinal, localTrackKey) => {
    setDiscogsTrackMatches((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      const idx = next.findIndex((entry) => entry.discogsOrdinal === discogsOrdinal);
      const payload = {
        discogsOrdinal,
        localTrackKey: localTrackKey || null,
      };

      if (idx >= 0) {
        next[idx] = payload;
      } else {
        next.push(payload);
      }

      return next;
    });
  };

  const handleAcceptDiscogsImport = async () => {
    const normalizedUrl = String(discogsUrl || '').trim();
    if (!normalizedUrl) {
      alert('Discogs URL is required to continue.');
      return;
    }

    const albumWorkTitle = String(discogsPreview?.album?.discogsTitle || albumData?.title || '').trim();
    const trackMappingsPayload = (Array.isArray(discogsTrackMatches) ? discogsTrackMatches : []).map((mapping) => {
      const nextMapping = {
        discogsOrdinal: mapping?.discogsOrdinal,
        localTrackKey: mapping?.localTrackKey || null,
      };

      if (discogsLinkAllToAlbumWork && albumWorkTitle) {
        nextMapping.workTitleHint = albumWorkTitle;
      }

      return nextMapping;
    });

    try {
      setImportingDiscogs(true);
      const response = await fetch(`${config.apiBaseUrl}/api/music/albums/${albumData.ratingKey}/discogs-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: normalizedUrl,
          apply: true,
          trackMappings: trackMappingsPayload,
          excludedCreditKeys: [...discogsExcludedCreditKeys],
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to apply Discogs import');
      }

      await refreshAlbumAndTracks();
      closeDiscogsPreviewModal();

      const discogsMeta = result?.data?.discogs;
      if (discogsMeta) {
        alert(
          `Discogs import complete. Updated ${discogsMeta.mappedTrackCount || 0} track(s)`
          + ` and linked ${discogsMeta.linkedWorkTrackCount || 0} track(s) into works.`
        );
      }
    } catch (error) {
      console.error('Error applying Discogs metadata:', error);
      alert(`Discogs import failed: ${error.message}`);
    } finally {
      setImportingDiscogs(false);
    }
  };

  const formatMilliseconds = (value) => {
    const ms = Number(value);
    if (!Number.isFinite(ms) || ms <= 0) {
      return null;
    }

    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  const mbTrackPreview = useMemo(() => {
    if (!mbTrackMatchPreview) return null;
    return buildTrackPreview(tracks, mbTrackMatchPreview.trackMatchData, manualTrackMatchOverrides);
  }, [tracks, mbTrackMatchPreview, manualTrackMatchOverrides]);

  const discogsImportArtistsPreview = useMemo(() => {
    const selectedOrdinals = new Set(
      (Array.isArray(discogsTrackMatches) ? discogsTrackMatches : [])
        .filter((mapping) => mapping?.localTrackKey)
        .map((mapping) => Number.parseInt(mapping?.discogsOrdinal, 10))
        .filter((ordinal) => Number.isInteger(ordinal))
    );
    const creditOptions = (Array.isArray(discogsPreview?.discogs?.creditOptions) ? discogsPreview.discogs.creditOptions : [])
      .filter((credit) => {
        if (credit?.source === 'album') {
          return true;
        }

        const ordinal = Number.parseInt(credit?.discogsOrdinal, 10);
        return Number.isInteger(ordinal) && selectedOrdinals.has(ordinal);
      })
      .map((credit) => {
        const sourceLabel = credit?.source === 'album'
          ? 'Album'
          : `Track #${Number.isInteger(credit?.discogsOrdinal) ? credit.discogsOrdinal : '?'}`;

        return {
          creditKey: String(credit?.creditKey || '').trim(),
          artistName: String(credit?.artistName || '').trim(),
          artistTypeName: String(credit?.artistTypeName || 'Performer').trim() || 'Performer',
          source: credit?.source === 'album' ? 'album' : 'track',
          sourceLabel,
          discogsOrdinal: Number.isInteger(credit?.discogsOrdinal) ? credit.discogsOrdinal : null,
          discogsTrackTitle: String(credit?.discogsTrackTitle || '').trim() || null,
          matchedExisting: Boolean(credit?.matchedExisting),
          willCreateArtist: Boolean(credit?.willCreateArtist),
          matchedArtist: credit?.matchedArtist || null,
          matchKind: credit?.matchKind || null,
          excluded: discogsExcludedCreditKeys.has(String(credit?.creditKey || '').trim()),
        };
      })
      .sort((left, right) => {
        if (left.source !== right.source) {
          return left.source.localeCompare(right.source);
        }

        if (left.source === 'track' || right.source === 'track') {
          const ordinalSort = (left.discogsOrdinal || 0) - (right.discogsOrdinal || 0);
          if (ordinalSort !== 0) {
            return ordinalSort;
          }
        }

        const nameSort = left.artistName.localeCompare(right.artistName);
        if (nameSort !== 0) {
          return nameSort;
        }
        return left.artistTypeName.localeCompare(right.artistTypeName);
      });

    const includedCreditCount = creditOptions.filter((credit) => !credit.excluded).length;
    const matchedExistingCount = creditOptions.filter((credit) => !credit.excluded && credit.matchedExisting).length;
    const newArtistCount = creditOptions.filter((credit) => !credit.excluded && !credit.matchedExisting).length;

    return {
      selectedTrackCount: selectedOrdinals.size,
      creditOptions,
      includedCreditCount,
      matchedExistingCount,
      newArtistCount,
    };
  }, [discogsPreview, discogsTrackMatches, discogsExcludedCreditKeys]);

  const inferDiscNumberFromTrack = inferLocalDiscNumber;

  const formatTrackNumberLabel = (track, fallbackIndex) => {
    const trackNumber = Number.isInteger(track?.trackNumber)
      ? track.trackNumber
      : (Number.isInteger(track?.index) ? track.index : fallbackIndex);
    const discNumber = inferDiscNumberFromTrack(track);

    if (discNumber && discNumber > 1 && trackNumber) {
      return `D${discNumber}-T${trackNumber}`;
    }

    return trackNumber || fallbackIndex;
  };

  const sortAlbumTracks = (left, right) => {
    const leftDisc = inferDiscNumberFromTrack(left) || Number.MAX_SAFE_INTEGER;
    const rightDisc = inferDiscNumberFromTrack(right) || Number.MAX_SAFE_INTEGER;

    if (leftDisc !== rightDisc) {
      return leftDisc - rightDisc;
    }

    const leftTrack = Number.isInteger(left?.trackNumber)
      ? left.trackNumber
      : (Number.isInteger(left?.index) ? left.index : Number.MAX_SAFE_INTEGER);
    const rightTrack = Number.isInteger(right?.trackNumber)
      ? right.trackNumber
      : (Number.isInteger(right?.index) ? right.index : Number.MAX_SAFE_INTEGER);

    if (leftTrack !== rightTrack) {
      return leftTrack - rightTrack;
    }

    const leftIndex = Number.isInteger(left?.index) ? left.index : Number.MAX_SAFE_INTEGER;
    const rightIndex = Number.isInteger(right?.index) ? right.index : Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  };

  const buildTrackGroups = (trackList) => {
    const sortedTracks = [...(trackList || [])].sort(sortAlbumTracks);

    const groups = [];
    const groupMap = new Map();

    for (const track of sortedTracks) {
      const workId = track.work?.id || null;
      const workTitle = track.work?.title || 'Standalone Tracks';
      const discNumber = inferDiscNumberFromTrack(track) || 1;
      const groupKey = workId ? `disc-${discNumber}-work-${workId}` : `disc-${discNumber}-standalone-${track.ratingKey}`;

      if (!groupMap.has(groupKey)) {
        const group = {
          key: groupKey,
          workId,
          title: workTitle,
          discNumber,
          tracks: []
        };

        groupMap.set(groupKey, group);
        groups.push(group);
      }

      groupMap.get(groupKey).tracks.push(track);
    }

    return groups;
  };

  const trackGroups = buildTrackGroups(tracks);
  const albumDiscNumbers = new Set(trackGroups.map((group) => group.discNumber));
  const albumHasMultipleDiscs = albumDiscNumbers.size > 1;
  const albumWorks = trackGroups
    .filter((group) => group.workId)
    .map((group) => ({ id: group.workId, title: group.title, tracksCount: group.tracks.length }));

  useEffect(() => {
    if (!workSelectionMode || mergeMode !== 'existing') return;

    const selectedIds = [...selectedWorkIds];
    if (selectedIds.length === 0) {
      setMergeTargetWorkId('');
      return;
    }

    if (!selectedIds.includes(parseInt(mergeTargetWorkId, 10))) {
      setMergeTargetWorkId(String(selectedIds[0]));
    }
  }, [workSelectionMode, mergeMode, selectedWorkIds, mergeTargetWorkId]);

  const toggleWorkSelection = (workId) => {
    setSelectedWorkIds((prev) => {
      const next = new Set(prev);
      if (next.has(workId)) {
        next.delete(workId);
      } else {
        next.add(workId);
      }
      return next;
    });
  };

  const handleMergeSelectedWorks = async () => {
    if (!onMergeWorks) return;

    const sourceWorkIds = [...selectedWorkIds];
    if (sourceWorkIds.length < 2) {
      alert('Select at least two works to merge.');
      return;
    }

    const payload = {
      sourceWorkIds,
      targetWorkId: null,
      targetTitle: null,
      refreshContext: 'album'
    };

    if (mergeMode === 'existing') {
      const parsedTarget = parseInt(mergeTargetWorkId, 10);
      if (!Number.isInteger(parsedTarget) || !selectedWorkIds.has(parsedTarget)) {
        alert('Select a target work from the selected works.');
        return;
      }
      payload.targetWorkId = parsedTarget;
    } else {
      if (!mergeTitle.trim()) {
        alert('Enter a title for the new merged work.');
        return;
      }
      payload.targetTitle = mergeTitle.trim();
    }

    const confirmed = window.confirm(
      `Merge ${sourceWorkIds.length} album works into ${mergeMode === 'existing' ? 'the selected work' : 'a new work'}?`
    );
    if (!confirmed) return;

    try {
      setIsMergingWorks(true);
      const result = await onMergeWorks(payload);
      if (!result?.success) return;

      const mergedTitle = result?.data?.destinationWorkTitle || 'merged work';
      alert(`Works merged successfully into "${mergedTitle}".`);
      setWorkSelectionMode(false);
      setSelectedWorkIds(new Set());
      setMergeMode('existing');
      setMergeTargetWorkId('');
      setMergeTitle('');
    } finally {
      setIsMergingWorks(false);
    }
  };

  const searchComposers = async (query) => {
    if (!query || query.trim().length < 2) {
      setComposerResults([]);
      return;
    }

    try {
      setSearchingComposer(true);
      const response = await fetch(
        `${config.apiBaseUrl}/api/music/artists?search=${encodeURIComponent(query.trim())}&limit=10`
      );
      if (!response.ok) {
        throw new Error('Failed to search composers');
      }

      const result = await response.json();
      setComposerResults(result.artists || result || []);
    } catch (error) {
      console.error('Error searching composers:', error);
    } finally {
      setSearchingComposer(false);
    }
  };

  const loadWorksForComposer = async (composerKey) => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/works`);
      if (!response.ok) {
        throw new Error('Failed to load works');
      }

      const result = await response.json();
      const allWorks = result.data || [];
      setComposerWorks(allWorks.filter((work) => work.composerKey === composerKey));
    } catch (error) {
      console.error('Error loading works for composer:', error);
      alert(`Error loading works: ${error.message}`);
    }
  };

  const openLinkWorkModal = (track) => {
    setTrackToLink(track);
    setShowLinkWorkModal(true);
    setComposerSearch('');
    setComposerResults([]);
    setSearchingComposer(false);
    setSelectedComposer(null);
    setComposerWorks([]);
    setWorkSearch('');
    setSelectedWork(null);
    setSelectedPart(null);
    setBulkPartTitle('');
    setLinkingTrack(false);
  };

  const openBulkLinkWorkModal = () => {
    const selectedKeys = [...selectedTrackKeysToLink];
    if (selectedKeys.length === 0) {
      alert('Select one or more tracks to bulk link.');
      return;
    }

    setTrackToLink(null);
    setShowLinkWorkModal(true);
    setComposerSearch('');
    setComposerResults([]);
    setSearchingComposer(false);
    setSelectedComposer(null);
    setComposerWorks([]);
    setWorkSearch('');
    setSelectedWork(null);
    setSelectedPart(null);
    setBulkPartTitle(`${albumData?.title || album?.title || 'Album'} - Selected Tracks`);
    setLinkingTrack(false);
  };

  const closeLinkWorkModal = () => {
    setShowLinkWorkModal(false);
    setTrackToLink(null);
    setComposerSearch('');
    setComposerResults([]);
    setSelectedComposer(null);
    setComposerWorks([]);
    setWorkSearch('');
    setSelectedWork(null);
    setSelectedPart(null);
    setBulkPartTitle('');
  };

  const toggleTrackForBulkLink = (trackKey) => {
    setSelectedTrackKeysToLink((prev) => {
      const next = new Set(prev);
      if (next.has(trackKey)) {
        next.delete(trackKey);
      } else {
        next.add(trackKey);
      }
      return next;
    });
  };

  const toggleBulkTrackLinkSelectionMode = () => {
    setBulkTrackLinkSelectionMode((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedTrackKeysToLink(new Set());
      }
      return next;
    });
  };

  const handleSelectAllTracksForBulkLink = () => {
    const allTrackKeys = (tracks || [])
      .map((track) => String(track?.ratingKey || '').trim())
      .filter(Boolean);

    setSelectedTrackKeysToLink(new Set(allTrackKeys));
  };

  const handleClearSelectedTracksForBulkLink = () => {
    setSelectedTrackKeysToLink(new Set());
  };

  const handleSelectComposer = async (composer) => {
    setSelectedComposer(composer);
    setComposerSearch(composer.title || '');
    setComposerResults([]);
    setSelectedWork(null);
    setSelectedPart(null);
    await loadWorksForComposer(composer.ratingKey);
  };

  const handleLinkTrackToWork = async () => {
    if (!trackToLink || !selectedWork || !selectedPart) return;

    try {
      setLinkingTrack(true);
      const response = await fetch(
        `${config.apiBaseUrl}/api/works/${selectedWork.id}/parts/${selectedPart.id}/tracks`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackKey: trackToLink.ratingKey })
        }
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to link track to work part');
      }

      await refreshAlbumAndTracks();
      closeLinkWorkModal();
    } catch (error) {
      console.error('Error linking track to work:', error);
      alert(`Error linking track to work: ${error.message}`);
    } finally {
      setLinkingTrack(false);
    }
  };

  const handleBulkLinkTracksToWork = async () => {
    const selectedTrackKeys = [...selectedTrackKeysToLink];
    if (!selectedWork || selectedTrackKeys.length === 0) return;

    try {
      setLinkingTrack(true);
      const response = await fetch(
        `${config.apiBaseUrl}/api/works/${selectedWork.id}/bulk-link-tracks`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trackKeys: selectedTrackKeys,
            partTitle: bulkPartTitle
          })
        }
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to bulk link tracks to work');
      }

      await refreshAlbumAndTracks();
      setBulkTrackLinkSelectionMode(false);
      setSelectedTrackKeysToLink(new Set());
      closeLinkWorkModal();
    } catch (error) {
      console.error('Error bulk linking tracks to work:', error);
      alert(`Error bulk linking tracks to work: ${error.message}`);
    } finally {
      setLinkingTrack(false);
    }
  };

  const handleDisconnectTrackFromAlbum = async (track) => {
    if (!track?.ratingKey) return;

    const confirmed = window.confirm(`Disconnect "${track.title || 'this track'}" from this album?`);
    if (!confirmed) return;

    try {
      setDisconnectingTrackKey(track.ratingKey);
      const response = await fetch(`${config.apiBaseUrl}/api/music/tracks/${track.ratingKey}/disconnect-album`, {
        method: 'POST'
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to disconnect track from album');
      }

      await refreshAlbumAndTracks();
    } catch (error) {
      console.error('Error disconnecting track from album:', error);
      alert(`Error disconnecting track: ${error.message}`);
    } finally {
      setDisconnectingTrackKey(null);
    }
  };

  const handleDisconnectTrackFromWork = async (track) => {
    if (!track?.ratingKey) return;

    const confirmed = window.confirm(`Disconnect "${track.title || 'this track'}" from its work?`);
    if (!confirmed) return;

    try {
      setDisconnectingWorkTrackKey(track.ratingKey);
      const response = await fetch(`${config.apiBaseUrl}/api/works/tracks/${track.ratingKey}/disconnect`, {
        method: 'DELETE'
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to disconnect track from work');
      }

      await refreshAlbumAndTracks();
    } catch (error) {
      console.error('Error disconnecting track from work:', error);
      alert(`Error disconnecting track from work: ${error.message}`);
    } finally {
      setDisconnectingWorkTrackKey(null);
    }
  };

  const filteredComposerWorks = composerWorks.filter((work) => {
    const query = workSearch.trim().toLowerCase();
    if (!query) return true;
    return (work.title || '').toLowerCase().includes(query);
  });

  const albumContributors = (albumData?.albumArtists || album?.albumArtists || [])
    .filter((entry) => entry?.artist && entry?.artistType)
    .sort((left, right) => {
      const leftType = left.artistType?.name || '';
      const rightType = right.artistType?.name || '';
      if (leftType !== rightType) {
        return leftType.localeCompare(rightType);
      }

      const leftName = left.artist?.title || '';
      const rightName = right.artist?.title || '';
      return leftName.localeCompare(rightName);
    });

  return (
    <div className="album-detail">
      {/* Header with Back Button */}
      <div className="album-detail-header">
        <button className="back-button" onClick={onGoBack}>
          ← {backLabel}
        </button>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="url"
            value={discogsUrl}
            onChange={(event) => setDiscogsUrl(event.target.value)}
            placeholder="https://www.discogs.com/release/..."
            style={{
              minWidth: '260px',
              padding: '0.45rem 0.6rem',
              borderRadius: '0.375rem',
              border: '1px solid #4b5563',
              backgroundColor: '#111827',
              color: '#f9fafb'
            }}
          />
          <button
            className="musicbrainz-search-btn"
            onClick={handleSearchDiscogs}
            disabled={searchingDiscogs}
            title="Search Discogs for releases"
            style={{ backgroundColor: '#0f766e', opacity: searchingDiscogs ? 0.7 : 1 }}
          >
            {searchingDiscogs ? '⏳ Searching Discogs...' : '🔍 Search Discogs'}
          </button>
          <button
            className="musicbrainz-search-btn"
            onClick={handleImportFromDiscogs}
            disabled={importingDiscogs}
            title="Import album, track, and work metadata from a Discogs release URL"
            style={{ backgroundColor: '#0f766e', opacity: importingDiscogs ? 0.7 : 1 }}
          >
            {importingDiscogs ? '⏳ Importing Discogs...' : '🧾 Import Discogs URL'}
          </button>
          <button
            className="musicbrainz-search-btn"
            onClick={() => {
              if (!tracks || !tracks.length) return;
              const playlist = {
                id: `tracks-playlist-album-${album.ratingKey}`,
                title: albumData.title,
                tracks: tracks.map(track => ({
                  id: track.ratingKey,
                  ratingKey: track.ratingKey,
                  title: track.title,
                  artist: track.originalTitle || albumData.parentTitle || albumData.artist?.title || 'Unknown Artist',
                  album: track.parentTitle || albumData.title || 'Unknown Album',
                  duration: track.duration,
                  thumb: track.thumb,
                  art: track.art,
                  parentThumb: albumData.thumb || track.parentThumb,
                  grandparentThumb: albumData.artist?.thumb || track.grandparentThumb,
                  userRating: track.userRating,
                  rating: track.rating,
                  type: 'plex',
                  grandparentRatingKey: track.grandparentRatingKey || albumData.artist?.ratingKey,
                  parentRatingKey: track.parentRatingKey || albumData.ratingKey,
                  grandparentTitle: track.grandparentTitle || albumData.parentTitle || albumData.artist?.title,
                  parentTitle: track.parentTitle || albumData.title,
                }))
              };
              window.dispatchEvent(new CustomEvent('startMusicPlayback', {
                detail: { playlist, shuffle: false, sessionId: `album-session-${Date.now()}` }
              }));
            }}
            disabled={!tracks || !tracks.length}
            title="Play all tracks in this album"
            style={{ backgroundColor: '#16a34a' }}
          >
            ▶ Play All
          </button>
          <button 
            className="musicbrainz-search-btn"
            onClick={() => setShowIdentifyModal(true)}
            title="Identify album with MusicBrainz"
            style={{ backgroundColor: '#3b82f6' }}
          >
            🔍 Identify Album
          </button>
          <button
            className="musicbrainz-search-btn"
            onClick={handleSplitByAlbumId}
            disabled={isSplittingByAlbumId}
            title="Split merged tracks into albums by embedded MusicBrainz album ID"
            style={{ backgroundColor: '#b45309', opacity: isSplittingByAlbumId ? 0.7 : 1 }}
          >
            {isSplittingByAlbumId ? '⏳ Splitting...' : '🧩 Split By Album ID'}
          </button>
          <button 
            className="musicbrainz-search-btn"
            onClick={() => setIsEditMode(!isEditMode)}
            title="Edit album metadata"
            style={{ backgroundColor: isEditMode ? '#10b981' : '#8b5cf6' }}
          >
            {isEditMode ? '✓ Done' : '✏️ Edit Metadata'}
          </button>
          <button 
            className="musicbrainz-search-btn"
            onClick={handleDeleteAlbum}
            title="Delete album (only if no tracks are linked)"
            style={{ backgroundColor: '#ef4444' }}
          >
            🗑️ Delete Album
          </button>
        </div>
      </div>

      {/* Album Info Section */}
      <div className="album-info">
        {album.thumb && (
          <div className="album-artwork">
            <img 
              src={`${config.plexUrl}${album.thumb}?X-Plex-Token=${config.plexToken}`}
              alt={album.title}
              onError={(e) => {
                console.error('Album artwork failed to load');
                e.target.style.display = 'none';
              }}
            />
          </div>
        )}
        
        <div className="album-metadata">
          {/* Identification Status Badge */}
          {albumData.identificationStatus && (
            <div style={{ marginBottom: '1rem' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.25rem 0.75rem',
                borderRadius: '0.25rem',
                fontSize: '0.875rem',
                backgroundColor: albumData.identificationStatus === 'identified' ? '#065f46' : 
                                albumData.identificationStatus === 'pending_review' ? '#78350f' :
                                albumData.identificationStatus === 'manual' ? '#581c87' : '#374151',
                color: albumData.identificationStatus === 'identified' ? '#d1fae5' :
                      albumData.identificationStatus === 'pending_review' ? '#fde68a' :
                      albumData.identificationStatus === 'manual' ? '#e9d5ff' : '#d1d5db'
              }}>
                {albumData.identificationStatus === 'identified' && '✓ Identified'}
                {albumData.identificationStatus === 'pending_review' && '⏳ Pending Review'}
                {albumData.identificationStatus === 'unidentified' && 'Not Identified'}
                {albumData.identificationStatus === 'manual' && '✏️ Manual Entry'}
                {albumData.identificationConfidence && ` (${Math.round(albumData.identificationConfidence * 100)}% match)`}
              </span>
            </div>
          )}

          {/* Metadata Editing Mode */}
          {isEditMode ? (
            <div style={{ 
              backgroundColor: '#1f2937', 
              padding: '1.5rem', 
              borderRadius: '0.5rem',
              marginBottom: '1.5rem'
            }}>
              <MetadataEditor
                entityType="album"
                entityKey={album.ratingKey}
                field="title"
                label="Album Title"
                currentValue={albumData.title}
                onUpdate={(val) => setAlbumData({ ...albumData, title: val })}
              />
              <MetadataEditor
                entityType="album"
                entityKey={album.ratingKey}
                field="releaseDate"
                label="Release Date"
                currentValue={albumData.originallyAvailableAt || albumData.year?.toString()}
                onUpdate={(val) => setAlbumData({ ...albumData, originallyAvailableAt: val })}
              />
              <MetadataEditor
                entityType="album"
                entityKey={album.ratingKey}
                field="label"
                label="Record Label"
                currentValue={albumData.studio}
                onUpdate={(val) => setAlbumData({ ...albumData, studio: val })}
              />
            </div>
          ) : (
            <>
              <h1 className="album-title">{albumData.title}</h1>
              <p 
                className="album-artist"
                onClick={() => {
                  if (album.parentRatingKey && onSelectArtist) {
                    onSelectArtist({ ratingKey: album.parentRatingKey, title: album.parentTitle });
                  }
                }}
                style={{
                  cursor: onSelectArtist && album.parentRatingKey ? 'pointer' : 'default',
                  color: onSelectArtist && album.parentRatingKey ? '#007bff' : '#666'
                }}
                title={onSelectArtist && album.parentRatingKey ? `View ${album.parentTitle || 'artist'}'s albums` : ''}
                onMouseEnter={(e) => {
                  if (onSelectArtist && album.parentRatingKey) {
                    e.target.style.textDecoration = 'underline';
                  }
                }}
                onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
              >
                {album.parentTitle || album.artist?.title || 'Various Artists'}
              </p>

              {albumContributors.length > 0 && (
                <div className="album-contributors">
                  <div className="album-contributors-label">Album Contributors</div>
                  <div className="album-contributors-list">
                    {albumContributors.map((entry) => (
                      <div
                        key={`${entry.albumKey || albumData.ratingKey}-${entry.artistKey}-${entry.artistTypeId}`}
                        className="album-contributor-row"
                      >
                        <span className="album-contributor-type">{entry.artistType.name}:</span>
                        <button
                          type="button"
                          className="album-contributor-link"
                          onClick={() => onSelectArtist && onSelectArtist(entry.artist)}
                          disabled={!onSelectArtist}
                          title={onSelectArtist ? `View ${entry.artist.title}` : entry.artist.title}
                        >
                          {entry.artist.title}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          
          <div className="album-details">
            {album.year && <span className="album-year">{album.year}</span>}
            {tracks && tracks.length > 0 && (
              <span className="album-track-count">{tracks.length} track{tracks.length !== 1 ? 's' : ''}</span>
            )}
            {album.totalPlayCount !== undefined && album.totalPlayCount > 0 && (
              <span className="album-play-count">• {album.totalPlayCount} {album.totalPlayCount === 1 ? 'play' : 'plays'}</span>
            )}
            {(albumData.musicBrainzId || album.musicBrainzId) && (
              <span className="album-mbid">
                • <a 
                  href={`https://musicbrainz.org/release/${albumData.musicBrainzId || album.musicBrainzId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mbid-link"
                  title="View release on MusicBrainz"
                >
                  🏷️ MusicBrainz
                </a>
              </span>
            )}
          </div>

          {console.log('Album MusicBrainz ID:', albumData.musicBrainzId, album.musicBrainzId)}

          {album.summary && (
            <p className="album-summary">{album.summary}</p>
          )}

          <EmbeddedPicardTagsPanel entityType="album" entityKey={album.ratingKey} dark />
        </div>
      </div>

      {/* Playlist Player */}
      {tracks && tracks.length > 0 && (
        <TracksPlaylistPlayer
          tracks={tracks}
          selectedSection={selectedSection}
          searchQuery=""
          onPlayTrack={onPlayTrack}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          selectedAlbum={album}
          selectedArtist={null}
        />
      )}

      {albumWorks.length > 0 && (
        <div className="album-works-panel">
          <div className="album-works-header">
            <h2>Works In This Album</h2>
            <button
              type="button"
              className="album-works-select-btn"
              onClick={() => {
                const next = !workSelectionMode;
                setWorkSelectionMode(next);
                if (!next) {
                  setSelectedWorkIds(new Set());
                  setMergeTargetWorkId('');
                  setMergeTitle('');
                  setMergeMode('existing');
                }
              }}
            >
              {workSelectionMode ? 'Cancel Merge Selection' : 'Merge Works'}
            </button>
          </div>

          {workSelectionMode && (
            <div className="album-works-merge-row">
              <span>{selectedWorkIds.size} selected</span>
              <select
                value={mergeMode}
                onChange={(event) => setMergeMode(event.target.value)}
                className="album-works-merge-select"
              >
                <option value="existing">Merge into selected work</option>
                <option value="new">Merge into new parent work</option>
              </select>

              {mergeMode === 'existing' ? (
                <select
                  value={mergeTargetWorkId}
                  onChange={(event) => setMergeTargetWorkId(event.target.value)}
                  className="album-works-merge-select"
                >
                  <option value="">Select target work</option>
                  {[...selectedWorkIds].map((workId) => {
                    const work = albumWorks.find((entry) => entry.id === workId);
                    return (
                      <option key={workId} value={workId}>
                        {work?.title || `Work ${workId}`}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <input
                  type="text"
                  value={mergeTitle}
                  onChange={(event) => setMergeTitle(event.target.value)}
                  placeholder="New merged work title"
                  className="album-works-merge-input"
                />
              )}

              <button
                type="button"
                className="album-works-merge-confirm"
                onClick={handleMergeSelectedWorks}
                disabled={selectedWorkIds.size < 2 || isMergingWorks}
              >
                {isMergingWorks ? 'Merging...' : 'Merge Selected'}
              </button>
            </div>
          )}

          <div className="album-works-list">
            {albumWorks.map((work) => (
              <button
                type="button"
                key={`album-work-${work.id}`}
                className="album-work-item"
                onClick={() => {
                  if (workSelectionMode) {
                    toggleWorkSelection(work.id);
                    return;
                  }
                }}
              >
                {workSelectionMode && (
                  <span className="album-work-checkbox" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedWorkIds.has(work.id)}
                      onChange={() => toggleWorkSelection(work.id)}
                    />
                  </span>
                )}
                <span className="album-work-item-title">{work.title}</span>
                <span className="album-work-item-meta">{work.tracksCount} track{work.tracksCount !== 1 ? 's' : ''}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tracks List */}
      <div className="album-tracks">
        <div className="album-works-header">
          <h2>Tracks</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="album-works-select-btn"
              onClick={toggleBulkTrackLinkSelectionMode}
            >
              {bulkTrackLinkSelectionMode ? 'Cancel Track Selection' : 'Select Tracks To Link'}
            </button>
            {bulkTrackLinkSelectionMode && (
              <>
                <button
                  type="button"
                  className="album-works-select-btn"
                  onClick={handleSelectAllTracksForBulkLink}
                  disabled={!tracks || tracks.length === 0}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="album-works-select-btn"
                  onClick={handleClearSelectedTracksForBulkLink}
                  disabled={selectedTrackKeysToLink.size === 0}
                >
                  Clear All
                </button>
                <button
                  type="button"
                  className="album-works-merge-confirm"
                  onClick={openBulkLinkWorkModal}
                  disabled={selectedTrackKeysToLink.size === 0}
                >
                  Link Selected ({selectedTrackKeysToLink.size})
                </button>
              </>
            )}
          </div>
        </div>

        {mbTrackMatchPreview && (
          <div className="mb-track-match-preview">
            <div className="mb-track-match-preview-header">
              <div>
                <h3>MusicBrainz Track Matches</h3>
                <p>
                  Pulled from &ldquo;{mbTrackMatchPreview.trackMatchData?.title || 'Unknown release'}&rdquo; — existing tracks are matched to the pulled MusicBrainz tracks below.
                </p>
                {applyMbMetadataError && (
                  <p className="mb-track-match-apply-error">{applyMbMetadataError}</p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button
                  type="button"
                  className="album-works-select-btn"
                  onClick={() => {
                    setMbTrackMatchPreview(null);
                    setManualTrackMatchOverrides({});
                    setEditingUnmatchedRowKey(null);
                  }}
                  disabled={isApplyingMbMetadata}
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  className="album-works-merge-confirm"
                  onClick={handleApplyMbTrackMatchMetadata}
                  disabled={isApplyingMbMetadata}
                >
                  {isApplyingMbMetadata ? 'Applying…' : 'Apply Metadata'}
                </button>
              </div>
            </div>

            <div className="mb-track-match-columns">
              <div className="mb-track-match-column-label">Existing Track</div>
              <div className="mb-track-match-column-label">Pulled MusicBrainz Track</div>

              {(() => {
                let lastDiscNumber = null;
                return (mbTrackPreview?.rows || []).map((row, index) => {
                  const localMs = Number(row.localTrack?.duration);
                  const remoteMs = Number(row.remoteTrack?.length);
                  const hasBothLengths = Number.isFinite(localMs) && localMs > 0 && Number.isFinite(remoteMs) && remoteMs > 0;
                  const isLengthMismatch = Boolean(row.remoteTrack) && hasBothLengths && Math.abs(localMs - remoteMs) > 10000;
                  const matchedCellClass = row.remoteTrack ? (isLengthMismatch ? 'matched matched-length-mismatch' : 'matched') : '';
                  const rowKey = row.localTrack?.ratingKey || `row-${index}`;
                  const remoteDiscNumber = row.remoteTrack?.discNumber || null;
                  const showDiscHeader = Boolean(remoteDiscNumber) && remoteDiscNumber !== lastDiscNumber;
                  if (remoteDiscNumber) {
                    lastDiscNumber = remoteDiscNumber;
                  }
                  const isEditingMatch = editingUnmatchedRowKey === rowKey;
                  const hasUnmatchedOptions = (mbTrackPreview?.unmatchedRemoteTracks || []).length > 0;

                  return (
                    <React.Fragment key={rowKey}>
                      {showDiscHeader && (
                        <div className="mb-track-match-disc-header">Disc {remoteDiscNumber}</div>
                      )}
                      <div className="mb-track-match-cell">
                        <div className="mb-track-match-cell-title">
                          {row.localTrack ? `${row.localTrack.index || index + 1}. ${row.localTrack.title || 'Untitled'}` : 'No existing track'}
                        </div>
                        {formatMilliseconds(row.localTrack?.duration) && (
                          <div className="mb-track-match-cell-meta">Length: {formatMilliseconds(row.localTrack.duration)}</div>
                        )}
                        {row.localTrack?.musicBrainzTrackId && (
                          <div className="mb-track-match-cell-meta">MB Recording ID: {row.localTrack.musicBrainzTrackId}</div>
                        )}
                      </div>
                      <div className={`mb-track-match-cell ${matchedCellClass}`}>
                        {row.remoteTrack ? (
                          <>
                            <div className="mb-track-match-cell-title">
                              {row.remoteTrack.trackNumber || index + 1}. {row.remoteTrack.title}
                            </div>
                            {formatMilliseconds(row.remoteTrack.length) && (
                              <div className="mb-track-match-cell-meta">Length: {formatMilliseconds(row.remoteTrack.length)}</div>
                            )}
                            {row.remoteTrack.recordingId && (
                              <div className="mb-track-match-cell-meta">MB Recording ID: {row.remoteTrack.recordingId}</div>
                            )}
                            {isLengthMismatch && (
                              <div className="mb-track-match-cell-meta mb-track-match-length-warning">
                                Length differs by {formatMilliseconds(Math.abs(localMs - remoteMs))}
                              </div>
                            )}
                            <div className="mb-track-match-cell-changes">{row.changes}</div>
                            {row.isManualMatch && (
                              <button
                                type="button"
                                className="mb-track-match-clear-btn"
                                onClick={() => handleClearManualTrackMatch(row.localTrack?.ratingKey)}
                              >
                                Clear manual match
                              </button>
                            )}
                          </>
                        ) : isEditingMatch ? (
                          <select
                            autoFocus
                            className="mb-track-match-select"
                            value=""
                            onChange={(event) => handleManualTrackMatchSelect(row.localTrack?.ratingKey, event.target.value || null)}
                            onBlur={() => setEditingUnmatchedRowKey(null)}
                          >
                            <option value="">— Select a pulled track —</option>
                            {(mbTrackPreview?.unmatchedRemoteTracks || []).map((remoteTrack) => (
                              <option key={remoteTrack._previewKey} value={remoteTrack._previewKey}>
                                Disc {remoteTrack.discNumber} · {remoteTrack.trackNumber}. {remoteTrack.title}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <button
                            type="button"
                            className="mb-track-match-empty-btn"
                            onClick={() => setEditingUnmatchedRowKey(rowKey)}
                            disabled={!hasUnmatchedOptions}
                            title={hasUnmatchedOptions ? 'Click to manually match a pulled track' : 'No unmatched pulled tracks available'}
                          >
                            No pulled match{hasUnmatchedOptions ? ' — click to select' : ''}
                          </button>
                        )}
                      </div>
                    </React.Fragment>
                  );
                });
              })()}
            </div>

            {(mbTrackPreview?.unmatchedRemoteTracks || []).length > 0 && (
              <div className="mb-track-match-unmatched">
                <div className="mb-track-match-column-label">Unmatched Pulled Tracks</div>
                {(() => {
                  let lastUnmatchedDiscNumber = null;
                  return mbTrackPreview.unmatchedRemoteTracks.map((remoteTrack) => {
                    const showDiscHeader = remoteTrack.discNumber !== lastUnmatchedDiscNumber;
                    lastUnmatchedDiscNumber = remoteTrack.discNumber;

                    return (
                      <React.Fragment key={remoteTrack._previewKey}>
                        {showDiscHeader && (
                          <div className="mb-track-match-disc-header">Disc {remoteTrack.discNumber}</div>
                        )}
                        <div className="mb-track-match-cell">
                          <div className="mb-track-match-cell-title">
                            {remoteTrack.discNumber}.{remoteTrack.trackNumber} {remoteTrack.title}
                          </div>
                          {formatMilliseconds(remoteTrack.length) && (
                            <div className="mb-track-match-cell-meta">Length: {formatMilliseconds(remoteTrack.length)}</div>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        )}

        {!tracks || tracks.length === 0 ? (
          <div className="empty-state">
            <p>No tracks found for this album.</p>
          </div>
        ) : (
          <div className="tracks-table">
            <div className="tracks-header">
              {bulkTrackLinkSelectionMode && <span className="track-controls">✓</span>}
              <span className="track-controls">▶</span>
              <span className="track-number">#</span>
              <span className="track-title">Title</span>
              <span className="track-rating">Rating</span>
              <span className="track-plays">Plays</span>
              <span className="track-duration">Duration</span>
              <span className="track-size">Size</span>
              <span className="track-playlist">Playlist</span>
            </div>
            {(() => {
              let lastRenderedDiscNumber = null;
              return trackGroups.map((group) => {
                const showDiscHeader = albumHasMultipleDiscs && group.discNumber !== lastRenderedDiscNumber;
                lastRenderedDiscNumber = group.discNumber;

                return (
                  <React.Fragment key={group.key}>
                    {showDiscHeader && (
                      <div className="disc-group-header">
                        <span className="disc-group-title">Disc {group.discNumber}</span>
                      </div>
                    )}
                    <div className="track-group">
                <div className="track-group-header">
                  <span className="track-group-title">{group.title}</span>
                  <span className="track-group-count">{group.tracks.length} track{group.tracks.length !== 1 ? 's' : ''}</span>
                </div>

                {group.tracks.map((track, index) => (
                  <div 
                    key={track.ratingKey} 
                    className={`track-row ${currentTrack?.ratingKey === track.ratingKey ? 'playing' : ''}`}
                  >
                    {bulkTrackLinkSelectionMode && (
                      <div className="track-controls">
                        <input
                          type="checkbox"
                          checked={selectedTrackKeysToLink.has(track.ratingKey)}
                          onChange={() => toggleTrackForBulkLink(track.ratingKey)}
                          aria-label={`Select ${track.title || 'track'} for bulk work link`}
                        />
                      </div>
                    )}
                    <button 
                      className={`track-play-button ${currentTrack?.ratingKey === track.ratingKey && isPlaying ? 'playing' : ''}`}
                      onClick={() => onPlayTrack(track)}
                      title={currentTrack?.ratingKey === track.ratingKey && isPlaying ? 'Pause' : 'Play'}
                    >
                      {currentTrack?.ratingKey === track.ratingKey && isPlaying ? '⏸' : '▶'}
                    </button>
                    <span className="track-number">{formatTrackNumberLabel(track, index + 1)}</span>
                    <div className="track-title">
                      <div 
                        className="track-name track-name-link"
                        onClick={() => onSelectTrack && onSelectTrack(track)}
                      >
                        {track.title || 'Untitled'}
                      </div>
                      {track.originalTitle && (
                        <div className="track-subtitle">{track.originalTitle}</div>
                      )}
                      {group.workId && (
                        <div className="track-subtitle">
                          Work: {group.title}
                        </div>
                      )}
                      {track.musicBrainzTrackId && (
                        <div className="track-mbid">
                          <a 
                            href={`https://musicbrainz.org/recording/${track.musicBrainzTrackId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mbid-link"
                            title="View on MusicBrainz"
                          >
                            🏷️ MB
                          </a>
                        </div>
                      )}
                      <div className="track-inline-actions">
                        <button
                          type="button"
                          className="track-inline-btn"
                          onClick={() => openLinkWorkModal(track)}
                        >
                          Link To Work
                        </button>
                        <button
                          type="button"
                          className="track-inline-btn track-inline-btn-danger"
                          onClick={() => handleDisconnectTrackFromAlbum(track)}
                          disabled={disconnectingTrackKey === track.ratingKey}
                        >
                          {disconnectingTrackKey === track.ratingKey ? 'Disconnecting...' : 'Disconnect Album'}
                        </button>
                        {(group.workId || track.work?.id) && (
                          <button
                            type="button"
                            className="track-inline-btn track-inline-btn-danger"
                            onClick={() => handleDisconnectTrackFromWork(track)}
                            disabled={disconnectingWorkTrackKey === track.ratingKey}
                          >
                            {disconnectingWorkTrackKey === track.ratingKey ? 'Disconnecting...' : 'Disconnect Work'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="track-rating">
                      <StarRating
                        value={track.userRating || 0}
                        onChange={(rating) => handleRatingChange(track.ratingKey, rating)}
                        size="small"
                      />
                    </div>
                    <span className="track-plays">
                      {track.viewCount > 0 ? `${track.viewCount} ${track.viewCount === 1 ? 'play' : 'plays'}` : '—'}
                    </span>
                    <span className="track-duration">{formatDuration(track.duration)}</span>
                    <span className="track-size">{formatFileSize(track.size)}</span>
                    <div className="track-playlist">
                      {playlists && playlists.length > 0 ? (
                        <select 
                          onChange={(e) => {
                            if (e.target.value) {
                              onAddTrackToCustomPlaylist(parseInt(e.target.value), track);
                              e.target.value = '';
                            }
                          }}
                          className="playlist-select"
                        >
                          <option value="">+ Add to Playlist</option>
                          {playlists.map(playlist => (
                            <option key={playlist.id} value={playlist.id}>
                              {playlist.title}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="no-playlists">No playlists</span>
                      )}
                    </div>
                  </div>
                ))}
                    </div>
                  </React.Fragment>
                );
              });
            })()}
          </div>
        )}
      </div>
      
      {/* MusicBrainz Metadata Section */}
      {albumData.musicBrainzId && (
        <div className="musicbrainz-metadata">
          <div 
            className="metadata-header" 
            onClick={() => setShowMusicBrainzData(!showMusicBrainzData)}
          >
            <h3 className="metadata-heading">MusicBrainz Information</h3>
            <button className="metadata-toggle">
              {showMusicBrainzData ? '▼' : '▶'}
            </button>
          </div>
          
          {showMusicBrainzData && (
            <>
              <div className="metadata-grid">
                {albumData.musicBrainzCountry && (
                  <div className="metadata-item">
                    <span className="metadata-label">Country:</span>
                    <span className="metadata-value">{albumData.musicBrainzCountry}</span>
                  </div>
                )}
                
                {albumData.musicBrainzReleaseDate && (
                  <div className="metadata-item">
                    <span className="metadata-label">Release Date:</span>
                    <span className="metadata-value">{new Date(albumData.musicBrainzReleaseDate).toLocaleDateString()}</span>
                  </div>
                )}
                
                {albumData.musicBrainzStatus && (
                  <div className="metadata-item">
                    <span className="metadata-label">Status:</span>
                    <span className="metadata-value">{albumData.musicBrainzStatus}</span>
                  </div>
                )}
                
                {albumData.musicBrainzPackaging && (
                  <div className="metadata-item">
                    <span className="metadata-label">Packaging:</span>
                    <span className="metadata-value">{albumData.musicBrainzPackaging}</span>
                  </div>
                )}
                
                {albumData.musicBrainzLabel && (
                  <div className="metadata-item">
                    <span className="metadata-label">Label:</span>
                    <span className="metadata-value">{albumData.musicBrainzLabel}</span>
                  </div>
                )}
                
                {albumData.musicBrainzBarcode && (
                  <div className="metadata-item">
                    <span className="metadata-label">Barcode:</span>
                    <span className="metadata-value">{albumData.musicBrainzBarcode}</span>
                  </div>
                )}
                
                {albumData.musicBrainzAsin && (
                  <div className="metadata-item">
                    <span className="metadata-label">ASIN:</span>
                    <span className="metadata-value">{albumData.musicBrainzAsin}</span>
                  </div>
                )}
                
                <div className="metadata-item">
                  <span className="metadata-label">MusicBrainz ID:</span>
                  <a 
                    href={`https://musicbrainz.org/release/${albumData.musicBrainzId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="metadata-link"
                  >
                    {albumData.musicBrainzId}
                  </a>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      
      {/* Identify Modal */}
      <IdentifyModal
        isOpen={showIdentifyModal}
        onClose={() => setShowIdentifyModal(false)}
        entityType="album"
        entityKey={album.ratingKey}
        entityTitle={albumData.title}
        albumTracks={tracks}
        onIdentified={(updatedAlbum) => {
          handleAlbumUpdate(updatedAlbum);
          setShowIdentifyModal(false);
        }}
        onAcceptCandidate={(candidate, trackMatchData) => {
          setMbTrackMatchPreview({ candidate, trackMatchData });
          setManualTrackMatchOverrides({});
          setEditingUnmatchedRowKey(null);
        }}
      />

      {/* Discogs Search Modal */}
      {showDiscogsSearchModal && (
        <div className="modal-overlay" onClick={closeDiscogsSearchModal}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <h2>Discogs Search Results</h2>
            <div className="track-link-modal-step">
              <input
                type="text"
                value={discogsSearchQuery}
                onChange={(event) => setDiscogsSearchQuery(event.target.value)}
                placeholder="Search query (e.g., 'Album Title Artist')"
                style={{
                  width: '100%',
                  padding: '0.45rem 0.6rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #4b5563',
                  backgroundColor: '#111827',
                  color: '#f9fafb',
                  marginBottom: '0.5rem',
                }}
              />
              <button
                onClick={handleSearchDiscogs}
                disabled={searchingDiscogs}
                style={{ backgroundColor: '#0f766e', padding: '0.45rem 1rem', borderRadius: '0.375rem' }}
              >
                {searchingDiscogs ? 'Searching...' : 'Search'}
              </button>
            </div>
            <div className="track-link-modal-results" style={{ maxHeight: '360px' }}>
              {discogsSearchResults.length === 0 ? (
                <div className="track-link-modal-hint">No results found.</div>
              ) : (
                discogsSearchResults.map((release, index) => (
                  <div key={index} className="track-link-modal-result" style={{ cursor: 'pointer', display: 'block' }}>
                    <strong>{release.title}</strong>
                    <div className="track-link-modal-hint">
                      Artist: {release.artist || 'Unknown'}
                    </div>
                    <div className="track-link-modal-hint">
                      ID: {release.id} • Type: {release.type || 'release'}
                    </div>
                    <button
                      onClick={() => handleSelectDiscogsRelease(release)}
                      disabled={importingDiscogs}
                      style={{
                        marginTop: '0.25rem',
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#0f766e',
                        borderRadius: '0.25rem',
                      }}
                    >
                      Select this release
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="track-link-modal-actions">
              <button
                type="button"
                className="track-link-modal-btn-cancel"
                onClick={closeDiscogsSearchModal}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDiscogsPreviewModal && (
        <div className="modal-overlay" onClick={closeDiscogsPreviewModal}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <h2>Discogs Match Preview</h2>
            <p className="track-link-modal-subtitle">
              {discogsPreview?.album?.title || albumData.title}
              {' → '}
              {discogsPreview?.album?.discogsTitle || albumData.title}
            </p>

            <div className="track-link-modal-step">
              <h4>Summary</h4>
              <div className="track-link-modal-hint">
                Source: {discogsPreview?.discogs?.sourceKind || 'release'} #{discogsPreview?.discogs?.releaseId || 'unknown'}
              </div>
              <div className="track-link-modal-hint">
                Mapping {discogsPreview?.mapping?.mappedTrackCount || 0} local track(s) from {discogsPreview?.mapping?.localTrackCount || 0} local / {discogsPreview?.discogs?.sourceTrackCount || 0} Discogs tracks.
              </div>
              <label className="track-link-modal-hint" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={discogsLinkAllToAlbumWork}
                  onChange={(event) => setDiscogsLinkAllToAlbumWork(event.target.checked)}
                  disabled={importingDiscogs}
                />
                Link all imported tracks to a single work titled "{(discogsPreview?.album?.discogsTitle || albumData?.title || 'Album Title').trim() || 'Album Title'}"
              </label>
            </div>

            <div className="track-link-modal-step">
              <h4>Artists to Import</h4>
              {discogsImportArtistsPreview.creditOptions.length === 0 ? (
                <div className="track-link-modal-hint">No artist credits will be imported with the current mapping.</div>
              ) : (
                <>
                  <div className="track-link-modal-hint" style={{ marginBottom: '0.45rem' }}>
                    {discogsImportArtistsPreview.includedCreditCount} of {discogsImportArtistsPreview.creditOptions.length} credit(s) selected from album credits and {discogsImportArtistsPreview.selectedTrackCount} mapped track(s).
                  </div>
                  <div className="track-link-modal-hint" style={{ marginBottom: '0.45rem' }}>
                    Included: {discogsImportArtistsPreview.matchedExistingCount} match existing artist(s), {discogsImportArtistsPreview.newArtistCount} will create new artist(s).
                  </div>
                  <div className="track-link-modal-results" style={{ maxHeight: '220px' }}>
                    {discogsImportArtistsPreview.creditOptions.map((credit) => {
                      return (
                        <label key={credit.creditKey} className="track-link-modal-result" style={{ cursor: 'pointer', display: 'block' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                              type="checkbox"
                              checked={!credit.excluded}
                              onChange={() => toggleDiscogsExcludedCredit(credit.creditKey)}
                              disabled={importingDiscogs}
                            />
                            <strong>{credit.artistName}</strong> - {credit.artistTypeName}
                          </div>
                          <div className="track-link-modal-hint">
                            {credit.sourceLabel}
                            {credit.discogsTrackTitle ? ` · ${credit.discogsTrackTitle}` : ''}
                          </div>
                          <div className="track-link-modal-hint" style={{ marginTop: '0.2rem' }}>
                            {credit.matchedExisting
                              ? `Matched existing artist${credit.matchKind === 'fuzzy' ? ' (fuzzy)' : ''}: ${credit.matchedArtist?.title || credit.artistName}`
                              : 'New artist will be created'}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="track-link-modal-step">
              <h4>Track Matches</h4>
              {(discogsPreview?.mapping?.discogsTracks || []).length === 0 ? (
                <div className="track-link-modal-hint">No track mappings found.</div>
              ) : (
                <div className="track-link-modal-results discogs-match-results" style={{ maxHeight: '360px' }}>
                  <div className="discogs-match-row discogs-match-row-header">
                    <div className="discogs-match-header">Local Track</div>
                    <div className="discogs-match-header">Discogs Track</div>
                  </div>
                  {discogsPreview.mapping.discogsTracks.map((discogsTrack) => {
                    const selectedMapping = (discogsTrackMatches || []).find((entry) => entry.discogsOrdinal === discogsTrack.discogsOrdinal);
                    const selectedLocalTrackKey = selectedMapping?.localTrackKey || '';
                    const selectedLocalTrack = (discogsPreview?.mapping?.localTracks || []).find((track) => track.ratingKey === selectedLocalTrackKey) || null;
                    const discogsDurationLabel = formatMilliseconds(discogsTrack.discogsTrackDurationMs);
                    const localDurationLabel = formatMilliseconds(selectedLocalTrack?.duration);

                    return (
                      <div key={`discogs-track-row-${discogsTrack.discogsOrdinal}`} className="discogs-match-row">
                        <div className="track-link-modal-result discogs-match-cell" style={{ cursor: 'default' }}>
                          <div className="track-link-modal-hint">Pick local track</div>
                          <select
                            className="track-link-modal-input"
                            value={selectedLocalTrackKey}
                            onChange={(event) => updateDiscogsTrackMatch(discogsTrack.discogsOrdinal, event.target.value)}
                          >
                            <option value="">Do not import this track</option>
                            {(discogsPreview?.mapping?.localTracks || []).map((localTrack) => (
                              <option key={localTrack.ratingKey} value={localTrack.ratingKey}>
                                {Number.isInteger(localTrack.discNumber) && Number.isInteger(localTrack.trackNumber)
                                  ? `D${localTrack.discNumber}-T${localTrack.trackNumber}. `
                                  : (Number.isInteger(localTrack.trackNumber)
                                    ? `T${localTrack.trackNumber}. `
                                    : (Number.isInteger(localTrack.index) ? `${localTrack.index}. ` : ''))}
                                {localTrack.title || 'Untitled'}
                              </option>
                            ))}
                          </select>
                          {selectedLocalTrack && (
                            <div className="track-link-modal-hint">
                              {Number.isInteger(selectedLocalTrack.index) ? `#${selectedLocalTrack.index}` : 'Unnumbered'}
                              {localDurationLabel ? ` · ${localDurationLabel}` : ''}
                            </div>
                          )}
                        </div>
                        <div className="track-link-modal-result discogs-match-cell" style={{ cursor: 'default' }}>
                          <strong>{discogsTrack.discogsTrackIndex}. {discogsTrack.discogsTrackTitle || 'Untitled'}</strong>
                          <div className="track-link-modal-hint">
                            Discogs #{discogsTrack.discogsOrdinal}
                            {discogsDurationLabel ? ` · ${discogsDurationLabel}` : ''}
                          </div>
                        </div>
                      </div>
                    );})}
                </div>
              )}
            </div>

            {(discogsPreview?.mapping?.proposedWorks || []).length > 0 && (
              <div className="track-link-modal-step">
                <h4>Proposed Works</h4>
                <div className="track-link-modal-results">
                  {discogsPreview.mapping.proposedWorks.map((work) => (
                    <div key={work.title} className="track-link-modal-result" style={{ cursor: 'default' }}>
                      {work.title} ({work.trackCount} tracks)
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="track-link-modal-actions">
              <button
                type="button"
                className="track-link-modal-btn-cancel"
                onClick={closeDiscogsPreviewModal}
                disabled={importingDiscogs}
              >
                Cancel
              </button>
              <button
                type="button"
                className="track-link-modal-btn-confirm"
                onClick={handleAcceptDiscogsImport}
                disabled={importingDiscogs}
              >
                {importingDiscogs ? 'Importing...' : 'Accept and Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLinkWorkModal && (
        <div className="modal-overlay" onClick={closeLinkWorkModal}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <h2>{trackToLink ? 'Link Track to Work' : 'Bulk Link Tracks to Work'}</h2>
            {trackToLink ? (
              <p className="track-link-modal-subtitle">
                Track: {trackToLink?.title || 'Unknown Track'}
              </p>
            ) : (
              <p className="track-link-modal-subtitle">
                Tracks selected: {selectedTrackKeysToLink.size}
              </p>
            )}

            <div className="track-link-modal-step">
              <h4>1. Filter by Composer</h4>
              <input
                type="text"
                value={composerSearch}
                onChange={(event) => {
                  const value = event.target.value;
                  setComposerSearch(value);
                  searchComposers(value);
                }}
                placeholder="Search composer..."
                className="track-link-modal-input"
              />
              {searchingComposer && <div className="track-link-modal-hint">Searching…</div>}
              {composerResults.length > 0 && (
                <div className="track-link-modal-results">
                  {composerResults.map((composer) => (
                    <button
                      key={composer.ratingKey}
                      type="button"
                      className="track-link-modal-result"
                      onClick={() => handleSelectComposer(composer)}
                    >
                      {composer.title}
                    </button>
                  ))}
                </div>
              )}
              {selectedComposer && (
                <div className="track-link-modal-selected">
                  Selected composer: {selectedComposer.title}
                </div>
              )}
            </div>

            {selectedComposer && (
              <div className="track-link-modal-step">
                <h4>2. Filter and Select Work</h4>
                <input
                  type="text"
                  value={workSearch}
                  onChange={(event) => setWorkSearch(event.target.value)}
                  placeholder="Filter works by title..."
                  className="track-link-modal-input"
                />

                {filteredComposerWorks.length === 0 ? (
                  <div className="track-link-modal-hint">No works found for this composer.</div>
                ) : (
                  <div className="track-link-modal-results">
                    {filteredComposerWorks.map((work) => (
                      <button
                        key={work.id}
                        type="button"
                        className={`track-link-modal-result ${selectedWork?.id === work.id ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedWork(work);
                          setSelectedPart(null);
                        }}
                      >
                        {work.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedWork && trackToLink && (
              <div className="track-link-modal-step">
                <h4>3. Select Part</h4>
                {selectedWork.parts?.length ? (
                  <div className="track-link-modal-results">
                    {selectedWork.parts.map((part) => (
                      <button
                        key={part.id}
                        type="button"
                        className={`track-link-modal-result ${selectedPart?.id === part.id ? 'selected' : ''}`}
                        onClick={() => setSelectedPart(part)}
                      >
                        {part.order}. {part.title}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="track-link-modal-hint">This work has no parts yet.</div>
                )}
              </div>
            )}

            {selectedWork && !trackToLink && (
              <div className="track-link-modal-step">
                <h4>3. New Part Title</h4>
                <input
                  type="text"
                  value={bulkPartTitle}
                  onChange={(event) => setBulkPartTitle(event.target.value)}
                  placeholder="Part title for selected tracks"
                  className="track-link-modal-input"
                />
                <div className="track-link-modal-hint">
                  A single new part will be created in this work and all selected tracks will be linked to it.
                </div>
              </div>
            )}

            <div className="track-link-modal-actions">
              <button
                type="button"
                className="track-link-modal-btn-cancel"
                onClick={closeLinkWorkModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="track-link-modal-btn-confirm"
                onClick={trackToLink ? handleLinkTrackToWork : handleBulkLinkTracksToWork}
                disabled={trackToLink ? (!selectedWork || !selectedPart || linkingTrack) : (!selectedWork || selectedTrackKeysToLink.size === 0 || linkingTrack)}
              >
                {linkingTrack ? 'Linking...' : (trackToLink ? 'Link Track' : 'Link Selected Tracks')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlbumDetail;
