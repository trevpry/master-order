import React, { useEffect, useState } from 'react';
import config from '../../../../../config';
import HelpText from './HelpText';

export const NEW_COLLECTION = '__new__';

/** Picker that links a custom order to a Jellyfin collection (or creates one). */
const JellyfinCollectionField = ({ id, value, onChange, currentCollection }) => {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`${config.apiBaseUrl}/api/jellyfin/collections/tree`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
      .then((data) => { if (!cancelled) setCollections(data.collections || []); })
      .catch((err) => { if (!cancelled) setError(`Could not load Jellyfin collections: ${err.message}`); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const options = [...collections];
  if (currentCollection?.jellyfinId && !options.some((c) => c.id === currentCollection.jellyfinId)) {
    options.unshift({ id: currentCollection.jellyfinId, name: currentCollection.name || 'Current collection' });
  }

  return (
    <div className="form-section">
      <h4>Jellyfin Collection (Optional)</h4>
      <HelpText>
        Movies and series in this order (including sub-orders) are added to the linked collection automatically,
        and its artwork is shown next to this order's items in the Android app.
      </HelpText>
      <div className="form-group">
        <label htmlFor={id}>Linked Collection</label>
        <select id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={loading}>
          <option value="">-- No linked collection --</option>
          <option value={NEW_COLLECTION}>+ Create new collection named after this order</option>
          {options.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.name}
              {collection.movieCount !== undefined ? ` (${collection.movieCount} movies, ${collection.showCount} shows)` : ''}
            </option>
          ))}
        </select>
        {loading && <small className="form-help">Loading collections...</small>}
        {error && <small className="form-help">{error}</small>}
      </div>
    </div>
  );
};

export default JellyfinCollectionField;
