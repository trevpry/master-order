import React, { useState, useEffect } from 'react';
import config from '../../../../../config';
import TracksPlaylistPlayer from './TracksPlaylistPlayer';
import StarRating from '../../../../../components/StarRating';
import IdentifyModal from '../../../../../components/IdentifyModal';
import MetadataEditor from '../../../../../components/MetadataEditor';
import EmbeddedPicardTagsPanel from './EmbeddedPicardTagsPanel';
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
  const [composerSearch, setComposerSearch] = useState('');
  const [composerResults, setComposerResults] = useState([]);
  const [searchingComposer, setSearchingComposer] = useState(false);
  const [selectedComposer, setSelectedComposer] = useState(null);
  const [composerWorks, setComposerWorks] = useState([]);
  const [workSearch, setWorkSearch] = useState('');
  const [selectedWork, setSelectedWork] = useState(null);
  const [selectedPart, setSelectedPart] = useState(null);
  const [linkingTrack, setLinkingTrack] = useState(false);
  const [disconnectingTrackKey, setDisconnectingTrackKey] = useState(null);
  const [disconnectingWorkTrackKey, setDisconnectingWorkTrackKey] = useState(null);
  
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

  const buildTrackGroups = (trackList) => {
    const sortedTracks = [...(trackList || [])].sort((left, right) => {
      const leftIndex = Number.isInteger(left.index) ? left.index : Number.MAX_SAFE_INTEGER;
      const rightIndex = Number.isInteger(right.index) ? right.index : Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex;
    });

    const groups = [];
    const groupMap = new Map();

    for (const track of sortedTracks) {
      const workId = track.work?.id || null;
      const workTitle = track.work?.title || 'Standalone Tracks';
      const groupKey = workId ? `work-${workId}` : `standalone-${track.ratingKey}`;

      if (!groupMap.has(groupKey)) {
        const group = {
          key: groupKey,
          workId,
          title: workTitle,
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
        <div style={{ display: 'flex', gap: '0.5rem' }}>
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
        <h2>Tracks</h2>
        {!tracks || tracks.length === 0 ? (
          <div className="empty-state">
            <p>No tracks found for this album.</p>
          </div>
        ) : (
          <div className="tracks-table">
            <div className="tracks-header">
              <span className="track-controls">▶</span>
              <span className="track-number">#</span>
              <span className="track-title">Title</span>
              <span className="track-rating">Rating</span>
              <span className="track-plays">Plays</span>
              <span className="track-duration">Duration</span>
              <span className="track-size">Size</span>
              <span className="track-playlist">Playlist</span>
            </div>
            {trackGroups.map((group) => (
              <div key={group.key} className="track-group">
                <div className="track-group-header">
                  <span className="track-group-title">{group.title}</span>
                  <span className="track-group-count">{group.tracks.length} track{group.tracks.length !== 1 ? 's' : ''}</span>
                </div>

                {group.tracks.map((track, index) => (
                  <div 
                    key={track.ratingKey} 
                    className={`track-row ${currentTrack?.ratingKey === track.ratingKey ? 'playing' : ''}`}
                  >
                    <button 
                      className={`track-play-button ${currentTrack?.ratingKey === track.ratingKey && isPlaying ? 'playing' : ''}`}
                      onClick={() => onPlayTrack(track)}
                      title={currentTrack?.ratingKey === track.ratingKey && isPlaying ? 'Pause' : 'Play'}
                    >
                      {currentTrack?.ratingKey === track.ratingKey && isPlaying ? '⏸' : '▶'}
                    </button>
                    <span className="track-number">{track.index || index + 1}</span>
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
            ))}
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
      />

      {showLinkWorkModal && (
        <div className="modal-overlay" onClick={closeLinkWorkModal}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <h2>Link Track to Work</h2>
            <p className="track-link-modal-subtitle">
              Track: {trackToLink?.title || 'Unknown Track'}
            </p>

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

            {selectedWork && (
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
                onClick={handleLinkTrackToWork}
                disabled={!selectedWork || !selectedPart || linkingTrack}
              >
                {linkingTrack ? 'Linking...' : 'Link Track'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlbumDetail;
