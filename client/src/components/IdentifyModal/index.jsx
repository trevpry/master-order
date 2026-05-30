import React, { useState, useEffect } from 'react';
import { X, Search, Check, AlertCircle, Music, Calendar, Disc } from 'lucide-react';

/**
 * IdentifyModal Component
 * 
 * Modal for identifying albums/artists with MusicBrainz
 * Shows ranked matches with confidence scores
 * 
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - entityType: 'album' | 'artist'
 * - entityKey: string (ratingKey)
 * - entityTitle: string (current title for display)
 * - onIdentified: (entity) => void (callback after successful identification)
 */
const IdentifyModal = ({ 
  isOpen, 
  onClose, 
  entityType, 
  entityKey, 
  entityTitle,
  albumTracks = [],
  onIdentified 
}) => {
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showAlbumDetails, setShowAlbumDetails] = useState(false);
  const [albumDetails, setAlbumDetails] = useState(null);
  const [albumDetailsCandidateId, setAlbumDetailsCandidateId] = useState(null);
  const [albumDetailsLoading, setAlbumDetailsLoading] = useState(false);
  const [albumDetailsError, setAlbumDetailsError] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      searchMusicBrainz();
    } else {
      // Reset state when modal closes
      setCandidates([]);
      setSelectedCandidate(null);
      setShowAlbumDetails(false);
      setAlbumDetails(null);
      setAlbumDetailsCandidateId(null);
      setAlbumDetailsLoading(false);
      setAlbumDetailsError(null);
      setError(null);
    }
  }, [isOpen, entityKey]);

  useEffect(() => {
    setShowAlbumDetails(false);
    setAlbumDetails(null);
    setAlbumDetailsCandidateId(null);
    setAlbumDetailsLoading(false);
    setAlbumDetailsError(null);
  }, [selectedCandidate?.id]);

  const searchMusicBrainz = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/identification/${entityType}/${entityKey}`,
        { method: 'POST' }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setCandidates(data.data.candidates);
        if (data.data.candidates.length === 0) {
          setError('No matches found in MusicBrainz');
        }
      } else {
        setError(data.error || 'Failed to search MusicBrainz');
      }
    } catch (err) {
      console.error('Error searching MusicBrainz:', err);
      setError('Failed to connect to MusicBrainz');
    } finally {
      setLoading(false);
    }
  };

  const acceptCandidate = async (candidate) => {
    setAccepting(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/identification/accept/${candidate.id}`,
        { method: 'POST' }
      );
      
      const data = await response.json();
      
      if (data.success) {
        if (onIdentified) {
          onIdentified(data.data.entity);
        }
        onClose();
      } else {
        setError(data.error || 'Failed to apply identification');
      }
    } catch (err) {
      console.error('Error accepting candidate:', err);
      setError('Failed to apply identification');
    } finally {
      setAccepting(false);
    }
  };

  const flattenReleaseTracks = (releaseDetails) => {
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

  const buildTrackPreview = () => {
    if (!albumDetails) {
      return { rows: [], unmatchedRemoteTracks: [] };
    }

    const local = [...(albumTracks || [])].sort((left, right) => (left.index || 0) - (right.index || 0));
    const remote = flattenReleaseTracks(albumDetails);
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

    const rows = local.map((localTrack) => {
      const remoteTrack = findStrictMatch(localTrack);
      if (remoteTrack) {
        usedRemoteTrackKeys.add(remoteTrack._previewKey);
      }

      const changes = [];

      if (remoteTrack) {
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
        changes: changes.length > 0 ? changes.join(', ') : 'No change'
      };
    });

    const unmatchedRemoteTracks = remote.filter((remoteTrack) => !usedRemoteTrackKeys.has(remoteTrack._previewKey));

    return { rows, unmatchedRemoteTracks };
  };

  const loadAlbumDetails = async () => {
    if (!selectedCandidate?.musicBrainzId) {
      return;
    }

    if (albumDetails && albumDetailsCandidateId === selectedCandidate.id) {
      setShowAlbumDetails((value) => !value);
      return;
    }

    setAlbumDetailsLoading(true);
    setAlbumDetailsError(null);

    try {
      const response = await fetch(
        `/api/musicbrainz/release/${selectedCandidate.musicBrainzId}?inc=artists+labels+recordings+release-groups+media+recording-rels+work-rels+work-level-rels`
      );

      if (!response.ok) {
        throw new Error('Failed to load album details');
      }

      const result = await response.json();
      setAlbumDetails(result.data || null);
      setAlbumDetailsCandidateId(selectedCandidate.id);
      setShowAlbumDetails(true);
    } catch (err) {
      console.error('Error loading album details:', err);
      setAlbumDetailsError(err.message || 'Failed to load album details');
    } finally {
      setAlbumDetailsLoading(false);
    }
  };

  const markAsManual = async () => {
    setAccepting(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/identification/manual/${entityType}/${entityKey}`,
        { method: 'POST' }
      );
      
      const data = await response.json();
      
      if (data.success) {
        onClose();
      } else {
        setError(data.error || 'Failed to mark as manual');
      }
    } catch (err) {
      console.error('Error marking as manual:', err);
      setError('Failed to mark as manual');
    } finally {
      setAccepting(false);
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.9) return 'text-green-400';
    if (confidence >= 0.7) return 'text-yellow-400';
    if (confidence >= 0.5) return 'text-orange-400';
    return 'text-red-400';
  };

  const getConfidenceLabel = (confidence) => {
    if (confidence >= 0.95) return 'Excellent Match';
    if (confidence >= 0.85) return 'Very Good Match';
    if (confidence >= 0.7) return 'Good Match';
    if (confidence >= 0.5) return 'Fair Match';
    return 'Poor Match';
  };

  if (!isOpen) return null;

  const trackPreview = showAlbumDetails ? buildTrackPreview() : { rows: [], unmatchedRemoteTracks: [] };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-7xl w-full max-h-[92vh] flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Search size={24} />
              Identify {entityType === 'album' ? 'Album' : 'Artist'}
            </h2>
            <p className="text-gray-400 mt-1">
              {entityTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Search size={48} className="text-blue-400 animate-pulse mb-4" />
              <p className="text-gray-400">Searching MusicBrainz...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle size={48} className="text-red-400 mb-4" />
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={searchMusicBrainz}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded"
              >
                Try Again
              </button>
            </div>
          ) : candidates.length > 0 ? (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm mb-4">
                Found {candidates.length} potential matches. Select the correct one:
              </p>
              
              {candidates.map((candidate, index) => {
                const metadata = JSON.parse(candidate.metadata);
                const isSelected = selectedCandidate?.id === candidate.id;
                
                return (
                  <div
                    key={candidate.id}
                    className={`border rounded-lg p-4 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 bg-blue-900 bg-opacity-20'
                        : 'border-gray-700 hover:border-gray-600 bg-gray-800'
                    }`}
                    onClick={() => setSelectedCandidate(candidate)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Rank and confidence */}
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl font-bold text-gray-500">
                            #{index + 1}
                          </span>
                          <div>
                            <span className={`font-semibold ${getConfidenceColor(candidate.confidence)}`}>
                              {Math.round(candidate.confidence * 100)}% Match
                            </span>
                            <span className="text-gray-500 text-sm ml-2">
                              ({getConfidenceLabel(candidate.confidence)})
                            </span>
                          </div>
                        </div>

                        {/* Title */}
                        <h3 className="text-xl font-bold text-white mb-2">
                          {candidate.title}
                        </h3>

                        {/* Details */}
                        <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                          {entityType === 'album' && candidate.artist && (
                            <div className="flex items-center gap-1">
                              <Music size={14} />
                              {candidate.artist}
                            </div>
                          )}
                          {candidate.releaseDate && (
                            <div className="flex items-center gap-1">
                              <Calendar size={14} />
                              {new Date(candidate.releaseDate).getFullYear()}
                            </div>
                          )}
                          {entityType === 'album' && metadata['track-count'] && (
                            <div className="flex items-center gap-1">
                              <Disc size={14} />
                              {metadata['track-count']} tracks
                            </div>
                          )}
                        </div>

                        {/* Disambiguation */}
                        {metadata.disambiguation && (
                          <p className="text-sm text-gray-500 mt-2 italic">
                            {metadata.disambiguation}
                          </p>
                        )}

                        {/* MusicBrainz ID */}
                        <p className="text-xs text-gray-600 mt-2">
                          MusicBrainz ID: {candidate.musicBrainzId}
                        </p>
                      </div>

                      {/* Selected indicator */}
                      {isSelected && (
                        <Check size={24} className="text-blue-400 flex-shrink-0 ml-4" />
                      )}
                    </div>
                  </div>
                );
              })}

              {entityType === 'album' && selectedCandidate && showAlbumDetails && (
                <div className="mt-6 border border-gray-700 rounded-lg bg-gray-800 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="text-xl font-bold text-white">View Album Details</h3>
                      <p className="text-gray-400 text-sm">
                        Pulled MusicBrainz data and the current database track list for {entityTitle}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAlbumDetails(false)}
                      className="px-3 py-2 border border-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                    >
                      Back to Matches
                    </button>
                  </div>

                  {albumDetailsLoading ? (
                    <div className="py-8 text-center text-gray-400">Loading album details...</div>
                  ) : albumDetailsError ? (
                    <div className="text-red-400 bg-red-950/40 border border-red-900 rounded p-3">
                      {albumDetailsError}
                    </div>
                  ) : albumDetails ? (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <div className="border border-gray-700 rounded-lg bg-gray-900 p-4">
                          <h4 className="text-lg font-semibold text-white mb-3">Pulled Data</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div>
                              <div className="text-gray-400">Title</div>
                              <div className="text-white">{albumDetails.title || 'Unknown'}</div>
                            </div>
                            <div>
                              <div className="text-gray-400">Artist</div>
                              <div className="text-white">{albumDetails['artist-credit']?.map((credit) => credit.name || credit.artist?.name).join(', ') || 'Unknown'}</div>
                            </div>
                            <div>
                              <div className="text-gray-400">Release Date</div>
                              <div className="text-white">{albumDetails.date || 'Unknown'}</div>
                            </div>
                            <div>
                              <div className="text-gray-400">Country</div>
                              <div className="text-white">{albumDetails.country || 'Unknown'}</div>
                            </div>
                            <div>
                              <div className="text-gray-400">Status</div>
                              <div className="text-white">{albumDetails.status || 'Unknown'}</div>
                            </div>
                            <div>
                              <div className="text-gray-400">Packaging</div>
                              <div className="text-white">{albumDetails.packaging || 'Unknown'}</div>
                            </div>
                            <div>
                              <div className="text-gray-400">Barcode</div>
                              <div className="text-white">{albumDetails.barcode || 'Unknown'}</div>
                            </div>
                            <div>
                              <div className="text-gray-400">Media</div>
                              <div className="text-white">
                                {(albumDetails.media || []).length} disc{(albumDetails.media || []).length === 1 ? '' : 's'}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 text-sm">
                            <div className="text-gray-400 mb-1">Label</div>
                            <div className="text-white">
                              {(albumDetails['label-info'] || []).length > 0
                                ? albumDetails['label-info'].map((entry) => `${entry.label?.name || 'Unknown'}${entry['catalog-number'] ? ` (${entry['catalog-number']})` : ''}`).join(', ')
                                : 'Unknown'}
                            </div>
                          </div>

                          <details className="mt-4">
                            <summary className="cursor-pointer text-blue-300 hover:text-blue-200 text-sm">Raw pulled data</summary>
                            <pre className="mt-3 max-h-64 overflow-auto rounded bg-black/40 p-3 text-xs text-gray-300 whitespace-pre-wrap break-all">
                              {JSON.stringify(albumDetails, null, 2)}
                            </pre>
                          </details>
                        </div>
                      </div>

                      <div className="border border-gray-700 rounded-lg bg-gray-900 p-4">
                        <h4 className="text-lg font-semibold text-white mb-3">Track Updates</h4>
                        {trackPreview.rows.length === 0 ? (
                          <div className="text-gray-400 text-sm">No local track data available for comparison.</div>
                        ) : (
                          <div className="space-y-3 max-h-[52vh] overflow-y-auto pr-1">
                            {trackPreview.rows.map((row, index) => (
                              <div key={index} className="border border-gray-700 rounded p-3 bg-gray-800/60">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Database track</div>
                                    <div className="text-white font-medium truncate">
                                      {row.localTrack ? `${row.localTrack.index || index + 1}. ${row.localTrack.title || 'Untitled'}` : 'No database track'}
                                    </div>
                                    {row.localTrack?.work?.title && (
                                      <div className="text-xs text-gray-400 mt-1">Work: {row.localTrack.work.title}</div>
                                    )}
                                    {row.localTrack?.musicBrainzTrackId && (
                                      <div className="text-xs text-gray-400 mt-1">MB Recording ID: {row.localTrack.musicBrainzTrackId}</div>
                                    )}
                                  </div>
                                  <div className="text-right min-w-0">
                                    <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Will update to</div>
                                    <div className="text-white font-medium truncate">
                                      {row.remoteTrack ? `${row.remoteTrack.trackNumber || index + 1}. ${row.remoteTrack.title}` : 'No MusicBrainz track'}
                                    </div>
                                    {row.remoteTrack?.workTitle && (
                                      <div className="text-xs text-gray-400 mt-1">Work: {row.remoteTrack.workTitle}</div>
                                    )}
                                    {row.remoteTrack?.recordingId && (
                                      <div className="text-xs text-gray-400 mt-1">MB Recording ID: {row.remoteTrack.recordingId}</div>
                                    )}
                                  </div>
                                </div>
                                <div className="mt-2 text-xs text-gray-300 bg-black/20 rounded px-2 py-1">
                                  {row.changes}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {trackPreview.unmatchedRemoteTracks.length > 0 && (
                          <div className="mt-4 border-t border-gray-700 pt-4">
                            <h5 className="text-sm font-semibold text-white mb-3">Unmatched MusicBrainz Tracks</h5>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                              {trackPreview.unmatchedRemoteTracks.map((remoteTrack) => (
                                <div key={remoteTrack._previewKey} className="border border-gray-700 rounded px-3 py-2 bg-black/20 text-sm text-gray-300">
                                  <div className="font-medium text-white">
                                    {remoteTrack.discNumber}.{remoteTrack.trackNumber} {remoteTrack.title}
                                  </div>
                                  {remoteTrack.recordingId && (
                                    <div className="text-xs text-gray-400 mt-1">MB Recording ID: {remoteTrack.recordingId}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 p-6 flex items-center justify-between">
          <button
            onClick={markAsManual}
            disabled={accepting}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            None of these match
          </button>
          
          <div className="flex gap-3">
            {entityType === 'album' && selectedCandidate && (
              <button
                onClick={loadAlbumDetails}
                disabled={albumDetailsLoading}
                className="px-6 py-2 border border-blue-500 text-blue-300 rounded hover:bg-blue-950 transition-colors disabled:opacity-50"
              >
                {showAlbumDetails ? 'Hide Album Details' : 'View Album Details'}
              </button>
            )}
            <button
              onClick={onClose}
              disabled={accepting}
              className="px-6 py-2 border border-gray-600 text-white rounded hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => selectedCandidate && acceptCandidate(selectedCandidate)}
              disabled={!selectedCandidate || accepting}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {accepting ? (
                <>
                  <Search size={16} className="animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Accept & Apply Metadata
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdentifyModal;
