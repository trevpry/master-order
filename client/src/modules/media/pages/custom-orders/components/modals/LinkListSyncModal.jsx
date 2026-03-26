import React, { useState, useEffect } from 'react';
import Button from '../../../../../../shared/components/Button';
import config from '../../../../../../config';

const LinkListSyncModal = ({ isOpen, onClose, orderId, orderName, onLinked }) => {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [linking, setLinking] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchUnlinkedConfigs();
    }
  }, [isOpen]);

  const fetchUnlinkedConfigs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/list-scraping/configs`);
      const data = await res.json();
      if (data.success) {
        // Show unlinked configs + the one already linked to this order
        setConfigs(data.data.filter(c => !c.customOrderId || c.customOrderId === orderId));
      }
    } catch (e) {
      setError('Failed to load list syncs');
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async (configId) => {
    setLinking(configId);
    setError('');
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/list-scraping/configs/${configId}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customOrderId: orderId })
      });
      const data = await res.json();
      if (res.ok) {
        if (onLinked) onLinked();
        onClose();
      } else {
        setError(data.error || 'Failed to link');
      }
    } catch (e) {
      setError(`Link failed: ${e.message}`);
    } finally {
      setLinking(null);
    }
  };

  const handleUnlink = async (configId) => {
    setLinking(configId);
    setError('');
    try {
      await fetch(`${config.apiBaseUrl}/api/list-scraping/configs/${configId}/unlink`, { method: 'POST' });
      if (onLinked) onLinked();
      fetchUnlinkedConfigs();
    } catch (e) {
      setError(`Unlink failed: ${e.message}`);
    } finally {
      setLinking(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[70vh] overflow-y-auto p-6"
           onClick={(e) => e.stopPropagation()}>

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Link List Sync to "{orderName}"</h2>
          <Button onClick={onClose} className="secondary" size="small">Close</Button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-3">{error}</div>}

        {loading ? (
          <p className="text-sm text-gray-500">Loading available syncs...</p>
        ) : configs.length === 0 ? (
          <p className="text-sm text-gray-500">No available list syncs. Create one in the List Syncs panel first.</p>
        ) : (
          <div className="space-y-2">
            {configs.map(cfg => {
              const isLinkedHere = cfg.customOrderId === orderId;
              return (
                <div key={cfg.id} className={`border rounded p-3 flex justify-between items-center ${isLinkedHere ? 'bg-green-50 border-green-200' : ''}`}>
                  <div>
                    <div className="font-medium text-sm">{cfg.name}</div>
                    <div className="text-xs text-gray-500">
                      {cfg.parserType} · {cfg._count?.scrapedItems || 0} items
                    </div>
                  </div>
                  {isLinkedHere ? (
                    <Button onClick={() => handleUnlink(cfg.id)} disabled={linking === cfg.id}
                            className="secondary" size="small">
                      {linking === cfg.id ? '...' : 'Unlink'}
                    </Button>
                  ) : (
                    <Button onClick={() => handleLink(cfg.id)} disabled={linking === cfg.id}
                            className="primary" size="small">
                      {linking === cfg.id ? '...' : 'Link'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LinkListSyncModal;
