import React, { useEffect, useState } from 'react';
import config from '../../../../../config';
import Button from '../../../../../shared/components/Button';
import JellyfinCollectionField, { NEW_COLLECTION } from './JellyfinCollectionField';

/** Link/unlink the viewed order's Jellyfin collection directly from the order page. */
const OrderCollectionLink = ({ order, onSaved }) => {
  const current = order.jellyfinCollectionId || '';
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { setValue(current); setMessage(''); }, [order.id, current]);

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const body = value === NEW_COLLECTION
        ? { createJellyfinCollection: true }
        : { jellyfinCollectionId: value || null };
      const response = await fetch(`${config.apiBaseUrl}/api/custom-orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setMessage(data.jellyfinCollectionId
        ? `Linked to "${data.jellyfinCollection?.name || 'collection'}". Movies and series are being added.`
        : 'Collection unlinked.');
      onSaved?.(data);
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="order-collection-link">
      <JellyfinCollectionField
        id={`orderCollection-${order.id}`}
        value={value}
        onChange={setValue}
        currentCollection={order.jellyfinCollection}
      />
      <Button onClick={save} className="primary" size="small" disabled={saving || value === current}>
        {saving ? 'Saving...' : 'Save Collection Link'}
      </Button>
      {message && <small className="form-help">{message}</small>}
    </div>
  );
};

export default OrderCollectionLink;
