import React, { useState, useEffect } from 'react';
import BatchIdentifyPanel from '../../../../components/BatchIdentifyPanel';
import { Database, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import config from '../../../../config';

/**
 * MusicSettings Component
 * 
 * Admin panel for music library metadata management
 * Features:
 * - Batch identification operations
 * - Library statistics
 * - Metadata cache management
 */
const MusicSettings = ({ onBack }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Fetch identification statistics
      const [albumsRes, artistsRes] = await Promise.all([
        fetch(`${config.apiBaseUrl}/api/music/albums`),
        fetch(`${config.apiBaseUrl}/api/music/artists`)
      ]);

      const albumsData = await albumsRes.json();
      const artistsData = await artistsRes.json();

      if (albumsData.success && artistsData.success) {
        const albums = albumsData.data || [];
        const artists = artistsData.data || [];

        setStats({
          albums: {
            total: albums.length,
            identified: albums.filter(a => a.identificationStatus === 'identified').length,
            pending: albums.filter(a => a.identificationStatus === 'pending_review').length,
            unidentified: albums.filter(a => a.identificationStatus === 'unidentified' || !a.identificationStatus).length,
            manual: albums.filter(a => a.identificationStatus === 'manual').length
          },
          artists: {
            total: artists.length,
            identified: artists.filter(a => a.identificationStatus === 'identified').length,
            pending: artists.filter(a => a.identificationStatus === 'pending_review').length,
            unidentified: artists.filter(a => a.identificationStatus === 'unidentified' || !a.identificationStatus).length,
            manual: artists.filter(a => a.identificationStatus === 'manual').length
          }
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchComplete = () => {
    // Reload stats after batch operation
    loadStats();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'identified': return 'text-green-400';
      case 'pending': return 'text-yellow-400';
      case 'unidentified': return 'text-gray-400';
      case 'manual': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="music-settings p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Database size={32} />
            Music Library Settings
          </h1>
          {onBack && (
            <button
              onClick={onBack}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
            >
              ← Back
            </button>
          )}
        </div>
        <p className="text-gray-400">
          Manage metadata identification and bulk operations for your music library
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">Library Overview</h2>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw size={32} className="animate-spin text-blue-400" />
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Albums Stats */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Database size={20} />
                Albums ({stats.albums.total})
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Identified:</span>
                  <span className={`font-semibold ${getStatusColor('identified')}`}>
                    {stats.albums.identified} ({Math.round(stats.albums.identified / stats.albums.total * 100)}%)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Pending Review:</span>
                  <span className={`font-semibold ${getStatusColor('pending')}`}>
                    {stats.albums.pending}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Unidentified:</span>
                  <span className={`font-semibold ${getStatusColor('unidentified')}`}>
                    {stats.albums.unidentified}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Manual:</span>
                  <span className={`font-semibold ${getStatusColor('manual')}`}>
                    {stats.albums.manual}
                  </span>
                </div>
              </div>
            </div>

            {/* Artists Stats */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Database size={20} />
                Artists ({stats.artists.total})
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Identified:</span>
                  <span className={`font-semibold ${getStatusColor('identified')}`}>
                    {stats.artists.identified} ({Math.round(stats.artists.identified / stats.artists.total * 100)}%)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Pending Review:</span>
                  <span className={`font-semibold ${getStatusColor('pending')}`}>
                    {stats.artists.pending}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Unidentified:</span>
                  <span className={`font-semibold ${getStatusColor('unidentified')}`}>
                    {stats.artists.unidentified}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Manual:</span>
                  <span className={`font-semibold ${getStatusColor('manual')}`}>
                    {stats.artists.manual}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded p-4">
            <p className="text-red-300">Failed to load statistics</p>
          </div>
        )}
      </div>

      {/* Batch Operations */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-white mb-4">Batch Operations</h2>
        <BatchIdentifyPanel onComplete={handleBatchComplete} />
      </div>

      {/* Help Section */}
      <div className="bg-blue-900 bg-opacity-20 border border-blue-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-200 mb-3">About Metadata Identification</h3>
        <div className="space-y-2 text-blue-300 text-sm">
          <p>
            <strong>Identified:</strong> Successfully matched with MusicBrainz and metadata applied.
          </p>
          <p>
            <strong>Pending Review:</strong> Potential matches found but awaiting manual review.
          </p>
          <p>
            <strong>Unidentified:</strong> No identification attempted yet.
          </p>
          <p>
            <strong>Manual:</strong> User has chosen not to use MusicBrainz for this item.
          </p>
          <p className="mt-4">
            <strong>Tip:</strong> Use batch operations to automatically accept high-confidence matches (≥95%) 
            to quickly identify most of your library. Lower confidence matches should be reviewed manually.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MusicSettings;
