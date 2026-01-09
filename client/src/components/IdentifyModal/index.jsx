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
  onIdentified 
}) => {
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);

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
      <div className="bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col border border-gray-700">
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
