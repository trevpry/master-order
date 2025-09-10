import React from 'react';

const MusicCollectionsView = ({ collections }) => {
  return (
    <div className="collections-grid">
      {collections.length === 0 ? (
        <div className="empty-state">
          <p>No collections found.</p>
        </div>
      ) : (
        collections.map(collection => (
          <div key={collection.value} className="collection-card">
            <div className="collection-info">
              <h3>{collection.label}</h3>
              <div className="collection-meta">
                <span className="collection-type">Music Collection</span>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default MusicCollectionsView;
