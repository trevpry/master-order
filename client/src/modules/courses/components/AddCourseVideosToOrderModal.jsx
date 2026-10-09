import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

const readResponse = async (response) => {
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || result.message || 'The request failed');
  }
  return result.data;
};

const AddCourseVideosToOrderModal = ({ course, videoId, onClose }) => {
  const [searchParams] = useSearchParams();
  const defaultOrderId = searchParams.get('customOrderId');
  const [orders, setOrders] = useState([]);
  const [videos, setVideos] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const [availableOrders, courseVideos] = await Promise.all([
          fetch('/api/courses/custom-order-options', { signal: controller.signal }).then(readResponse),
          fetch(`/api/courses/${course.id}/videos`, { signal: controller.signal }).then(readResponse)
        ]);
        setOrders(availableOrders);
        if (availableOrders.some(order => String(order.id) === defaultOrderId)) {
          setOrderId(defaultOrderId);
        }
        setVideos(courseVideos);
        setSelectedIds(new Set(courseVideos
          .filter(video => videoId === undefined || video.id === videoId)
          .map(video => video.id)));
      } catch (loadError) {
        if (loadError.name !== 'AbortError') {
          console.error('Error loading course videos and custom orders:', loadError);
          setError(loadError.message);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [course.id, videoId, defaultOrderId]);

  const toggleVideo = (id) => {
    setSelectedIds(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const data = await fetch(`/api/courses/${course.id}/custom-orders/${orderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoIds: [...selectedIds] })
      }).then(readResponse);
      setResult(data);
    } catch (saveError) {
      console.error('Error adding course videos to custom order:', saveError);
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="course-order-title" className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <h2 id="course-order-title" className="text-xl font-semibold text-gray-900">Add Course Videos to Custom Order</h2>
            <p className="text-sm text-gray-600 mt-1">{course.title}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="text-gray-600 disabled:opacity-50">Close</button>
        </div>
        {error && <p role="alert" className="bg-red-50 text-red-700 rounded p-3 mb-4">{error}</p>}
        {loading ? (
          <p className="text-gray-600">Loading lectures and custom orders...</p>
        ) : result ? (
          <div role="status" className="space-y-4">
            <p className="text-green-700">
              Added {result.added} video(s) to {result.customOrderName}.
              {result.skipped > 0 && ` Skipped ${result.skipped} video(s) already in the order.`}
            </p>
            <Link to={`/media/custom-orders/${result.customOrderId}`} className="text-blue-600 hover:underline">Open custom order</Link>
          </div>
        ) : error && orders.length === 0 ? null : orders.length === 0 ? (
          <p className="text-gray-600">No custom orders available. <Link to="/media/custom-orders" className="text-blue-600 hover:underline">Create a custom order first.</Link></p>
        ) : videos.length === 0 ? (
          <p className="text-gray-600">No lectures available. Import course videos from the course catalog first.</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label htmlFor="course-order-select" className="block font-medium text-gray-900 mb-2">Custom order</label>
            <select id="course-order-select" value={orderId} onChange={event => setOrderId(event.target.value)} required disabled={saving} className="w-full border rounded p-2 mb-4 text-gray-900">
              <option value="">Select a custom order</option>
              {orders.map(order => <option key={order.id} value={order.id}>{order.name}</option>)}
            </select>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-900">{selectedIds.size} of {videos.length} lectures selected</span>
              <button type="button" disabled={saving} onClick={() => setSelectedIds(selectedIds.size === videos.length ? new Set() : new Set(videos.map(video => video.id)))} className="text-sm text-blue-600">
                {selectedIds.size === videos.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto border rounded divide-y">
              {videos.map(video => (
                <label key={video.id} className="flex gap-3 p-3 text-sm text-gray-900">
                  <input type="checkbox" checked={selectedIds.has(video.id)} onChange={() => toggleVideo(video.id)} disabled={saving} />
                  <span>{video.order != null && `Lecture ${video.order}: `}{video.title}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">Videos are appended in lecture order. Existing videos are skipped; watch progress is tracked independently in each custom order.</p>
            <button type="submit" disabled={saving || !orderId || selectedIds.size === 0} className="mt-4 bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50">
              {saving ? 'Adding...' : 'Add Selected Videos'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AddCourseVideosToOrderModal;
