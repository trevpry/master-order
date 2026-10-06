import React, { useState, useEffect, useMemo } from 'react';
import config from '../../../../../config';
import TracksPlaylistPlayer from './TracksPlaylistPlayer';
import StarRating from '../../../../../components/StarRating';
import IdentifyModal from '../../../../../components/IdentifyModal';
import DiscogsIdentifyModal from '../../../../../components/DiscogsIdentifyModal';
import PublisherPickerModal from '../../../../../components/PublisherPickerModal';
import MetadataEditor from '../../../../../components/MetadataEditor';
import EmbeddedPicardTagsPanel from './EmbeddedPicardTagsPanel';
import ArtworkPicker from './ArtworkPicker';
import { buildTrackPreview, inferLocalDiscNumber, NO_MATCH_KEY } from '../../../../../utils/musicBrainzTrackMatch';
import { splitArtistNameAndType } from '../../../../../utils/artistNameMatch';
import { getAlbumArtworkUrl } from '../../../../../utils/albumArtwork';
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
  onSelectWork,
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
  const [editingDiscogsRowKey, setEditingDiscogsRowKey] = useState(null);
  const [discogsApplyError, setDiscogsApplyError] = useState(null);
  const [discogsArtistOverrides, setDiscogsArtistOverrides] = useState({});
  const [editingCreditKey, setEditingCreditKey] = useState(null);
  const [creditArtistQuery, setCreditArtistQuery] = useState('');
  const [creditArtistResults, setCreditArtistResults] = useState([]);
  const [searchingCreditArtists, setSearchingCreditArtists] = useState(false);
  const [artworkSide, setArtworkSide] = useState('front');
  const [discogsArtworkSelection, setDiscogsArtworkSelection] = useState({ front: null, back: null });
  const [discogsWorkSelections, setDiscogsWorkSelections] = useState({});
  const [discogsAlbumWorkComposerKey, setDiscogsAlbumWorkComposerKey] = useState(null);
  const [mbCoverArt, setMbCoverArt] = useState({ loading: false, images: [], error: null });
  const [mbArtworkSelection, setMbArtworkSelection] = useState({ front: null, back: null });
  const [showDiscogsSearchModal, setShowDiscogsSearchModal] = useState(false);
  const [showPublisherPicker, setShowPublisherPicker] = useState(false);
  const [activePublisher, setActivePublisher] = useState(null);
  // Where the current import preview came from: { kind: 'discogs' } or { kind: 'publisher', key, label, releaseId }
  const [importSource, setImportSource] = useState({ kind: 'discogs' });
  
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
    setArtworkSide('front');
  }, [album?.ratingKey]);

  useEffect(() => {
    setDiscogsArtworkSelection(discogsPreview?.discogs?.defaultArtwork || { front: null, back: null });
    setDiscogsWorkSelections(Object.fromEntries(
      (discogsPreview?.mapping?.workGroups || []).map((group) => [group.key, group.defaultChoice || { mode: 'create' }])
    ));
    setDiscogsAlbumWorkComposerKey(discogsPreview?.mapping?.defaultAlbumComposerKey || null);
  }, [discogsPreview]);

  useEffect(() => {
    const releaseId = mbTrackMatchPreview?.trackMatchData?.id || mbTrackMatchPreview?.candidate?.musicBrainzId || null;
    setMbArtworkSelection({ front: null, back: null });
    if (!releaseId) {
      setMbCoverArt({ loading: false, images: [], error: null });
      return undefined;
    }

    let cancelled = false;
    setMbCoverArt({ loading: true, images: [], error: null });
    fetch(`${config.apiBaseUrl}/api/identification/release/${encodeURIComponent(releaseId)}/cover-art`)
      .then((response) => response.json())
      .then((result) => {
        if (cancelled) return;
        if (!result.success) {
          setMbCoverArt({ loading: false, images: [], error: result.error || 'Failed to load cover art' });
          return;
        }
        const images = (result.data?.images || []).map((image) => ({
          ...image,
          label: [image.types.join(', '), image.comment].filter(Boolean).join(' · ') || `Image ${image.index + 1}`
        }));
        setMbCoverArt({ loading: false, images, error: null });
        setMbArtworkSelection(result.data?.defaultArtwork || { front: null, back: null });
      })
      .catch((error) => {
        if (!cancelled) setMbCoverArt({ loading: false, images: [], error: error.message || 'Failed to load cover art' });
      });

    return () => { cancelled = true; };
  }, [mbTrackMatchPreview]);

  useEffect(() => {
    const query = splitArtistNameAndType(creditArtistQuery).name;
    if (!editingCreditKey || query.length < 2) {
      setCreditArtistResults([]);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setSearchingCreditArtists(true);
        const response = await fetch(
          `${config.apiBaseUrl}/api/music/artists?search=${encodeURIComponent(creditArtistQuery.trim())}&limit=8`
        );
        const result = response.ok ? await response.json() : [];
        if (!cancelled) {
          setCreditArtistResults((result.artists || result || []).slice(0, 8));
        }
      } catch (error) {
        console.error('Error searching artists:', error);
      } finally {
        if (!cancelled) setSearchingCreditArtists(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [creditArtistQuery, editingCreditKey]);
  
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
        .filter((row) => row.isManualMatch && row.localTrack?.ratingKey && (row.isManualNoMatch || row.remoteTrack?.recordingId))
        .map((row) => (row.isManualNoMatch
          ? { localTrackKey: row.localTrack.ratingKey, noMatch: true }
          : { localTrackKey: row.localTrack.ratingKey, recordingId: row.remoteTrack.recordingId }));

      // Reuse the release data already fetched during accept to avoid re-hitting the
      // rate-limited MusicBrainz API (which can stall for many seconds on retries).
      const response = await fetch(`${config.apiBaseUrl}/api/identification/apply/${candidateId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: mbTrackMatchPreview?.trackMatchData || null,
          trackMatchOverrides,
          artwork: mbArtworkSelection
        })
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

      const artworkErrors = data.data?.artworkErrors || [];
      if (artworkErrors.length > 0) {
        alert(`Metadata applied, but some artwork could not be saved:\n${artworkErrors.map((entry) => `${entry.type}: ${entry.error}`).join('\n')}`);
      }
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
      // A pulled track can only belong to one local track, so steal it from any earlier manual pick.
      const next = Object.fromEntries(
        Object.entries(prev).filter(([key, value]) => remotePreviewKey === NO_MATCH_KEY || value !== remotePreviewKey || key === localTrackKey)
      );
      return { ...next, [localTrackKey]: remotePreviewKey };
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

  const requestImportPreview = async (url, body, source) => {
    const sourceLabel = source.kind === 'publisher' ? source.label : 'Discogs';
    try {
      setImportingDiscogs(true);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, apply: false })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Failed to import ${sourceLabel} metadata`);
      }

      setImportSource(source);
      setDiscogsPreview(result?.data || null);
      setDiscogsTrackMatches(result?.data?.mapping?.defaultTrackMappings || []);
      setDiscogsLinkAllToAlbumWork(false);
      setDiscogsExcludedCreditKeys(new Set());
      setShowDiscogsPreviewModal(true);
    } catch (error) {
      console.error(`Error importing ${sourceLabel} metadata:`, error);
      alert(`${sourceLabel} import failed: ${error.message}`);
    } finally {
      setImportingDiscogs(false);
    }
  };

  const handleImportFromDiscogs = async () => {
    const normalizedUrl = String(discogsUrl || '').trim();
    if (!normalizedUrl) {
      alert('Enter a Discogs release URL first.');
      return;
    }

    await requestImportPreview(
      `${config.apiBaseUrl}/api/music/albums/${albumData.ratingKey}/discogs-import`,
      { url: normalizedUrl },
      { kind: 'discogs' }
    );
  };

  const handleSearchDiscogs = () => {
    setShowDiscogsSearchModal(true);
  };

  const closeDiscogsSearchModal = () => {
    setShowDiscogsSearchModal(false);
  };

  const handleSelectDiscogsRelease = async (release) => {
    const releaseUrl = `https://www.discogs.com/release/${release.id}`;
    setDiscogsUrl(releaseUrl);
    closeDiscogsSearchModal();

    await requestImportPreview(
      `${config.apiBaseUrl}/api/music/albums/${albumData.ratingKey}/discogs-import`,
      { url: releaseUrl },
      { kind: 'discogs' }
    );
  };

  const handleSelectPublisher = (publisher) => {
    setShowPublisherPicker(false);
    setActivePublisher(publisher);
  };

  const handleSelectPublisherRelease = async (release) => {
    const publisher = activePublisher;
    setActivePublisher(null);
    if (!publisher) return;

    await requestImportPreview(
      `${config.apiBaseUrl}/api/music/publishers/${encodeURIComponent(publisher.key)}/albums/${encodeURIComponent(albumData.ratingKey)}/import`,
      { releaseId: release.id },
      { kind: 'publisher', key: publisher.key, label: publisher.label, releaseId: release.id }
    );
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
    setEditingDiscogsRowKey(null);
    setDiscogsApplyError(null);
    setDiscogsArtistOverrides({});
    closeCreditArtistEditor();
  };

  const openCreditArtistEditor = (credit) => {
    setEditingCreditKey(credit.groupKey);
    setCreditArtistQuery(`${credit.artistName} — ${credit.artistTypeName}`);
    setCreditArtistResults([]);
  };

  const closeCreditArtistEditor = () => {
    setEditingCreditKey(null);
    setCreditArtistQuery('');
    setCreditArtistResults([]);
  };

  const setCreditArtistOverride = (creditKeys, override) => {
    setDiscogsArtistOverrides((prev) => {
      const next = { ...prev };
      for (const creditKey of creditKeys) {
        if (override) {
          next[creditKey] = override;
        } else {
          delete next[creditKey];
        }
      }
      return next;
    });
    closeCreditArtistEditor();
  };

  const toggleDiscogsExcludedCredit = (creditGroup) => {
    const keys = (creditGroup?.creditKeys || []).map((key) => String(key || '').trim()).filter(Boolean);
    if (keys.length === 0) {
      return;
    }

    setDiscogsExcludedCreditKeys((prev) => {
      const next = new Set(prev);
      keys.forEach((key) => (creditGroup.excluded ? next.delete(key) : next.add(key)));
      return next;
    });
  };

  const handleDiscogsManualMatch = (localTrackKey, discogsOrdinal) => {
    if (!localTrackKey || !Number.isInteger(discogsOrdinal)) return;

    setDiscogsTrackMatches((prev) => {
      const next = (Array.isArray(prev) ? prev : []).map((entry) => (
        entry.localTrackKey === localTrackKey ? { ...entry, localTrackKey: null } : entry
      ));
      const idx = next.findIndex((entry) => entry.discogsOrdinal === discogsOrdinal);
      if (idx >= 0) {
        next[idx] = { ...next[idx], localTrackKey };
      } else {
        next.push({ discogsOrdinal, localTrackKey });
      }
      return next;
    });
    setEditingDiscogsRowKey(null);
  };

  const handleClearDiscogsMatch = (localTrackKey) => {
    if (!localTrackKey) return;

    setDiscogsTrackMatches((prev) => (Array.isArray(prev) ? prev : []).map((entry) => (
      entry.localTrackKey === localTrackKey ? { ...entry, localTrackKey: null } : entry
    )));
  };

  const handleAcceptDiscogsImport = async () => {
    const isPublisherImport = importSource.kind === 'publisher';
    const normalizedUrl = String(discogsUrl || '').trim();
    if (!isPublisherImport && !normalizedUrl) {
      alert('Discogs URL is required to continue.');
      return;
    }
    const importUrl = isPublisherImport
      ? `${config.apiBaseUrl}/api/music/publishers/${encodeURIComponent(importSource.key)}/albums/${encodeURIComponent(albumData.ratingKey)}/import`
      : `${config.apiBaseUrl}/api/music/albums/${albumData.ratingKey}/discogs-import`;
    const releaseReference = isPublisherImport ? { releaseId: importSource.releaseId } : { url: normalizedUrl };

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
      setDiscogsApplyError(null);
      const response = await fetch(importUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...releaseReference,
          apply: true,
          trackMappings: trackMappingsPayload,
          excludedCreditKeys: [...discogsExcludedCreditKeys],
          artistOverrides: Object.fromEntries(
            Object.entries(discogsArtistOverrides).map(([creditKey, override]) => [
              creditKey,
              override.ratingKey
                ? { ratingKey: override.ratingKey, typeName: override.typeName || null }
                : { createName: override.createName, typeName: override.typeName || null }
            ])
          ),
          artwork: discogsArtworkSelection,
          workSelections: discogsWorkSelections,
          albumWorkComposerKey: discogsAlbumWorkComposerKey,
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Failed to apply ${previewSourceLabel} import`);
      }

      await refreshAlbumAndTracks();
      closeDiscogsPreviewModal();

      const artworkErrors = result?.data?.discogs?.artworkErrors || [];
      if (artworkErrors.length > 0) {
        alert(`Metadata imported, but some artwork could not be saved:\n${artworkErrors.map((entry) => `${entry.type}: ${entry.error}`).join('\n')}`);
      }
    } catch (error) {
      console.error(`Error applying ${previewSourceLabel} metadata:`, error);
      setDiscogsApplyError(error.message || 'Failed to apply metadata');
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

  const mbRemoteMatchOwners = useMemo(() => new Map(
    (mbTrackPreview?.rows || [])
      .filter((row) => row.remoteTrack && row.localTrack)
      .map((row) => [row.remoteTrack._previewKey, row.localTrack.title || 'Untitled'])
  ), [mbTrackPreview]);

  const discogsTrackPreview = useMemo(() => {
    if (!discogsPreview) return null;

    const remoteTracks = discogsPreview.mapping?.discogsTracks || [];
    const remoteByOrdinal = new Map(remoteTracks.map((track) => [track.discogsOrdinal, track]));
    const defaultLocalKeyByOrdinal = new Map(
      (discogsPreview.mapping?.defaultTrackMappings || []).map((entry) => [entry.discogsOrdinal, entry.localTrackKey || null])
    );
    const ordinalByLocalKey = new Map();
    (discogsTrackMatches || []).forEach((entry) => {
      if (entry?.localTrackKey && remoteByOrdinal.has(entry.discogsOrdinal)) {
        ordinalByLocalKey.set(entry.localTrackKey, entry.discogsOrdinal);
      }
    });

    const localTracks = [...(discogsPreview.mapping?.localTracks || [])].sort((left, right) => (
      ((left.discNumber || Number.MAX_SAFE_INTEGER) - (right.discNumber || Number.MAX_SAFE_INTEGER))
      || ((left.index || 0) - (right.index || 0))
    ));

    const rows = localTracks.map((localTrack) => {
      const ordinal = ordinalByLocalKey.get(localTrack.ratingKey);
      const remoteTrack = ordinal ? remoteByOrdinal.get(ordinal) : null;
      const isManualMatch = Boolean(remoteTrack) && defaultLocalKeyByOrdinal.get(ordinal) !== localTrack.ratingKey;
      const changes = [];

      if (remoteTrack) {
        if (isManualMatch) {
          changes.push('Manually matched');
        }
        if (remoteTrack.discNumber && (localTrack.discNumber || null) !== remoteTrack.discNumber) {
          changes.push(`Disc # ${localTrack.discNumber || '—'} -> ${remoteTrack.discNumber}`);
        }
        if (remoteTrack.trackNumber && (localTrack.index || null) !== remoteTrack.trackNumber) {
          changes.push(`Track # ${localTrack.index || '—'} -> ${remoteTrack.trackNumber}`);
        }
        if ((localTrack.title || '') !== (remoteTrack.discogsTrackTitle || '')) {
          changes.push(`Title -> ${remoteTrack.discogsTrackTitle}`);
        }
      } else {
        changes.push(`No matching ${discogsPreview?.source?.label || 'Discogs'} track found`);
      }

      return {
        localTrack,
        remoteTrack,
        isManualMatch,
        changes: changes.length > 0 ? changes.join(', ') : 'No change'
      };
    });

    const matchedOrdinals = new Set(ordinalByLocalKey.values());
    const unmatchedRemoteTracks = remoteTracks.filter((track) => !matchedOrdinals.has(track.discogsOrdinal));

    return { rows, unmatchedRemoteTracks };
  }, [discogsPreview, discogsTrackMatches]);

  const discogsImportArtistsPreview = useMemo(() => {
    const selectedOrdinals = new Set(
      (Array.isArray(discogsTrackMatches) ? discogsTrackMatches : [])
        .filter((mapping) => mapping?.localTrackKey)
        .map((mapping) => Number.parseInt(mapping?.discogsOrdinal, 10))
        .filter((ordinal) => Number.isInteger(ordinal))
    );
    const positionByOrdinal = new Map(
      (discogsPreview?.mapping?.discogsTracks || []).map((track) => [track.discogsOrdinal, String(track.discogsTrackIndex || track.discogsOrdinal)])
    );
    const relevantCredits = (Array.isArray(discogsPreview?.discogs?.creditOptions) ? discogsPreview.discogs.creditOptions : [])
      .filter((credit) => {
        if (credit?.source === 'album') {
          return true;
        }

        const ordinal = Number.parseInt(credit?.discogsOrdinal, 10);
        return Number.isInteger(ordinal) && selectedOrdinals.has(ordinal);
      });

    // Track credits are grouped into one card per artist and role, listing the tracks they cover.
    const groups = new Map();
    for (const credit of relevantCredits) {
      const creditKey = String(credit?.creditKey || '').trim();
      const artistName = String(credit?.artistName || '').trim();
      const artistTypeName = String(credit?.artistTypeName || 'Performer').trim() || 'Performer';
      const source = credit?.source === 'album' ? 'album' : 'track';
      const groupKey = source === 'album'
        ? creditKey
        : `track:${credit?.discogsArtistId || artistName.toLowerCase()}:${artistTypeName}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          groupKey,
          creditKeys: [],
          ordinals: [],
          trackTitles: [],
          artistName,
          artistTypeName,
          source,
          matchedExisting: Boolean(credit?.matchedExisting),
          willCreateArtist: Boolean(credit?.willCreateArtist),
          matchedArtist: credit?.matchedArtist || null,
          matchKind: credit?.matchKind || null
        });
      }

      const group = groups.get(groupKey);
      group.creditKeys.push(creditKey);
      if (Number.isInteger(credit?.discogsOrdinal)) group.ordinals.push(credit.discogsOrdinal);
      if (credit?.discogsTrackTitle) group.trackTitles.push(String(credit.discogsTrackTitle).trim());
    }

    const creditOptions = [...groups.values()]
      .map((group) => {
        const ordinals = [...group.ordinals].sort((a, b) => a - b);
        const positions = ordinals.map((ordinal) => positionByOrdinal.get(ordinal) || String(ordinal));
        let sourceLabel = 'Album';
        if (group.source === 'track') {
          sourceLabel = positions.length === 1
            ? `Track ${positions[0]}`
            : `${positions.length} tracks: ${positions.slice(0, 8).join(', ')}${positions.length > 8 ? ', …' : ''}`;
        }

        return {
          ...group,
          creditKey: group.creditKeys[0],
          discogsOrdinal: ordinals[0] ?? null,
          sourceLabel,
          discogsTrackTitle: group.trackTitles.length === 1 ? group.trackTitles[0] : null,
          // Partially excluded groups count as included; toggling re-includes everything.
          excluded: group.creditKeys.every((key) => discogsExcludedCreditKeys.has(key)),
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
    const usesExistingArtist = (credit) => {
      const override = discogsArtistOverrides[credit.creditKey];
      return override ? Boolean(override.ratingKey) : credit.matchedExisting;
    };
    const matchedExistingCount = creditOptions.filter((credit) => !credit.excluded && usesExistingArtist(credit)).length;
    const newArtistCount = creditOptions.filter((credit) => !credit.excluded && !usesExistingArtist(credit)).length;

    return {
      selectedTrackCount: selectedOrdinals.size,
      creditOptions,
      includedCreditCount,
      matchedExistingCount,
      newArtistCount,
    };
  }, [discogsPreview, discogsTrackMatches, discogsExcludedCreditKeys, discogsArtistOverrides]);

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
      // A work spanning several discs stays one group; discs are shown as dividers inside it.
      const groupKey = workId ? `work-${workId}` : `disc-${discNumber}-standalone-${track.ratingKey}`;

      if (!groupMap.has(groupKey)) {
        const group = {
          key: groupKey,
          workId,
          title: workTitle,
          composerName: track.work?.composer ? (track.work.composer.userTitle || track.work.composer.title) : null,
          discNumber,
          discNumbers: new Set(),
          tracks: []
        };

        groupMap.set(groupKey, group);
        groups.push(group);
      }

      const group = groupMap.get(groupKey);
      group.discNumbers.add(discNumber);
      group.tracks.push(track);
    }

    return groups;
  };

  const trackGroups = buildTrackGroups(tracks);
  const albumDiscNumbers = new Set(trackGroups.flatMap((group) => [...group.discNumbers]));
  const albumHasMultipleDiscs = albumDiscNumbers.size > 1;
  const albumWorks = trackGroups
    .filter((group) => group.workId)
    .map((group) => ({ id: group.workId, title: group.title, composerName: group.composerName, tracksCount: group.tracks.length }));

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

  const previewSourceLabel = discogsPreview?.source?.label || 'Discogs';

  const renderComposerChoice = (options, value, onChange, disabled) => {
    if (!options || options.length === 0) {
      return <div className="mb-track-match-cell-meta">Composer: Unknown Composer (no composer credited on this album)</div>;
    }
    const describe = (option) => `${option.name}${option.source === 'album' ? ' (credited on this album)' : ''}`;
    if (options.length === 1) {
      return <div className="mb-track-match-cell-meta">Composer: {describe(options[0])}</div>;
    }
    return (
      <label className="mb-track-match-cell-meta discogs-composer-choice">
        Composer:
        <select
          className="mb-track-match-select"
          value={value || options[0].key}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        >
          {options.map((option) => (
            <option key={option.key} value={option.key}>{describe(option)}</option>
          ))}
        </select>
      </label>
    );
  };

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
            disabled={importingDiscogs}
            title="Search Discogs by artist and album title"
            style={{ backgroundColor: '#0f766e', opacity: importingDiscogs ? 0.7 : 1 }}
          >
            🔍 Search Discogs
          </button>
          <button
            className="musicbrainz-search-btn"
            onClick={() => setShowPublisherPicker(true)}
            disabled={importingDiscogs}
            title="Search a publisher's catalogue (e.g. Naxos) by artist and album title"
            style={{ backgroundColor: '#1d4ed8', opacity: importingDiscogs ? 0.7 : 1 }}
          >
            🏛️ Search by Publisher
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
        {getAlbumArtworkUrl(albumData) && (
          <div className="album-artwork">
            <img 
              key={`${albumData.ratingKey}-${artworkSide}`}
              src={getAlbumArtworkUrl(albumData, albumData?.artwork?.back ? artworkSide : 'front')}
              alt={`${albumData.title} (${artworkSide} cover)`}
              onError={(e) => {
                console.error('Album artwork failed to load');
                e.target.style.display = 'none';
              }}
            />
            {albumData?.artwork?.back && (
              <div className="album-artwork-sides">
                {['front', 'back'].map((side) => (
                  <button
                    key={side}
                    type="button"
                    className={`album-artwork-side-btn ${artworkSide === side ? 'active' : ''}`}
                    onClick={() => setArtworkSide(side)}
                  >
                    {side === 'front' ? 'Front' : 'Back'}
                  </button>
                ))}
              </div>
            )}
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
                  onSelectWork && onSelectWork(work.id);
                }}
                title={workSelectionMode ? undefined : 'Open work details'}
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
                <span className="album-work-item-title">
                  {work.title}
                  {work.composerName && <span className="album-work-item-composer"> — {work.composerName}</span>}
                </span>
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

            <div className="discogs-preview-options">
              <ArtworkPicker
                images={mbCoverArt.images}
                selection={mbArtworkSelection}
                onChange={setMbArtworkSelection}
                disabled={isApplyingMbMetadata}
                loading={mbCoverArt.loading}
                error={mbCoverArt.error}
              />
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
                  const hasRemoteOptions = (mbTrackPreview?.remoteTracks || []).length > 0;
                  const matchSelect = (
                    <select
                      autoFocus
                      className="mb-track-match-select"
                      style={{ marginTop: row.remoteTrack ? '6px' : 0 }}
                      value=""
                      onChange={(event) => handleManualTrackMatchSelect(row.localTrack?.ratingKey, event.target.value || null)}
                      onBlur={() => setEditingUnmatchedRowKey(null)}
                    >
                      <option value="">— Select a pulled track —</option>
                      {row.remoteTrack && <option value={NO_MATCH_KEY}>— No match (don&apos;t update this track) —</option>}
                      {(mbTrackPreview?.remoteTracks || []).map((remoteTrack) => {
                        const takenBy = mbRemoteMatchOwners.get(remoteTrack._previewKey);
                        const isCurrent = remoteTrack._previewKey === row.remoteTrack?._previewKey;
                        return (
                          <option key={remoteTrack._previewKey} value={remoteTrack._previewKey} disabled={isCurrent}>
                            Disc {remoteTrack.discNumber} · {remoteTrack.trackNumber}. {remoteTrack.title}
                            {isCurrent ? ' (current)' : (takenBy ? ` (matched to: ${takenBy})` : '')}
                          </option>
                        );
                      })}
                    </select>
                  );

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
                            {isEditingMatch ? matchSelect : (
                              <div className="discogs-credit-actions">
                                <button
                                  type="button"
                                  className="mb-track-match-clear-btn"
                                  onClick={() => setEditingUnmatchedRowKey(rowKey)}
                                >
                                  Change match
                                </button>
                                {row.isManualMatch && (
                                  <button
                                    type="button"
                                    className="mb-track-match-clear-btn"
                                    onClick={() => handleClearManualTrackMatch(row.localTrack?.ratingKey)}
                                  >
                                    Clear manual match
                                  </button>
                                )}
                              </div>
                            )}
                          </>
                        ) : isEditingMatch ? (
                          matchSelect
                        ) : (
                          <>
                            <button
                              type="button"
                              className="mb-track-match-empty-btn"
                              onClick={() => setEditingUnmatchedRowKey(rowKey)}
                              disabled={!hasRemoteOptions}
                              title={hasRemoteOptions ? 'Click to manually match a pulled track' : 'No pulled tracks available'}
                            >
                              {row.isManualNoMatch ? 'Manually left unmatched' : 'No pulled match'}{hasRemoteOptions ? ' — click to select' : ''}
                            </button>
                            {row.isManualNoMatch && (
                              <button
                                type="button"
                                className="mb-track-match-clear-btn"
                                onClick={() => handleClearManualTrackMatch(row.localTrack?.ratingKey)}
                              >
                                Restore automatic match
                              </button>
                            )}
                          </>
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

        {showDiscogsPreviewModal && discogsTrackPreview && (
          <div className="mb-track-match-preview">
            <div className="mb-track-match-preview-header">
              <div>
                <h3>{previewSourceLabel} Track Matches</h3>
                <p>
                  Pulled from &ldquo;{discogsPreview?.album?.discogsTitle || 'Unknown release'}&rdquo; ({previewSourceLabel} release{' '}
                  {discogsPreview?.discogs?.releaseUrl ? (
                    <a href={discogsPreview.discogs.releaseUrl} target="_blank" rel="noopener noreferrer">#{discogsPreview?.discogs?.releaseId}</a>
                  ) : `#${discogsPreview?.discogs?.releaseId || '?'}`}) — existing tracks are matched to the pulled {previewSourceLabel} tracks below.
                </p>
                {discogsApplyError && (
                  <p className="mb-track-match-apply-error">{discogsApplyError}</p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button
                  type="button"
                  className="album-works-select-btn"
                  onClick={closeDiscogsPreviewModal}
                  disabled={importingDiscogs}
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  className="album-works-merge-confirm"
                  onClick={handleAcceptDiscogsImport}
                  disabled={importingDiscogs}
                >
                  {importingDiscogs ? 'Applying…' : 'Apply Metadata'}
                </button>
              </div>
            </div>

            <div className="discogs-preview-options">
              <label className="discogs-preview-option">
                <input
                  type="checkbox"
                  checked={discogsLinkAllToAlbumWork}
                  onChange={(event) => setDiscogsLinkAllToAlbumWork(event.target.checked)}
                  disabled={importingDiscogs}
                />
                Link all matched tracks to a single work titled &ldquo;{(discogsPreview?.album?.discogsTitle || albumData?.title || 'Album Title').trim() || 'Album Title'}&rdquo;
              </label>
              {discogsLinkAllToAlbumWork && renderComposerChoice(
                discogsPreview?.mapping?.albumComposerOptions,
                discogsAlbumWorkComposerKey,
                setDiscogsAlbumWorkComposerKey,
                importingDiscogs
              )}

              {(discogsPreview?.mapping?.workGroups || []).length > 0 && (
                <>
                  <div className="mb-track-match-column-label">
                    Works ({discogsPreview.mapping.workGroups.length} found on {previewSourceLabel})
                    {discogsLinkAllToAlbumWork ? ' — overridden by “link all to a single work”' : ''}
                  </div>
                  <div className="discogs-credit-grid">
                    {discogsPreview.mapping.workGroups.map((group) => {
                      const selection = discogsWorkSelections[group.key] || group.defaultChoice || { mode: 'create' };
                      const selectValue = selection.mode === 'existing' ? `existing:${selection.workId}` : selection.mode;
                      const chosenCandidate = selection.mode === 'existing'
                        ? group.candidates.find((candidate) => candidate.id === Number(selection.workId))
                        : null;

                      return (
                        <div
                          key={group.key}
                          className={`mb-track-match-cell ${selection.mode === 'existing' ? 'matched' : ''} ${discogsLinkAllToAlbumWork || selection.mode === 'none' ? 'discogs-credit-cell excluded' : ''}`}
                        >
                          <div className="mb-track-match-cell-title">{group.title}</div>
                          <div className="mb-track-match-cell-meta">
                            {group.trackCount} track{group.trackCount !== 1 ? 's' : ''}
                            {group.composerName ? ` · ${group.composerName}` : ''}
                            {group.inferred ? ' · inferred from track title' : ''}
                          </div>
                          <select
                            className="mb-track-match-select"
                            style={{ marginTop: '6px' }}
                            value={selectValue}
                            disabled={importingDiscogs || discogsLinkAllToAlbumWork}
                            onChange={(event) => {
                              const value = event.target.value;
                              setDiscogsWorkSelections((prev) => ({
                                ...prev,
                                [group.key]: value.startsWith('existing:')
                                  ? { ...prev[group.key], mode: 'existing', workId: Number(value.slice('existing:'.length)) }
                                  : { ...prev[group.key], mode: value }
                              }));
                            }}
                          >
                            {group.candidates.map((candidate) => (
                              <option key={candidate.id} value={`existing:${candidate.id}`}>
                                Link to existing: {candidate.title}{candidate.composerName ? ` — ${candidate.composerName}` : ''} ({Math.round(candidate.score * 100)}%)
                              </option>
                            ))}
                            <option value="create">Create new work &ldquo;{group.title}&rdquo;</option>
                            <option value="none">Don&apos;t link to a work</option>
                          </select>
                          {selection.mode === 'create' && !discogsLinkAllToAlbumWork && renderComposerChoice(
                            group.composerOptions,
                            selection.composerKey || group.defaultComposerKey,
                            (composerKey) => setDiscogsWorkSelections((prev) => ({
                              ...prev,
                              [group.key]: { ...(prev[group.key] || group.defaultChoice || { mode: 'create' }), composerKey }
                            })),
                            importingDiscogs
                          )}
                          <div className="mb-track-match-cell-meta">
                            {selection.mode === 'existing' && chosenCandidate
                              ? `Existing work with ${chosenCandidate.partCount} part(s); tracks are matched to its parts by title.`
                              : (group.candidates.length === 0 ? 'No matching works found in your library.' : `${group.candidates.length} possible match(es) in your library.`)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <ArtworkPicker
                images={(discogsPreview?.discogs?.images || []).map((image) => ({
                  ...image,
                  label: `${image.width && image.height ? `${image.width}×${image.height}` : 'Unknown size'}${image.discogsType === 'primary' ? ' · primary' : ''}`
                }))}
                selection={discogsArtworkSelection}
                onChange={setDiscogsArtworkSelection}
                disabled={importingDiscogs}
              />

              <div className="mb-track-match-column-label">
                Artists to Import ({discogsImportArtistsPreview.includedCreditCount} of {discogsImportArtistsPreview.creditOptions.length} selected · {discogsImportArtistsPreview.matchedExistingCount} existing, {discogsImportArtistsPreview.newArtistCount} new)
              </div>
              {discogsImportArtistsPreview.creditOptions.length === 0 ? (
                <div className="mb-track-match-cell-meta">No artist credits will be imported with the current matches.</div>
              ) : (
                <div className="discogs-credit-grid">
                  {discogsImportArtistsPreview.creditOptions.map((credit) => {
                    const override = discogsArtistOverrides[credit.creditKey] || null;
                    const isEditing = editingCreditKey === credit.groupKey;
                    const typed = splitArtistNameAndType(creditArtistQuery);
                    const effectiveType = override?.typeName || credit.artistTypeName;
                    const isMatched = override ? Boolean(override.ratingKey) : credit.matchedExisting;

                    return (
                      <div
                        key={credit.groupKey}
                        className={`mb-track-match-cell discogs-credit-cell ${credit.excluded ? 'excluded' : (isMatched ? 'matched' : '')}`}
                      >
                        <label className="mb-track-match-cell-title">
                          <input
                            type="checkbox"
                            checked={!credit.excluded}
                            onChange={() => toggleDiscogsExcludedCredit(credit)}
                            disabled={importingDiscogs}
                          />
                          {credit.artistName} — {effectiveType}
                        </label>
                        <div className="mb-track-match-cell-meta" title={credit.trackTitles.length > 1 ? credit.trackTitles.join('\n') : undefined}>
                          {credit.sourceLabel}{credit.discogsTrackTitle ? ` · ${credit.discogsTrackTitle}` : ''}
                        </div>
                        <div className="mb-track-match-cell-meta">
                          {override?.ratingKey && `Will use existing artist: ${override.title}`}
                          {override && !override.ratingKey && `Will create new artist: ${override.createName}`}
                          {!override && (credit.matchedExisting
                            ? `Matches existing artist${credit.matchKind === 'fuzzy' ? ' (fuzzy)' : ''}: ${credit.matchedArtist?.title || credit.artistName}`
                            : 'New artist will be created')}
                        </div>

                        {isEditing ? (
                          <div className="discogs-credit-editor">
                            <input
                              autoFocus
                              type="text"
                              className="mb-track-match-select"
                              value={creditArtistQuery}
                              onChange={(event) => setCreditArtistQuery(event.target.value)}
                              onKeyDown={(event) => { if (event.key === 'Escape') closeCreditArtistEditor(); }}
                              placeholder="Artist name — Type"
                            />
                            <div className="mb-track-match-cell-meta">
                              {searchingCreditArtists ? 'Searching…' : 'Pick an existing artist or create a new one.'}
                            </div>
                            {creditArtistResults.map((artist) => (
                              <button
                                key={artist.ratingKey}
                                type="button"
                                className="mb-track-match-empty-btn discogs-credit-option"
                                onClick={() => setCreditArtistOverride(credit.creditKeys, {
                                  ratingKey: artist.ratingKey,
                                  title: artist.userTitle || artist.title,
                                  typeName: typed.typeName || credit.artistTypeName
                                })}
                              >
                                Use {artist.userTitle || artist.title} — {typed.typeName || credit.artistTypeName}
                              </button>
                            ))}
                            {typed.name && (
                              <button
                                type="button"
                                className="mb-track-match-empty-btn discogs-credit-option"
                                onClick={() => setCreditArtistOverride(credit.creditKeys, {
                                  createName: typed.name,
                                  typeName: typed.typeName || credit.artistTypeName
                                })}
                              >
                                + Create new artist &ldquo;{typed.name}&rdquo; — {typed.typeName || credit.artistTypeName}
                              </button>
                            )}
                            <button type="button" className="mb-track-match-clear-btn" onClick={closeCreditArtistEditor}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="discogs-credit-actions">
                            <button
                              type="button"
                              className="mb-track-match-clear-btn"
                              onClick={() => openCreditArtistEditor(credit)}
                              disabled={importingDiscogs || credit.excluded}
                            >
                              Change artist
                            </button>
                            {override && (
                              <button
                                type="button"
                                className="mb-track-match-clear-btn"
                                onClick={() => setCreditArtistOverride(credit.creditKeys, null)}
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mb-track-match-columns">
              <div className="mb-track-match-column-label">Existing Track</div>
              <div className="mb-track-match-column-label">Pulled {previewSourceLabel} Track</div>

              {(() => {
                let lastDiscNumber = null;
                return discogsTrackPreview.rows.map((row, index) => {
                  const localMs = Number(row.localTrack?.duration);
                  const remoteMs = Number(row.remoteTrack?.discogsTrackDurationMs);
                  const hasBothLengths = Number.isFinite(localMs) && localMs > 0 && Number.isFinite(remoteMs) && remoteMs > 0;
                  const isLengthMismatch = Boolean(row.remoteTrack) && hasBothLengths && Math.abs(localMs - remoteMs) > 10000;
                  const matchedCellClass = row.remoteTrack ? (isLengthMismatch ? 'matched matched-length-mismatch' : 'matched') : '';
                  const rowKey = row.localTrack?.ratingKey || `discogs-row-${index}`;
                  const remoteDiscNumber = row.remoteTrack?.discNumber || null;
                  const showDiscHeader = Boolean(remoteDiscNumber) && remoteDiscNumber !== lastDiscNumber;
                  if (remoteDiscNumber) {
                    lastDiscNumber = remoteDiscNumber;
                  }
                  const isEditingMatch = editingDiscogsRowKey === rowKey;
                  const hasUnmatchedOptions = discogsTrackPreview.unmatchedRemoteTracks.length > 0;

                  return (
                    <React.Fragment key={rowKey}>
                      {showDiscHeader && (
                        <div className="mb-track-match-disc-header">Disc {remoteDiscNumber}</div>
                      )}
                      <div className="mb-track-match-cell">
                        <div className="mb-track-match-cell-title">
                          {`${row.localTrack.index || index + 1}. ${row.localTrack.title || 'Untitled'}`}
                        </div>
                        {formatMilliseconds(row.localTrack.duration) && (
                          <div className="mb-track-match-cell-meta">Length: {formatMilliseconds(row.localTrack.duration)}</div>
                        )}
                      </div>
                      <div className={`mb-track-match-cell ${matchedCellClass}`}>
                        {row.remoteTrack ? (
                          <>
                            <div className="mb-track-match-cell-title">
                              {row.remoteTrack.trackNumber || row.remoteTrack.discogsTrackIndex}. {row.remoteTrack.discogsTrackTitle || 'Untitled'}
                            </div>
                            {formatMilliseconds(row.remoteTrack.discogsTrackDurationMs) && (
                              <div className="mb-track-match-cell-meta">Length: {formatMilliseconds(row.remoteTrack.discogsTrackDurationMs)}</div>
                            )}
                            <div className="mb-track-match-cell-meta">{previewSourceLabel} position: {row.remoteTrack.discogsTrackIndex}</div>
                            {isLengthMismatch && (
                              <div className="mb-track-match-cell-meta mb-track-match-length-warning">
                                Length differs by {formatMilliseconds(Math.abs(localMs - remoteMs))}
                              </div>
                            )}
                            <div className="mb-track-match-cell-changes">{row.changes}</div>
                            <button
                              type="button"
                              className="mb-track-match-clear-btn"
                              onClick={() => handleClearDiscogsMatch(row.localTrack.ratingKey)}
                            >
                              {row.isManualMatch ? 'Clear manual match' : 'Clear match'}
                            </button>
                          </>
                        ) : isEditingMatch ? (
                          <select
                            autoFocus
                            className="mb-track-match-select"
                            value=""
                            onChange={(event) => handleDiscogsManualMatch(row.localTrack.ratingKey, Number.parseInt(event.target.value, 10))}
                            onBlur={() => setEditingDiscogsRowKey(null)}
                          >
                            <option value="">— Select a pulled track —</option>
                            {discogsTrackPreview.unmatchedRemoteTracks.map((remoteTrack) => (
                              <option key={remoteTrack.discogsOrdinal} value={remoteTrack.discogsOrdinal}>
                                {remoteTrack.discNumber ? `Disc ${remoteTrack.discNumber} · ` : ''}{remoteTrack.trackNumber || remoteTrack.discogsTrackIndex}. {remoteTrack.discogsTrackTitle}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <button
                            type="button"
                            className="mb-track-match-empty-btn"
                            onClick={() => setEditingDiscogsRowKey(rowKey)}
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

            {discogsTrackPreview.unmatchedRemoteTracks.length > 0 && (
              <div className="mb-track-match-unmatched">
                <div className="mb-track-match-column-label">Unmatched Pulled Tracks</div>
                {(() => {
                  let lastUnmatchedDiscNumber = null;
                  return discogsTrackPreview.unmatchedRemoteTracks.map((remoteTrack) => {
                    const showDiscHeader = Boolean(remoteTrack.discNumber) && remoteTrack.discNumber !== lastUnmatchedDiscNumber;
                    lastUnmatchedDiscNumber = remoteTrack.discNumber;

                    return (
                      <React.Fragment key={remoteTrack.discogsOrdinal}>
                        {showDiscHeader && (
                          <div className="mb-track-match-disc-header">Disc {remoteTrack.discNumber}</div>
                        )}
                        <div className="mb-track-match-cell">
                          <div className="mb-track-match-cell-title">
                            {remoteTrack.discogsTrackIndex} {remoteTrack.discogsTrackTitle}
                          </div>
                          {formatMilliseconds(remoteTrack.discogsTrackDurationMs) && (
                            <div className="mb-track-match-cell-meta">Length: {formatMilliseconds(remoteTrack.discogsTrackDurationMs)}</div>
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
                const groupSpansDiscs = group.discNumbers.size > 1;
                lastRenderedDiscNumber = inferDiscNumberFromTrack(group.tracks[group.tracks.length - 1]) || 1;

                return (
                  <React.Fragment key={group.key}>
                    {showDiscHeader && (
                      <div className="disc-group-header">
                        <span className="disc-group-title">Disc {group.discNumber}</span>
                      </div>
                    )}
                    <div className="track-group">
                <div className="track-group-header">
                  <span className="track-group-title">
                    {group.workId ? (
                      <span
                        className="track-group-work-link"
                        role="link"
                        tabIndex={0}
                        onClick={() => onSelectWork && onSelectWork(group.workId)}
                        onKeyDown={(event) => { if (event.key === 'Enter') onSelectWork && onSelectWork(group.workId); }}
                        title="Open work details"
                      >
                        {group.title}
                      </span>
                    ) : group.title}
                    {group.composerName && <span className="album-work-item-composer"> — {group.composerName}</span>}
                  </span>
                  <span className="track-group-count">
                    {group.tracks.length} track{group.tracks.length !== 1 ? 's' : ''}
                    {groupSpansDiscs ? ` · ${group.discNumbers.size} discs` : ''}
                  </span>
                </div>

                {group.tracks.map((track, index) => {
                  const trackDisc = inferDiscNumberFromTrack(track) || 1;
                  const previousDisc = index > 0 ? (inferDiscNumberFromTrack(group.tracks[index - 1]) || 1) : group.discNumber;
                  const showInnerDiscHeader = groupSpansDiscs && index > 0 && trackDisc !== previousDisc;

                  return (
                  <React.Fragment key={track.ratingKey}>
                  {showInnerDiscHeader && (
                    <div className="disc-group-header disc-group-header-inner">
                      <span className="disc-group-title">Disc {trackDisc}</span>
                    </div>
                  )}
                  <div 
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
                          Work:{' '}
                          <span
                            className="track-group-work-link"
                            role="link"
                            tabIndex={0}
                            onClick={() => onSelectWork && onSelectWork(group.workId)}
                            onKeyDown={(event) => { if (event.key === 'Enter') onSelectWork && onSelectWork(group.workId); }}
                          >
                            {group.title}
                          </span>
                          {group.composerName ? ` — ${group.composerName}` : ''}
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
                  </React.Fragment>
                  );
                })}
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

      {/* Discogs Identify Modal */}
      <DiscogsIdentifyModal
        isOpen={showDiscogsSearchModal}
        onClose={closeDiscogsSearchModal}
        albumRatingKey={albumData.ratingKey}
        albumTitle={albumData.title}
        onAccept={handleSelectDiscogsRelease}
      />

      {/* Publisher catalogue search (same flow as Discogs) */}
      <PublisherPickerModal
        isOpen={showPublisherPicker}
        onClose={() => setShowPublisherPicker(false)}
        onSelect={handleSelectPublisher}
      />
      <DiscogsIdentifyModal
        isOpen={Boolean(activePublisher)}
        onClose={() => setActivePublisher(null)}
        albumRatingKey={albumData.ratingKey}
        albumTitle={albumData.title}
        sourceLabel={activePublisher?.label || 'Publisher'}
        searchUrl={activePublisher
          ? `${config.apiBaseUrl}/api/music/publishers/${encodeURIComponent(activePublisher.key)}/albums/${encodeURIComponent(albumData.ratingKey)}/search`
          : null}
        onAccept={handleSelectPublisherRelease}
      />

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
