import React, { useState, useEffect } from 'react';
import { X, Search, Check, AlertCircle, Music, Calendar, Disc, ExternalLink, Tag } from 'lucide-react';
import config from '../../config';

/**
 * DiscogsIdentifyModal
 *
 * Searches Discogs by the album's title and artists and shows ranked release matches with
 * confidence scores, mirroring the MusicBrainz IdentifyModal.
 *
 * Props:
 * - isOpen, onClose
 * - albumRatingKey, albumTitle
 * - onAccept: (candidate) => void|Promise (fired with the chosen release)
 */
const DiscogsIdentifyModal = ({ isOpen, onClose, albumRatingKey, albumTitle, onAccept }) => {
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [error, setError] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [query, setQuery] = useState('');
  const [localSummary, setLocalSummary] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      searchDiscogs('');
    } else {
      setCandidates([]);
      setSelectedCandidate(null);
      setError(null);
      setLocalSummary(null);
    }
  }, [isOpen, albumRatingKey]);

  const searchDiscogs = async (customQuery = query) => {
    setLoading(true);
    setError(null);
    setSelectedCandidate(null);

    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/music/albums/${encodeURIComponent(albumRatingKey)}/discogs-search`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: String(customQuery || '').trim() || null })
        }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        setCandidates([]);
        setError(data.error || 'Failed to search Discogs');
        return;
      }

      setCandidates(data.data.candidates || []);
      setLocalSummary(data.data.local || null);
      if (!customQuery) setQuery(data.data.query || '');
      if ((data.data.candidates || []).length === 0) {
        setError('No matches found on Discogs');
      }
    } catch (err) {
      console.error('Error searching Discogs:', err);
      setError('Failed to connect to Discogs');
    } finally {
      setLoading(false);
    }
  };

  const acceptCandidate = async (candidate) => {
    setAccepting(true);
    try {
      onClose();
      await onAccept?.(candidate);
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
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Search size={24} />
              Identify Album on Discogs
            </h2>
            {albumTitle && <p className="text-sm text-gray-400 mt-1">{albumTitle}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Search refinement */}
        <form
          className="flex gap-2 px-6 pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            searchDiscogs(query);
          }}
        >
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Refine search (artist and album title)"
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm disabled:opacity-50"
          >
            Search
          </button>
        </form>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Search size={48} className="text-blue-400 animate-pulse mb-4" />
              <p className="text-gray-400">Searching Discogs...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle size={48} className="text-red-400 mb-4" />
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={() => searchDiscogs(query)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded"
              >
                Try Again
              </button>
            </div>
          ) : candidates.length > 0 ? (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm mb-4">
                Found {candidates.length} potential matches
                {localSummary ? ` for ${localSummary.trackCount} local track(s) on ${localSummary.discCount} disc(s)` : ''}.
                Select the correct one:
              </p>

              {candidates.map((candidate, index) => {
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
                    onDoubleClick={() => acceptCandidate(candidate)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl font-bold text-gray-500">#{index + 1}</span>
                          <div>
                            <span className={`font-semibold ${getConfidenceColor(candidate.confidence)}`}>
                              {Math.round(candidate.confidence * 100)}% Match
                            </span>
                            <span className="text-gray-500 text-sm ml-2">
                              ({getConfidenceLabel(candidate.confidence)})
                            </span>
                          </div>
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2">{candidate.title}</h3>

                        <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                          {candidate.artist && (
                            <div className="flex items-center gap-1">
                              <Music size={14} />
                              {candidate.artist}
                            </div>
                          )}
                          {candidate.year && (
                            <div className="flex items-center gap-1">
                              <Calendar size={14} />
                              {candidate.year}{candidate.country ? ` · ${candidate.country}` : ''}
                            </div>
                          )}
                          {candidate.format && (
                            <div className="flex items-center gap-1">
                              <Disc size={14} />
                              {candidate.formatQuantity > 1 ? `${candidate.formatQuantity} × ` : ''}{candidate.format}
                            </div>
                          )}
                          {candidate.label && (
                            <div className="flex items-center gap-1">
                              <Tag size={14} />
                              {candidate.label}{candidate.catno ? ` (${candidate.catno})` : ''}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-2">
                          <p className="text-xs text-gray-600">Discogs release: {candidate.id}</p>
                          <a
                            href={candidate.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline"
                            title="Open on Discogs in a new tab"
                          >
                            <ExternalLink size={12} />
                            View on Discogs
                          </a>
                        </div>
                      </div>

                      {candidate.thumb && (
                        <div className="flex items-center gap-2 ml-4">
                          <img src={candidate.thumb} className="w-30 h-30 rounded object-cover" alt="Discogs cover" />
                        </div>
                      )}

                      {isSelected && <Check size={24} className="text-blue-400 flex-shrink-0 ml-4" />}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 p-6 flex items-center justify-end gap-3">
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
            {accepting ? 'Loading…' : 'Accept & Preview Matches'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiscogsIdentifyModal;
