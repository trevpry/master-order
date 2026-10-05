import React, { useEffect, useState } from 'react';
import { X, Building2, AlertCircle, ChevronRight } from 'lucide-react';
import config from '../../config';

/**
 * PublisherPickerModal
 *
 * Lists the publisher catalogues that can be searched for album metadata (e.g. Naxos).
 *
 * Props:
 * - isOpen, onClose
 * - onSelect: (publisher) => void, publisher = { key, label, description }
 */
const PublisherPickerModal = ({ isOpen, onClose, onSelect }) => {
  const [publishers, setPublishers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${config.apiBaseUrl}/api/music/publishers`)
      .then((response) => response.json())
      .then((result) => {
        if (cancelled) return;
        if (!result.success) {
          setError(result.error || 'Failed to load publishers');
          return;
        }
        setPublishers(result.data?.publishers || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load publishers');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-gray-900 rounded-lg max-w-lg w-full flex flex-col border border-gray-700"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 size={24} />
            Search by Publisher
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {loading && <p className="text-gray-400">Loading publishers…</p>}
          {!loading && error && (
            <p className="text-red-400 flex items-center gap-2"><AlertCircle size={16} />{error}</p>
          )}
          {!loading && !error && publishers.length === 0 && (
            <p className="text-gray-400">No publisher searches are available.</p>
          )}
          {!loading && publishers.map((publisher) => (
            <button
              key={publisher.key}
              type="button"
              onClick={() => onSelect(publisher)}
              className="w-full text-left border border-gray-700 hover:border-blue-500 bg-gray-800 rounded-lg p-4 flex items-center justify-between transition-colors"
            >
              <div>
                <div className="text-lg font-semibold text-white">{publisher.label}</div>
                {publisher.description && <div className="text-sm text-gray-400 mt-1">{publisher.description}</div>}
              </div>
              <ChevronRight size={20} className="text-gray-500" />
            </button>
          ))}
        </div>

        <div className="border-t border-gray-700 p-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-600 text-white rounded hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default PublisherPickerModal;
