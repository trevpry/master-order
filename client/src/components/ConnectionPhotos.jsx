import React, { useState, useRef } from 'react';
import { Star, Trash2, Upload, ImagePlus, Crown, X } from 'lucide-react';
import config from '../config';

const API_BASE = `${config.apiBaseUrl}/api/dating`;

function photoUrl(filename) {
  return `${config.apiBaseUrl}/uploads/connection-photos/${filename}`;
}

export default function ConnectionPhotos({ connectionId, initialPhotos = [], onProfileChanged }) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null); // filename of full-size preview
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach(f => formData.append('photos', f));

      const res = await fetch(`${API_BASE}/connections/${connectionId}/photos`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const saved = await res.json();
        setPhotos(prev => {
          const merged = [...prev, ...saved];
          // If we just got a profile photo for the first time, notify parent
          const newProfile = saved.find(p => p.isProfile);
          if (newProfile && !prev.some(p => p.isProfile)) {
            onProfileChanged?.(newProfile);
          }
          return merged;
        });
      } else {
        const err = await res.json();
        alert(err.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSetProfile = async (photo) => {
    const res = await fetch(`${API_BASE}/photos/${photo.id}/profile`, { method: 'PUT' });
    if (res.ok) {
      setPhotos(prev => prev.map(p => ({ ...p, isProfile: p.id === photo.id })));
      onProfileChanged?.(photo);
    }
  };

  const handleDelete = async (photo) => {
    if (!window.confirm('Delete this photo?')) return;
    const res = await fetch(`${API_BASE}/photos/${photo.id}`, { method: 'DELETE' });
    if (res.ok) {
      setPhotos(prev => {
        const remaining = prev.filter(p => p.id !== photo.id);
        // If deleted photo was profile and there are others, the backend auto-promotes;
        // reflect that optimistically by marking the first remaining as profile
        if (photo.isProfile && remaining.length > 0) {
          remaining[0] = { ...remaining[0], isProfile: true };
          onProfileChanged?.(remaining[0]);
        } else if (photo.isProfile) {
          onProfileChanged?.(null);
        }
        return remaining;
      });
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2">
          <ImagePlus className="w-4 h-4" />
          Photos
          {photos.length > 0 && (
            <span className="bg-pink-100 text-pink-700 text-xs font-semibold rounded-full px-2 py-0.5">
              {photos.length}
            </span>
          )}
        </h3>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 text-xs font-medium text-pink-600 hover:text-pink-800 bg-pink-50 hover:bg-pink-100 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {photos.length === 0 ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="p-10 text-center cursor-pointer hover:bg-gray-50 transition-colors"
        >
          <ImagePlus className="w-10 h-10 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No photos yet — click to upload</p>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-3 gap-3">
          {photos.map(photo => (
            <div key={photo.id} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100 cursor-pointer" onClick={() => setLightbox(photo.filename)}>
              <img
                src={photoUrl(photo.filename)}
                alt={photo.originalName}
                className="w-full h-full object-cover"
              />

              {/* Profile crown badge */}
              {photo.isProfile && (
                <div className="absolute top-1.5 left-1.5 bg-yellow-400 rounded-full p-1 shadow">
                  <Crown className="w-3 h-3 text-white" />
                </div>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2 gap-1">
                {!photo.isProfile && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSetProfile(photo); }}
                    title="Set as profile photo"
                    className="flex items-center gap-1 bg-yellow-400 hover:bg-yellow-500 text-white text-xs font-medium rounded-lg px-2 py-1 transition-colors"
                  >
                    <Crown className="w-3 h-3" />
                    Profile
                  </button>
                )}
                {photo.isProfile && (
                  <span className="flex items-center gap-1 bg-yellow-400 text-white text-xs font-medium rounded-lg px-2 py-1">
                    <Crown className="w-3 h-3" />
                    Profile
                  </span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(photo); }}
                  title="Delete photo"
                  className="ml-auto bg-red-500 hover:bg-red-600 text-white rounded-lg p-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Pink profile ring */}
              {photo.isProfile && (
                <div className="absolute inset-0 rounded-xl ring-2 ring-pink-500 pointer-events-none" />
              )}
            </div>
          ))}

          {/* Quick-upload tile */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-pink-300 hover:bg-pink-50 flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50"
          >
            <Upload className="w-5 h-5 text-gray-300" />
            <span className="text-xs text-gray-400">Add more</span>
          </button>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
            onClick={() => setLightbox(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={photoUrl(lightbox)}
            alt="Preview"
            className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
