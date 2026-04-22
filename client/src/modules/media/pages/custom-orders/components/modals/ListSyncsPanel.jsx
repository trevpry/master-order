import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Button from '../../../../../../shared/components/Button';
import config from '../../../../../../config';

const ListSyncsPanel = ({ isOpen, onClose, onRefreshOrders }) => {
  const [configs, setConfigs] = useState([]);
  const [parsers, setParsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [previewItems, setPreviewItems] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [notInPlexItems, setNotInPlexItems] = useState([]);

  // Debug: log whenever notInPlexItems changes
  useEffect(() => {
    if (notInPlexItems.length > 0) {
      console.error('[ListSync] NOT IN PLEX items received:', notInPlexItems);
    }
  }, [notInPlexItems]);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    parserType: 'css-selectors',
    parserConfig: '',
    articleHtml: '',
    itemSelector: '',
    titleSelector: '',
    mediaTypeSelector: '',
    urlSelector: '',
    yearSelector: '',
    defaultMediaType: 'movie',
    useJavaScript: false,
    isActive: true,
    headImportCount: '',
    tailImportCount: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchConfigs();
      fetchParsers();
    }
  }, [isOpen]);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/list-scraping/configs`);
      const data = await res.json();
      if (data.success) setConfigs(data.data);
    } catch (e) {
      setError('Failed to load list syncs');
    } finally {
      setLoading(false);
    }
  };

  const fetchParsers = async () => {
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/list-scraping/parsers`);
      const data = await res.json();
      if (data.success) setParsers(data.data);
    } catch (e) { /* non-critical */ }
  };

  const resetForm = () => {
    setFormData({
      name: '', url: '', parserType: 'css-selectors', parserConfig: '',
      articleHtml: '',
      itemSelector: '', titleSelector: '', mediaTypeSelector: '',
      urlSelector: '', yearSelector: '', defaultMediaType: 'movie',
      useJavaScript: false, isActive: true, headImportCount: '', tailImportCount: ''
    });
    setEditingConfig(null);
    setPreviewItems([]);
    setError('');
  };

  const openCreate = () => {
    resetForm();
    setShowCreateForm(true);
  };

  const openEdit = (cfg) => {
    let articleHtml = '';
    if ((cfg.parserType || '') === 'avp-timeline') {
      if (cfg.parserConfig) {
        try {
          const parsed = JSON.parse(cfg.parserConfig);
          articleHtml = parsed?.articleHtml || parsed?.sourceHtml || parsed?.article || '';
        } catch (_error) {
          articleHtml = cfg.parserConfig;
        }
      }
    }

    setFormData({
      name: cfg.name || '',
      url: cfg.url || '',
      parserType: cfg.parserType || 'css-selectors',
      parserConfig: cfg.parserConfig || '',
      articleHtml,
      itemSelector: cfg.itemSelector || '',
      titleSelector: cfg.titleSelector || '',
      mediaTypeSelector: cfg.mediaTypeSelector || '',
      urlSelector: cfg.urlSelector || '',
      yearSelector: cfg.yearSelector || '',
      defaultMediaType: cfg.defaultMediaType || 'movie',
      useJavaScript: cfg.useJavaScript || false,
      isActive: cfg.isActive !== false,
      headImportCount: cfg.headImportCount != null ? String(cfg.headImportCount) : '',
      tailImportCount: cfg.tailImportCount != null ? String(cfg.tailImportCount) : ''
    });
    setEditingConfig(cfg);
    setShowCreateForm(true);
    setPreviewItems([]);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.url) {
      setError('Name and URL are required');
      return;
    }

    if (formData.parserType === 'css-selectors' && (!formData.itemSelector || !formData.titleSelector)) {
      setError('Item Selector and Title Selector are required for CSS selector parser');
      return;
    }

    if (formData.parserType === 'avp-timeline' && !formData.articleHtml.trim()) {
      setError('Source Article HTML is required for the Alien vs Predator parser');
      return;
    }

    setError('');
    try {
      const method = editingConfig ? 'PUT' : 'POST';
      const url = editingConfig
        ? `${config.apiBaseUrl}/api/list-scraping/configs/${editingConfig.id}`
        : `${config.apiBaseUrl}/api/list-scraping/configs`;

      const payload = {
        ...formData,
        parserConfig: formData.parserType === 'avp-timeline'
          ? JSON.stringify({ articleHtml: formData.articleHtml })
          : formData.parserConfig
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(editingConfig ? 'Config updated' : 'Config created');
        setShowCreateForm(false);
        resetForm();
        fetchConfigs();
      } else {
        setError(data.error || 'Save failed');
      }
    } catch (e) {
      setError(`Save failed: ${e.message}`);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this list sync config and all tracked items?')) return;
    try {
      await fetch(`${config.apiBaseUrl}/api/list-scraping/configs/${id}`, { method: 'DELETE' });
      fetchConfigs();
      if (onRefreshOrders) onRefreshOrders();
    } catch (e) {
      setError(`Delete failed: ${e.message}`);
    }
  };

  const handlePreview = async (id) => {
    setPreviewLoading(true);
    setPreviewItems([]);
    setError('');
    try {
      const targetId = id || editingConfig?.id;
      // Pass form data for unsaved configs, or just trigger saved config preview
      const body = targetId ? {} : formData;
      const url = targetId
        ? `${config.apiBaseUrl}/api/list-scraping/configs/${targetId}/preview`
        : null;

      if (!url) {
        setError('Save the config first to preview');
        setPreviewLoading(false);
        return;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        setPreviewItems(data.data.items || []);
        if (!data.data.items?.length) setError('No items found');
      } else {
        setError(data.error || 'Preview failed');
      }
    } catch (e) {
      setError(`Preview failed: ${e.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCheck = async (id) => {
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/list-scraping/configs/${id}/check`, { method: 'POST' });
      const data = await res.json();
      console.log('[ListSync] handleCheck response:', { success: data.success, notInPlex: data?.data?.notInPlex, added: data?.data?.added });
      if (data.success) {
        const missing = data.data.notInPlex || [];
        if (missing.length > 0) {
          setNotInPlexItems(missing);
          setError(`Import stopped — not found in Plex: "${missing.map(i => i.title).join('", "')}"`);
          return; // Stop here — don't refresh, nothing was imported
        }
        setMessage(`Check complete: ${data.data.added || 0} new items added, ${data.data.newItemsFound || 0} new found`);
        fetchConfigs();
        if (onRefreshOrders) onRefreshOrders();
      } else {
        setError(data.error || 'Check failed');
      }
    } catch (e) {
      setError(`Check failed: ${e.message}`);
    }
  };

  const handleImport = async (id, importAll) => {
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/list-scraping/configs/${id}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importAll })
      });
      const data = await res.json();
      console.log('[ListSync] handleImport response:', { success: data.success, notInPlex: data?.data?.notInPlex, added: data?.data?.added });
      if (data.success) {
        const missing = data.data.notInPlex || [];
        if (missing.length > 0) {
          setNotInPlexItems(missing);
          setError(`Import stopped — not found in Plex: "${missing.map(i => i.title).join('", "')}"`);
          return; // Stop here — don't refresh, nothing was imported
        }
        setMessage(`Import: ${data.data.added || 0} added, ${data.data.skipped || 0} skipped`);
        fetchConfigs();
        if (onRefreshOrders) onRefreshOrders();
      } else {
        setError(data.error || 'Import failed');
      }
    } catch (e) {
      setError(`Import failed: ${e.message}`);
    }
  };

  const handleUnlink = async (id) => {
    try {
      await fetch(`${config.apiBaseUrl}/api/list-scraping/configs/${id}/unlink`, { method: 'POST' });
      fetchConfigs();
      if (onRefreshOrders) onRefreshOrders();
    } catch (e) {
      setError(`Unlink failed: ${e.message}`);
    }
  };

  const selectedParser = parsers.find(p => p.type === formData.parserType);
  const isCssParser = formData.parserType === 'css-selectors';
  const isAvpParser = formData.parserType === 'avp-timeline';

  return (
    <>
    {isOpen && (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6"
           onClick={(e) => e.stopPropagation()}>

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">🔗 List Syncs</h2>
          <div className="flex gap-2">
            {!showCreateForm && (
              <Button onClick={openCreate} className="primary" size="small">+ New List Sync</Button>
            )}
            <Button onClick={onClose} className="secondary" size="small">Close</Button>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-3">{error}</div>}
        {message && <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm mb-3">{message}</div>}

        {/* Create/Edit Form */}
        {showCreateForm && (
          <div className="border rounded-lg p-4 mb-4 bg-gray-50">
            <h3 className="font-medium mb-3">{editingConfig ? 'Edit List Sync' : 'New List Sync'}</h3>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input type="text" className="w-full border rounded px-3 py-2 text-sm"
                       value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                       placeholder="DCU Timeline" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Parser Type</label>
                <select className="w-full border rounded px-3 py-2 text-sm"
                        value={formData.parserType}
                        onChange={(e) => setFormData({...formData, parserType: e.target.value})}>
                  {parsers.map(p => (
                    <option key={p.type} value={p.type}>{p.name}</option>
                  ))}
                </select>
                {selectedParser && <p className="text-xs text-gray-500 mt-1">{selectedParser.description}</p>}
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">URL *</label>
              <input type="url" className="w-full border rounded px-3 py-2 text-sm"
                     value={formData.url} onChange={(e) => setFormData({...formData, url: e.target.value})}
                     placeholder="https://..." />
            </div>

            {/* CSS Selector fields (only for css-selectors parser) */}
            {isCssParser && (
              <>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Item Selector *</label>
                    <input type="text" className="w-full border rounded px-3 py-2 text-sm font-mono"
                           value={formData.itemSelector}
                           onChange={(e) => setFormData({...formData, itemSelector: e.target.value})}
                           placeholder="table.wikitable tbody tr" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Title Selector *</label>
                    <input type="text" className="w-full border rounded px-3 py-2 text-sm font-mono"
                           value={formData.titleSelector}
                           onChange={(e) => setFormData({...formData, titleSelector: e.target.value})}
                           placeholder="td:nth-child(2) a" />
                  </div>
                </div>

                <details className="mb-3">
                  <summary className="cursor-pointer text-sm text-blue-600">Optional Selectors</summary>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input type="text" className="border rounded px-3 py-2 text-sm font-mono"
                           value={formData.mediaTypeSelector}
                           onChange={(e) => setFormData({...formData, mediaTypeSelector: e.target.value})}
                           placeholder="Media Type Selector" />
                    <input type="text" className="border rounded px-3 py-2 text-sm font-mono"
                           value={formData.urlSelector}
                           onChange={(e) => setFormData({...formData, urlSelector: e.target.value})}
                           placeholder="URL Selector" />
                    <input type="text" className="border rounded px-3 py-2 text-sm font-mono"
                           value={formData.yearSelector}
                           onChange={(e) => setFormData({...formData, yearSelector: e.target.value})}
                           placeholder="Year Selector" />
                  </div>
                </details>
              </>
            )}

            {/* Parser config (for custom parsers) */}
            {isAvpParser && (
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Source Article HTML *</label>
                <textarea className="w-full border rounded px-3 py-2 text-sm font-mono"
                          rows={12}
                          value={formData.articleHtml}
                          onChange={(e) => setFormData({...formData, articleHtml: e.target.value})}
                          placeholder={'Paste the full <article class="message-body js-selectToQuote">...</article> HTML here'} />
                <p className="text-xs text-gray-500 mt-1">
                  Stored in DB and used as the parser source for updates.
                </p>
              </div>
            )}

            {!isCssParser && !isAvpParser && selectedParser?.configFields?.length > 0 && (
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Parser Config (JSON)</label>
                <textarea className="w-full border rounded px-3 py-2 text-sm font-mono"
                          rows={3}
                          value={formData.parserConfig}
                          onChange={(e) => setFormData({...formData, parserConfig: e.target.value})}
                          placeholder={JSON.stringify(
                            Object.fromEntries(selectedParser.configFields.map(f => [f.name, f.default || ''])),
                            null, 2
                          )} />
              </div>
            )}

            <div className="flex gap-4 mb-3">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Default Media Type</label>
                <select className="w-full border rounded px-3 py-2 text-sm"
                        value={formData.defaultMediaType}
                        onChange={(e) => setFormData({...formData, defaultMediaType: e.target.value})}>
                  <option value="movie">Movie</option>
                  <option value="episode">TV Episode</option>
                  <option value="comic">Comic</option>
                  <option value="book">Book</option>
                  <option value="webvideo">Web Video</option>
                  <option value="game">Game</option>
                </select>
              </div>
              <div style={{minWidth: '130px'}}>
                <label className="block text-sm font-medium mb-1">Import First N Items</label>
                <input type="number" className="w-full border rounded px-3 py-2 text-sm"
                       min="1"
                       value={formData.headImportCount}
                       onChange={(e) => setFormData({...formData, headImportCount: e.target.value, tailImportCount: e.target.value ? '' : formData.tailImportCount})}
                       placeholder="All" />
              </div>
              <div style={{minWidth: '130px'}}>
                <label className="block text-sm font-medium mb-1">Import Last N Items</label>
                <input type="number" className="w-full border rounded px-3 py-2 text-sm"
                       min="1"
                       value={formData.tailImportCount}
                       onChange={(e) => setFormData({...formData, tailImportCount: e.target.value, headImportCount: e.target.value ? '' : formData.headImportCount})}
                       placeholder="All" />
              </div>
              <label className="flex items-end gap-2 text-sm">
                <input type="checkbox" checked={formData.useJavaScript}
                       onChange={(e) => setFormData({...formData, useJavaScript: e.target.checked})} />
                JS Rendering
              </label>
              <label className="flex items-end gap-2 text-sm">
                <input type="checkbox" checked={formData.isActive}
                       onChange={(e) => setFormData({...formData, isActive: e.target.checked})} />
                Active
              </label>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} className="primary" size="small">
                {editingConfig ? 'Update' : 'Create'}
              </Button>
              {editingConfig && (
                <Button onClick={() => handlePreview(editingConfig.id)} disabled={previewLoading} className="secondary" size="small">
                  {previewLoading ? 'Loading...' : 'Preview'}
                </Button>
              )}
              <Button onClick={() => { setShowCreateForm(false); resetForm(); }} className="secondary" size="small">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Preview Results */}
        {previewItems.length > 0 && (
          <div className="border rounded mb-4">
            <div className="bg-gray-50 px-3 py-2 border-b text-sm font-medium">
              Preview: {previewItems.length} items
            </div>
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-1">#</th>
                    <th className="text-left px-3 py-1">Title</th>
                    <th className="text-left px-3 py-1">Series</th>
                    <th className="text-left px-3 py-1">S</th>
                    <th className="text-left px-3 py-1">Ep</th>
                    <th className="text-left px-3 py-1">Year</th>
                    <th className="text-left px-3 py-1">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {previewItems.map((item, i) => (
                    <tr key={i} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-1 text-gray-400">{item.position + 1}</td>
                      <td className="px-3 py-1">{item.title}</td>
                      <td className="px-3 py-1 text-gray-500">{item.seriesTitle || ''}</td>
                      <td className="px-3 py-1 text-gray-500">{item.seasonNumber != null ? item.seasonNumber : ''}</td>
                      <td className="px-3 py-1 text-gray-500">{item.episodeNumber != null ? item.episodeNumber : ''}</td>
                      <td className="px-3 py-1 text-gray-500">{item.itemYear || ''}</td>
                      <td className="px-3 py-1 text-gray-500">{item.mediaType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Config List */}
        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : configs.length === 0 ? (
          <p className="text-sm text-gray-500">No list syncs configured yet. Create one to get started.</p>
        ) : (
          <div className="space-y-3">
            {configs.map(cfg => (
              <div key={cfg.id} className="border rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{cfg.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${cfg.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {cfg.isActive ? 'Active' : 'Paused'}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                        {cfg.parserType}
                      </span>
                    </div>
                    <a href={cfg.url} target="_blank" rel="noopener noreferrer"
                       className="text-xs text-blue-500 hover:underline break-all">{cfg.url}</a>
                    <div className="text-xs text-gray-500 mt-1">
                      {cfg._count?.scrapedItems || 0} tracked items
                      {cfg.lastCheckedAt && <> · Last checked: {new Date(cfg.lastCheckedAt).toLocaleString()}</>}
                      {cfg.customOrder && <> · Linked to: <strong>{cfg.customOrder.name}</strong></>}
                      {!cfg.customOrder && <> · <span className="text-amber-600">Not linked to an order</span></>}
                    </div>
                    {cfg.lastError && <div className="text-xs text-red-500 mt-1">Error: {cfg.lastError}</div>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button onClick={() => openEdit(cfg)} className="secondary" size="small">Edit</Button>
                    <Button onClick={() => handlePreview(cfg.id)} disabled={previewLoading} className="secondary" size="small">Preview</Button>
                    <Button onClick={() => handleCheck(cfg.id)} className="secondary" size="small">Check</Button>
                    {cfg.customOrder && !cfg.importedAll && (
                      <Button onClick={() => handleImport(cfg.id, true)} className="primary" size="small">Import All</Button>
                    )}
                    {cfg.customOrder && !cfg.importedAll && (
                      <Button onClick={() => handleImport(cfg.id, false)} className="secondary" size="small">Skip Existing</Button>
                    )}
                    {cfg.customOrder && (
                      <Button onClick={() => handleUnlink(cfg.id)} className="secondary" size="small">Unlink</Button>
                    )}
                    <Button onClick={() => handleDelete(cfg.id)} className="danger" size="small">Delete</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    )}

    {/* Top-of-screen toast — renders into body, totally independent of isOpen */}
    {notInPlexItems.length > 0 && createPortal(
      <div style={{position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999999, background: '#dc2626', color: 'white', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.4)'}}>
        <span style={{fontSize: '18px'}}>⛔</span>
        <span style={{flex: 1, fontWeight: 600}}>
          Import stopped — not found in Plex: {notInPlexItems.map(i => `"${i.title}"`).join(', ')}
        </span>
      </div>,
      document.body
    )}

    {/* Blocking modal — only manually closeable */}
    {notInPlexItems.length > 0 && createPortal(
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center" style={{zIndex: 99999}}>
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">⚠️</span>
            <h2 className="text-lg font-bold text-red-700">Import Stopped — Not Found in Plex</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            The import stopped because the following {notInPlexItems.length === 1 ? 'item does' : `${notInPlexItems.length} items do`} not
            exist in your Plex library. Add {notInPlexItems.length === 1 ? 'it' : 'them'} to Plex first, then run the import again.
          </p>
          <div className="border rounded max-h-64 overflow-y-auto mb-5">
            {notInPlexItems.map((item, i) => (
              <div key={i} className={`flex items-center gap-2 px-3 py-2 text-sm ${i > 0 ? 'border-t' : ''}`}>
                <span className="text-gray-400 text-xs w-5 text-right shrink-0">{i + 1}.</span>
                <span className="font-medium flex-1">{item.title}</span>
                <span className="text-xs text-gray-400 capitalize">{item.mediaType}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setNotInPlexItems([])} className="primary">Close</Button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
};

export default ListSyncsPanel;
