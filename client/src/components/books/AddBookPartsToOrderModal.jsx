import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import config from '../../config';

const readResponse = async response => {
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || result.message || 'The request failed');
  }
  return result.data;
};

const AddBookPartsToOrderModal = ({ book, initialPart, onClose }) => {
  const [searchParams] = useSearchParams();
  const defaultOrderId = searchParams.get('customOrderId');
  const [orders, setOrders] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const initialKey = initialPart ? `${initialPart.type}:${initialPart.id}` : null;

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const [availableOrders, details] = await Promise.all([
          fetch(`${config.apiBaseUrl}/api/books/custom-order-options`, { signal: controller.signal }).then(readResponse),
          fetch(`${config.apiBaseUrl}/api/books/${book.id}`, { signal: controller.signal }).then(readResponse)
        ]);
        setOrders(availableOrders);
        setChapters(details.chapters || []);
        if (availableOrders.some(order => String(order.id) === defaultOrderId)) {
          setOrderId(defaultOrderId);
        }
        if (initialKey) setSelected(new Set([initialKey]));
      } catch (loadError) {
        if (loadError.name !== 'AbortError') {
          console.error('Error loading book parts and custom orders:', loadError);
          setError(loadError.message);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [book.id, defaultOrderId, initialKey]);

  const toggle = key => setSelected(previous => {
    const next = new Set(previous);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  const addParts = async event => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const selections = [...selected].map(key => {
        const [type, id] = key.split(':');
        return { type, id: Number(id) };
      });
      setResult(await fetch(`${config.apiBaseUrl}/api/books/${book.id}/custom-orders/${orderId}/parts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections })
      }).then(readResponse));
    } catch (saveError) {
      console.error('Error adding book parts to custom order:', saveError);
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="book-parts-title" className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between gap-4 mb-4">
          <div>
            <h2 id="book-parts-title" className="text-xl font-semibold text-gray-900">Add Chapters and Sections to Custom Order</h2>
            <p className="text-sm text-gray-600 mt-1">{book.title}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="text-gray-600 disabled:opacity-50">Close</button>
        </div>
        {error && <p role="alert" className="bg-red-50 text-red-700 rounded p-3 mb-4">{error}</p>}
        {loading ? <p className="text-gray-600">Loading book contents and custom orders...</p> : result ? (
          <div role="status" className="space-y-4">
            <p className="text-green-700">Added {result.added} item(s) to {result.customOrderName}.
              {result.skipped > 0 && ` Skipped ${result.skipped} item(s) already in the order.`}
            </p>
            <Link to={`/media/custom-orders/${result.customOrderId}`} className="text-blue-600 hover:underline">Open custom order</Link>
          </div>
        ) : error && orders.length === 0 ? null : orders.length === 0 ? (
          <p className="text-gray-600">No custom orders available. <Link to="/media/custom-orders" className="text-blue-600 hover:underline">Create an order first.</Link></p>
        ) : chapters.length === 0 ? (
          <p className="text-gray-600">This book has no chapters yet. Add chapters and sections in the book details first.</p>
        ) : (
          <form onSubmit={addParts}>
            <label htmlFor="book-part-order" className="block font-medium text-gray-900 mb-2">Custom order</label>
            <select id="book-part-order" value={orderId} onChange={event => setOrderId(event.target.value)} disabled={saving} required className="w-full border rounded p-2 mb-4 text-gray-900">
              <option value="">Select a custom order</option>
              {orders.map(order => <option key={order.id} value={order.id}>{order.name}</option>)}
            </select>
            <div className="flex gap-4 mb-3 text-sm text-blue-600">
              <button type="button" disabled={saving} onClick={() => setSelected(new Set(chapters.map(chapter => `chapter:${chapter.id}`)))}>Select all chapters</button>
              <button type="button" disabled={saving} onClick={() => setSelected(new Set(chapters.flatMap(chapter => (chapter.sections || []).map(section => `section:${section.id}`))))}>Select all sections</button>
              <button type="button" disabled={saving} onClick={() => setSelected(new Set())}>Clear selection</button>
            </div>
            <div className="max-h-80 overflow-y-auto border rounded divide-y">
              {chapters.map(chapter => (
                <div key={chapter.id} className="p-3 text-gray-900">
                  <label className="flex gap-3 font-medium text-sm">
                    <input type="checkbox" disabled={saving} checked={selected.has(`chapter:${chapter.id}`)} onChange={() => toggle(`chapter:${chapter.id}`)} />
                    <span>Chapter {chapter.chapterNumber}: {chapter.title}</span>
                  </label>
                  {(chapter.sections || []).map(section => (
                    <label key={section.id} className="flex gap-3 ml-6 mt-2 text-sm">
                      <input type="checkbox" disabled={saving} checked={selected.has(`section:${section.id}`)} onChange={() => toggle(`section:${section.id}`)} />
                      <span>Section {section.sectionNumber}: {section.title}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">Selected items are appended in book order. Chapters and sections are separate entries; selecting a chapter does not also add its sections. Read status is shared with the book library and all custom orders.</p>
            <button type="submit" disabled={saving || !orderId || selected.size === 0} className="mt-4 bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50">
              {saving ? 'Adding...' : `Add ${selected.size} Selected Item(s)`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AddBookPartsToOrderModal;
