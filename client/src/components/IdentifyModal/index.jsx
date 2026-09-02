import React, { useState, useEffect } from 'react';
import { X, Search, Check, AlertCircle, Music, Calendar, Disc, ExternalLink } from 'lucide-react';
import config from '../../config';

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
 * - onAcceptCandidate: (candidate, releaseData) => void (album only; fired right before the
 *   modal closes so the parent can render a track-by-track comparison next to the tracklist)
 */
const IdentifyModal = ({ 
  isOpen, 
  onClose, 
  entityType, 
  entityKey, 
  entityTitle,
  albumTracks = [],
  onIdentified,
  onAcceptCandidate
}) => {
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [error, setError] = useState(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      searchMusicBrainz();
    } else {
      // Reset state when modal closes
      setCandidates([]);
      setSelectedCandidate(null);
      setError(null);
    }
  }, [isOpen, entityKey]);

  const searchMusicBrainz = async () => {
    setLoading(true);
    setError(null);

    const requestUrl = `/api/identification/${entityType}/${entityKey}`;
    const requestBody = { plexUrl: config.plexUrl, plexToken: config.plexToken };
    console.log('[IdentifyModal] Sending identification request:', { url: requestUrl, body: requestBody, entityType, entityKey, entityTitle });
    
    try {
      const response = await fetch(
        requestUrl,
        { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        }
      );
      
      const data = await response.json();
      console.log('[IdentifyModal] Identification response:', data);
      
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
    setError(null);
    setAccepting(true);

    try {
      // Call the accept API to pull the full release data
      const response = await fetch(
        `/api/identification/accept/${candidate.id}`,
        { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plexUrl: config.plexUrl, plexToken: config.plexToken })
        }
      );
      
      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to accept candidate');
        return;
      }

      // The route wraps the release payload as { data: releaseData, candidate, message }.
      const releaseData = data.data?.data;

      if (entityType === 'album') {
        // Close the modal immediately, then hand the raw MusicBrainz release data up to the
        // parent so it can render the track comparison next to the existing tracklist.
        onClose();

        if (releaseData?.media) {
          onAcceptCandidate?.(candidate, releaseData);
        }
        return;
      }

      // Artists have no per-track review step, so apply the metadata immediately, reusing the
      // data we already fetched above to avoid a second MusicBrainz round trip.
      const applyResponse = await fetch(
        `/api/identification/apply/${candidate.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metadata: releaseData })
        }
      );

      const applyData = await applyResponse.json();

      if (!applyData.success) {
        setError(applyData.error || 'Failed to apply artist metadata');
        return;
      }

      onClose();
      onIdentified?.(applyData.data?.entity);
    } catch (err) {
      console.error('Error accepting candidate:', err);
      setError('Failed to accept candidate');
    } finally {
      setAccepting(false);
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-7xl w-full max-h-[92vh] flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Search size={24} />
              Identify {entityType === 'album' ? 'Album' : 'Artist'}
            </h2>
            {/* Local cover art in header */}
            {entityType === 'album' && candidates.length > 0 && candidates[0].albumCoverLocal && (
              <img 
                src={candidates[0].albumCoverLocal} 
                className="w-30 h-30 rounded object-cover" 
                alt="Local cover" 
              />
            )}
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
                        <div className="flex items-center gap-3 mt-2">
                          <p className="text-xs text-gray-600">
                            MusicBrainz ID: {candidate.musicBrainzId}
                          </p>
                          <a
                            href={`https://musicbrainz.org/${candidate.musicBrainzEntityType || (entityType === 'album' ? 'release' : 'artist')}/${candidate.musicBrainzId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline"
                            title="Open on MusicBrainz in a new tab"
                          >
                            <ExternalLink size={12} />
                            View on MusicBrainz
                          </a>
                        </div>
                      </div>

                      {/* MusicBrainz cover on the right */}
                      {entityType === 'album' && candidate.albumCoverMusicBrainz && (
                        <div className="flex items-center gap-2 ml-4">
                          <img 
                            src={candidate.albumCoverMusicBrainz} 
                            className="w-30 h-30 rounded object-cover" 
                            alt="MusicBrainz cover" 
                          />
                        </div>
                      )}

                      {/* Selected indicator */}
                      {isSelected && (
                        <Check size={24} className="text-blue-400 flex-shrink-0 ml-4" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 p-6 flex items-center justify-between">
          <button
            onClick={markAsManual}
            className="text-gray-400 hover:text-white transition-colors"
          >
            None of these match
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-600 text-white rounded hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => selectedCandidate && acceptCandidate(selectedCandidate)}
              disabled={!selectedCandidate || accepting}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={16} />
              {accepting ? 'Accepting…' : 'Accept & Apply Metadata'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdentifyModal;
