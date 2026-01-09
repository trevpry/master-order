import React, { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Settings } from 'lucide-react';

/**
 * BatchIdentifyPanel Component
 * 
 * Provides batch identification operations for albums and artists
 * Features:
 * - Auto-accept high-confidence matches
 * - Configurable confidence threshold
 * - Progress tracking
 * - Results summary
 */
const BatchIdentifyPanel = ({ onComplete }) => {
  const [entityType, setEntityType] = useState('album');
  const [minConfidence, setMinConfidence] = useState(95);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleBatchAutoAccept = async () => {
    setProcessing(true);
    setResults(null);
    setError(null);

    try {
      const response = await fetch('/api/identification/batch/auto-accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType,
          minConfidence: minConfidence / 100
        })
      });

      const data = await response.json();

      if (data.success) {
        setResults(data.data);
        if (onComplete) {
          onComplete(data.data);
        }
      } else {
        setError(data.error || 'Batch operation failed');
      }
    } catch (err) {
      console.error('Batch operation error:', err);
      setError('Failed to connect to server');
    } finally {
      setProcessing(false);
    }
  };

  const resetResults = () => {
    setResults(null);
    setError(null);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings size={24} />
          Batch Auto-Identify
        </h2>
      </div>

      {!results && !error && (
        <div className="space-y-6">
          {/* Entity Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Entity Type
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="entityType"
                  value="album"
                  checked={entityType === 'album'}
                  onChange={(e) => setEntityType(e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-white">Albums</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="entityType"
                  value="artist"
                  checked={entityType === 'artist'}
                  onChange={(e) => setEntityType(e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-white">Artists</span>
              </label>
            </div>
          </div>

          {/* Confidence Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Minimum Confidence: {minConfidence}%
            </label>
            <input
              type="range"
              min="50"
              max="100"
              step="5"
              value={minConfidence}
              onChange={(e) => setMinConfidence(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>50% (Low)</span>
              <span>75% (Medium)</span>
              <span>100% (Perfect)</span>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded p-4">
            <p className="text-blue-200 text-sm">
              <AlertCircle size={16} className="inline mr-2" />
              This will automatically accept all pending {entityType} matches with confidence 
              ≥ {minConfidence}%. Matches below this threshold will remain pending for manual review.
            </p>
          </div>

          {/* Action Button */}
          <button
            onClick={handleBatchAutoAccept}
            disabled={processing}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <RefreshCw size={20} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle size={20} />
                Auto-Accept High-Confidence Matches
              </>
            )}
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="space-y-4">
          <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded p-4">
            <div className="flex items-start gap-3">
              <XCircle size={24} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-red-200 font-semibold mb-1">Operation Failed</h3>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={resetResults}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleBatchAutoAccept}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Success Card */}
            <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded p-4">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle size={24} className="text-green-400" />
                <h3 className="text-green-200 font-semibold">Accepted</h3>
              </div>
              <p className="text-3xl font-bold text-green-300">{results.accepted}</p>
              <p className="text-green-400 text-sm mt-1">Successfully identified</p>
            </div>

            {/* Failed Card */}
            <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded p-4">
              <div className="flex items-center gap-3 mb-2">
                <XCircle size={24} className="text-red-400" />
                <h3 className="text-red-200 font-semibold">Failed</h3>
              </div>
              <p className="text-3xl font-bold text-red-300">{results.failed}</p>
              <p className="text-red-400 text-sm mt-1">Errors occurred</p>
            </div>

            {/* Total Card */}
            <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded p-4">
              <div className="flex items-center gap-3 mb-2">
                <Settings size={24} className="text-blue-400" />
                <h3 className="text-blue-200 font-semibold">Total</h3>
              </div>
              <p className="text-3xl font-bold text-blue-300">{results.total}</p>
              <p className="text-blue-400 text-sm mt-1">Candidates processed</p>
            </div>
          </div>

          {/* Error Details */}
          {results.errors && results.errors.length > 0 && (
            <div className="bg-gray-700 rounded p-4">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <AlertCircle size={18} />
                Error Details ({results.errors.length})
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {results.errors.map((err, index) => (
                  <div key={index} className="bg-gray-800 rounded p-3 text-sm">
                    <p className="text-red-400 font-mono">
                      Candidate #{err.candidateId} ({err.entityKey})
                    </p>
                    <p className="text-gray-400 mt-1">{err.error}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Success Summary */}
          {results.accepted > 0 && (
            <div className="bg-green-900 bg-opacity-20 border border-green-800 rounded p-4">
              <p className="text-green-300 text-sm">
                ✓ Successfully identified {results.accepted} {entityType}
                {results.accepted !== 1 ? 's' : ''} with confidence ≥ {minConfidence}%
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={resetResults}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchIdentifyPanel;
