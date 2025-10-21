import React, { useState } from 'react';
import axios from 'axios';

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '0.5rem',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    maxWidth: '600px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
  },
  header: {
    padding: '1.5rem',
    borderBottom: '1px solid #e5e7eb',
    position: 'sticky',
    top: 0,
    backgroundColor: 'white',
    zIndex: 1,
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#1f2937',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#6b7280',
    marginTop: '0.25rem',
  },
  body: {
    padding: '1.5rem',
  },
  section: {
    marginBottom: '1.5rem',
  },
  sectionTitle: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '0.75rem',
  },
  performersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  performerOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem',
    border: '2px solid #e5e7eb',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  performerOptionSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  performerImage: {
    width: '48px',
    height: '48px',
    borderRadius: '0.375rem',
    objectFit: 'cover',
    backgroundColor: '#f3f4f6',
  },
  performerImagePlaceholder: {
    width: '48px',
    height: '48px',
    borderRadius: '0.375rem',
    backgroundColor: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    color: '#9ca3af',
  },
  performerInfo: {
    flex: 1,
  },
  performerName: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#1f2937',
  },
  performerMeta: {
    fontSize: '0.75rem',
    color: '#6b7280',
    marginTop: '0.25rem',
  },
  radio: {
    width: '1.25rem',
    height: '1.25rem',
    cursor: 'pointer',
    accentColor: '#3b82f6',
  },
  infoBox: {
    padding: '1rem',
    backgroundColor: '#fef3c7',
    border: '1px solid #fbbf24',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    color: '#92400e',
    lineHeight: '1.5',
  },
  warningBox: {
    padding: '1rem',
    backgroundColor: '#fee2e2',
    border: '1px solid #f87171',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    color: '#991b1b',
    lineHeight: '1.5',
    fontWeight: '500',
  },
  footer: {
    padding: '1rem 1.5rem',
    borderTop: '1px solid #e5e7eb',
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'flex-end',
    position: 'sticky',
    bottom: 0,
    backgroundColor: 'white',
  },
  button: {
    padding: '0.5rem 1.25rem',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.2s ease',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    color: '#374151',
  },
  mergeButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
  },
  mergeButtonDisabled: {
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed',
  },
  errorMessage: {
    padding: '1rem',
    backgroundColor: '#fee2e2',
    border: '1px solid #f87171',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    color: '#991b1b',
    marginTop: '1rem',
  },
  successMessage: {
    padding: '1rem',
    backgroundColor: '#d1fae5',
    border: '1px solid #34d399',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    color: '#065f46',
    marginTop: '1rem',
  },
};

export default function MergePerformersModal({ 
  performers, 
  onClose, 
  onSuccess 
}) {
  const [mainPerformerId, setMainPerformerId] = useState(performers[0]?.id || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleMerge = async () => {
    if (!mainPerformerId || performers.length < 2) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const mergePerformerIds = performers
        .filter(p => p.id !== mainPerformerId)
        .map(p => p.id);

      const response = await axios.post('/api/stash/performers/merge', {
        mainPerformerId,
        mergePerformerIds,
      });

      setSuccess(response.data.data.message || 'Performers merged successfully!');
      
      // Call success callback after a short delay to show success message
      setTimeout(() => {
        if (onSuccess) onSuccess(response.data.data);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Error merging performers:', err);
      setError(err.response?.data?.error || 'Failed to merge performers');
    } finally {
      setLoading(false);
    }
  };

  const mainPerformer = performers.find(p => p.id === mainPerformerId);
  const mergePerformers = performers.filter(p => p.id !== mainPerformerId);
  const totalScenes = performers.reduce((sum, p) => {
    return sum + (p.scene_count || p.scenes?.length || 0);
  }, 0);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Merge Performers</h2>
          <p style={styles.subtitle}>
            Select which performer should be the main performer
          </p>
        </div>

        <div style={styles.body}>
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              Select Main Performer
            </div>
            <div style={styles.performersList}>
              {performers.map((performer) => {
                const isSelected = performer.id === mainPerformerId;
                const imageUrl = performer.image_path || performer.image;
                const sceneCount = performer.scene_count || performer.scenes?.length || 0;

                return (
                  <div
                    key={performer.id}
                    style={{
                      ...styles.performerOption,
                      ...(isSelected ? styles.performerOptionSelected : {}),
                    }}
                    onClick={() => setMainPerformerId(performer.id)}
                  >
                    <input
                      type="radio"
                      name="mainPerformer"
                      checked={isSelected}
                      onChange={() => setMainPerformerId(performer.id)}
                      style={styles.radio}
                    />
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={performer.name}
                        style={styles.performerImage}
                      />
                    ) : (
                      <div style={styles.performerImagePlaceholder}>
                        👤
                      </div>
                    )}
                    <div style={styles.performerInfo}>
                      <div style={styles.performerName}>{performer.name}</div>
                      <div style={styles.performerMeta}>
                        {sceneCount} scene{sceneCount !== 1 ? 's' : ''}
                        {performer.aliases && ` • Aliases: ${performer.aliases}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={styles.section}>
            <div style={styles.infoBox}>
              <strong>What will happen:</strong>
              <ul style={{ marginTop: '0.5rem', marginBottom: 0, paddingLeft: '1.25rem' }}>
                <li>All scenes from {mergePerformers.length} performer{mergePerformers.length !== 1 ? 's' : ''} will be transferred to <strong>{mainPerformer?.name}</strong></li>
                <li>Names of merged performers will be added as aliases</li>
                <li>Existing aliases will be combined and deduplicated</li>
                <li>Merged performers will be deleted</li>
                <li>Changes will sync to Stash</li>
              </ul>
            </div>
          </div>

          <div style={styles.section}>
            <div style={styles.warningBox}>
              ⚠️ <strong>Warning:</strong> This action cannot be undone. {mergePerformers.length} performer{mergePerformers.length !== 1 ? 's' : ''} will be permanently deleted after merging.
            </div>
          </div>

          {error && (
            <div style={styles.errorMessage}>
              ❌ {error}
            </div>
          )}

          {success && (
            <div style={styles.successMessage}>
              ✅ {success}
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button
            style={{ ...styles.button, ...styles.cancelButton }}
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            style={{
              ...styles.button,
              ...styles.mergeButton,
              ...(loading || !mainPerformerId ? styles.mergeButtonDisabled : {}),
            }}
            onClick={handleMerge}
            disabled={loading || !mainPerformerId}
          >
            {loading ? 'Merging...' : `Merge ${performers.length} Performers`}
          </button>
        </div>
      </div>
    </div>
  );
}
