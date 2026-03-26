import React, { useState } from 'react';
import Button from '../../../../../../shared/components/Button';
import config from '../../../../../../config';

const ListScrapeConfigModal = ({
  isOpen,
  onClose,
  orderId,
  existingConfig,
  onConfigSaved
}) => {
  const [url, setUrl] = useState(existingConfig?.url || '');
  const [itemSelector, setItemSelector] = useState(existingConfig?.itemSelector || '');
  const [titleSelector, setTitleSelector] = useState(existingConfig?.titleSelector || '');
  const [mediaTypeSelector, setMediaTypeSelector] = useState(existingConfig?.mediaTypeSelector || '');
  const [urlSelector, setUrlSelector] = useState(existingConfig?.urlSelector || '');
  const [imageSelector, setImageSelector] = useState(existingConfig?.imageSelector || '');
  const [yearSelector, setYearSelector] = useState(existingConfig?.yearSelector || '');
  const [defaultMediaType, setDefaultMediaType] = useState(existingConfig?.defaultMediaType || 'movie');
  const [useJavaScript, setUseJavaScript] = useState(existingConfig?.useJavaScript || false);
  const [isActive, setIsActive] = useState(existingConfig?.isActive !== undefined ? existingConfig.isActive : true);

  const [previewItems, setPreviewItems] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showImportOptions, setShowImportOptions] = useState(!existingConfig);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handlePreview = async () => {
    if (!url || !itemSelector || !titleSelector) {
      setPreviewError('URL, item selector, and title selector are required');
      return;
    }

    setPreviewLoading(true);
    setPreviewError('');
    setPreviewItems([]);

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/list-scraping/${orderId}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          itemSelector,
          titleSelector,
          mediaTypeSelector: mediaTypeSelector || null,
          urlSelector: urlSelector || null,
          imageSelector: imageSelector || null,
          yearSelector: yearSelector || null,
          defaultMediaType,
          useJavaScript
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setPreviewItems(data.data.items || []);
        if (data.data.items?.length === 0) {
          setPreviewError('No items found. Check your CSS selectors.');
        }
      } else {
        setPreviewError(data.error || 'Preview failed');
      }
    } catch (error) {
      setPreviewError(`Preview failed: ${error.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSave = async () => {
    if (!url || !itemSelector || !titleSelector) {
      setPreviewError('URL, item selector, and title selector are required');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/list-scraping/${orderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          itemSelector,
          titleSelector,
          mediaTypeSelector: mediaTypeSelector || null,
          urlSelector: urlSelector || null,
          imageSelector: imageSelector || null,
          yearSelector: yearSelector || null,
          defaultMediaType,
          useJavaScript,
          isActive
        })
      });

      const data = await response.json();
      if (response.ok) {
        if (onConfigSaved) onConfigSaved(data.data);
        if (!existingConfig) {
          setShowImportOptions(true);
        } else {
          onClose();
        }
      } else {
        setPreviewError(data.error || 'Failed to save configuration');
      }
    } catch (error) {
      setPreviewError(`Save failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async (importAll) => {
    setImporting(true);
    setImportResult(null);
    setPreviewError('');

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/list-scraping/${orderId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importAll })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setImportResult(data.data);
        setShowImportOptions(false);
      } else {
        setPreviewError(data.error || 'Import failed');
      }
    } catch (error) {
      setPreviewError(`Import failed: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleRemoveConfig = async () => {
    if (!window.confirm('Remove list scraping configuration? This will stop tracking this list.')) return;

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/list-scraping/${orderId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        if (onConfigSaved) onConfigSaved(null);
        onClose();
      }
    } catch (error) {
      setPreviewError(`Remove failed: ${error.message}`);
    }
  };

  const handleCheckNow = async () => {
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/list-scraping/${orderId}/check`, {
        method: 'POST'
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setImportResult(data.data);
      } else {
        setPreviewError(data.error || 'Check failed');
      }
    } catch (error) {
      setPreviewError(`Check failed: ${error.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleOverlayClick}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4">
          {existingConfig ? 'Edit List Scraping Configuration' : 'Link Online List'}
        </h2>

        {/* URL */}
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">List URL *</label>
          <input
            type="url"
            className="w-full border rounded px-3 py-2 text-sm"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://marvelcinematicuniverse.fandom.com/wiki/..."
          />
        </div>

        {/* CSS Selectors */}
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Item Row Selector * <span className="text-gray-400 font-normal">(CSS selector for each list item)</span></label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2 text-sm font-mono"
            value={itemSelector}
            onChange={(e) => setItemSelector(e.target.value)}
            placeholder="table.wikitable tbody tr"
          />
        </div>

        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Title Selector * <span className="text-gray-400 font-normal">(within each item row)</span></label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2 text-sm font-mono"
            value={titleSelector}
            onChange={(e) => setTitleSelector(e.target.value)}
            placeholder="td:nth-child(2) a"
          />
        </div>

        {/* Optional Selectors - Collapsible */}
        <details className="mb-3">
          <summary className="cursor-pointer text-sm font-medium text-blue-600">Optional Selectors</summary>
          <div className="mt-2 space-y-2 pl-2 border-l-2 border-blue-100">
            <div>
              <label className="block text-xs font-medium mb-1">Media Type Selector</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2 text-sm font-mono"
                value={mediaTypeSelector}
                onChange={(e) => setMediaTypeSelector(e.target.value)}
                placeholder="td:nth-child(3)"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">URL Selector <span className="text-gray-400 font-normal">(element with href attribute)</span></label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2 text-sm font-mono"
                value={urlSelector}
                onChange={(e) => setUrlSelector(e.target.value)}
                placeholder="td:nth-child(2) a"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Year Selector</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2 text-sm font-mono"
                value={yearSelector}
                onChange={(e) => setYearSelector(e.target.value)}
                placeholder="td:nth-child(4)"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Image Selector <span className="text-gray-400 font-normal">(element with src attribute)</span></label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2 text-sm font-mono"
                value={imageSelector}
                onChange={(e) => setImageSelector(e.target.value)}
                placeholder="td:nth-child(1) img"
              />
            </div>
          </div>
        </details>

        {/* Default Media Type & Options */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Default Media Type</label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={defaultMediaType}
              onChange={(e) => setDefaultMediaType(e.target.value)}
            >
              <option value="movie">Movie</option>
              <option value="episode">TV Episode</option>
              <option value="comic">Comic</option>
              <option value="book">Book</option>
              <option value="webvideo">Web Video</option>
              <option value="game">Game</option>
            </select>
          </div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useJavaScript}
                onChange={(e) => setUseJavaScript(e.target.checked)}
              />
              JS Rendering
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active
            </label>
          </div>
        </div>

        {/* Preview Button */}
        <div className="flex gap-2 mb-4">
          <Button onClick={handlePreview} disabled={previewLoading} className="primary">
            {previewLoading ? 'Scraping...' : 'Preview'}
          </Button>
          <Button onClick={handleSave} disabled={saving} className="primary">
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
          {existingConfig && (
            <>
              <Button onClick={handleCheckNow} disabled={previewLoading} className="secondary">
                Check Now
              </Button>
              <Button onClick={handleRemoveConfig} className="danger">
                Remove
              </Button>
            </>
          )}
        </div>

        {/* Error Display */}
        {previewError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-3">
            {previewError}
          </div>
        )}

        {/* Import Result */}
        {importResult && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm mb-3">
            {importResult.added !== undefined && <div>Added: {importResult.added} items</div>}
            {importResult.skipped !== undefined && <div>Skipped: {importResult.skipped} items</div>}
            {importResult.newItemsFound !== undefined && <div>New items found: {importResult.newItemsFound}</div>}
            {importResult.errors?.length > 0 && (
              <div className="mt-1 text-red-600">
                Errors: {importResult.errors.map(e => e.title).join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Import Options (initial setup only) */}
        {showImportOptions && !existingConfig && (
          <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
            <h3 className="font-medium mb-2">Initial Import</h3>
            <p className="text-sm text-gray-600 mb-3">
              How would you like to handle the items currently on this list?
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => handleImport(true)}
                disabled={importing}
                className="primary"
              >
                {importing ? 'Importing...' : 'Import All Existing Items'}
              </Button>
              <Button
                onClick={() => handleImport(false)}
                disabled={importing}
                className="secondary"
              >
                {importing ? 'Processing...' : 'Ignore Existing (Track New Only)'}
              </Button>
            </div>
          </div>
        )}

        {/* Preview Results */}
        {previewItems.length > 0 && (
          <div className="border rounded">
            <div className="bg-gray-50 px-3 py-2 border-b text-sm font-medium">
              Preview: {previewItems.length} items found
            </div>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-1">#</th>
                    <th className="text-left px-3 py-1">Title</th>
                    <th className="text-left px-3 py-1">Type</th>
                    <th className="text-left px-3 py-1">Year</th>
                  </tr>
                </thead>
                <tbody>
                  {previewItems.map((item, i) => (
                    <tr key={i} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-1 text-gray-400">{item.position + 1}</td>
                      <td className="px-3 py-1">
                        {item.itemUrl ? (
                          <a href={item.itemUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {item.title}
                          </a>
                        ) : item.title}
                      </td>
                      <td className="px-3 py-1 text-gray-500">{item.mediaType}</td>
                      <td className="px-3 py-1 text-gray-500">{item.itemYear || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CSS Selector Help */}
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-gray-500">CSS Selector Help</summary>
          <div className="mt-2 text-xs text-gray-500 space-y-1 bg-gray-50 p-3 rounded">
            <p><strong>Item Row:</strong> Selects each item in the list. Use browser DevTools to inspect the list structure.</p>
            <p><strong>Title:</strong> Selects the title text within each row. Often an <code>&lt;a&gt;</code> tag or specific <code>&lt;td&gt;</code>.</p>
            <p><strong>Examples for wiki tables:</strong></p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Item: <code>table.wikitable tbody tr</code></li>
              <li>Title: <code>td:nth-child(2) a</code> or <code>td i a</code></li>
              <li>Year: <code>td:nth-child(3)</code></li>
              <li>Type: <code>td:nth-child(4)</code></li>
            </ul>
            <p><strong>Examples for ordered lists:</strong></p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Item: <code>ol li</code> or <code>ul.list-items li</code></li>
              <li>Title: <code>a</code> or <code>.title</code></li>
            </ul>
          </div>
        </details>

        {/* Close Button */}
        <div className="flex justify-end mt-4">
          <Button onClick={onClose} className="secondary">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ListScrapeConfigModal;
