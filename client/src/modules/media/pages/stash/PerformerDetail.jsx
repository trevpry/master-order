import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import config from '../../../../config';

// Helper function to convert cm to feet and inches
const formatHeight = (heightStr) => {
  if (!heightStr) return null;
  // Parse the numeric value from strings like "183 cm" or just "183"
  const heightCm = parseFloat(heightStr);
  if (isNaN(heightCm)) return heightStr; // Return original if can't parse
  const totalInches = heightCm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
};

// Helper function to convert kg to pounds
const formatWeight = (weightStr) => {
  if (!weightStr) return null;
  // Parse the numeric value from strings like "75 kg" or just "75"
  const weightKg = parseFloat(weightStr);
  if (isNaN(weightKg)) return weightStr; // Return original if can't parse
  const pounds = Math.round(weightKg * 2.20462);
  return `${pounds} lbs`;
};

// Helper function to format penis length in inches
const formatPenisLength = (lengthStr) => {
  if (!lengthStr) return null;
  // Parse the numeric value from strings like "18 cm" or just "18"
  const lengthCm = parseFloat(lengthStr);
  if (isNaN(lengthCm)) return lengthStr; // Return original if can't parse
  const inches = (lengthCm / 2.54).toFixed(1);
  return `${inches}"`;
};

export default function PerformerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mergedTags, setMergedTags] = useState([]);
  const [stashUrl, setStashUrl] = useState(null);

  // Fetch Stash URL from settings
  useEffect(() => {
    const fetchStashUrl = async () => {
      try {
        const res = await fetch(`${config.apiBaseUrl}/api/stash/check-connection`);
        const json = await res.json();
        if (json.connected && json.stashUrl) {
          setStashUrl(json.stashUrl);
        }
      } catch (error) {
        console.error('Failed to fetch Stash URL:', error);
      }
    };
    fetchStashUrl();
  }, []);

  useEffect(() => {
    const fetchPerformer = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${config.apiBaseUrl}/api/stash/performers/${id}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to load performer');
        setData(json.data);
        
        // Merge all tags: performer tags + scene-specific tags
        const tagMap = new Map();
        
        // Add general performer tags
        if (json.data.tags) {
          json.data.tags.forEach(tag => {
            if (!tagMap.has(tag.id)) {
              tagMap.set(tag.id, {
                ...tag,
                isGeneral: true,
                sceneCount: 0,
                scenes: []
              });
            }
          });
        }
        
        // Add ALL scene-specific tags from allScenePerformerTags
        if (json.data.allScenePerformerTags) {
          json.data.allScenePerformerTags.forEach(sceneTag => {
            if (tagMap.has(sceneTag.tagId)) {
              // Tag already exists, increment scene count
              const existing = tagMap.get(sceneTag.tagId);
              existing.sceneCount++;
              existing.scenes.push({ id: sceneTag.sceneId, title: sceneTag.sceneTitle });
            } else {
              // New tag from scene
              tagMap.set(sceneTag.tagId, {
                id: sceneTag.tagId,
                name: sceneTag.tagName,
                isGeneral: false,
                sceneCount: 1,
                scenes: [{ id: sceneTag.sceneId, title: sceneTag.sceneTitle }]
              });
            }
          });
        }
        
        // Convert map to array and sort by name
        const merged = Array.from(tagMap.values()).sort((a, b) => 
          a.name.localeCompare(b.name)
        );
        console.log('Merged tags:', merged);
        console.log('Tag map size:', tagMap.size);
        console.log('Performer tags:', json.data.tags);
        console.log('Scenes with tags:', json.data.scenes?.filter(s => s.performerTags?.length > 0));
        setMergedTags(merged);
        
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPerformer();
  }, [id]);

  if (loading) {
    return (
      <div className="page pad performer-detail">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading performer details...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="page pad performer-detail">
        <div className="error-state">
          <p>❌ Error: {error}</p>
          <Link to="/media/stash" className="btn">← Back to Stash</Link>
        </div>
      </div>
    );
  }
  
  if (!data) return null;

  return (
    <div className="page pad performer-detail">
      <div className="breadcrumb">
        <Link to="/media/stash">Stash</Link>
        <span> → </span>
        <span>{data.name}</span>
      </div>

      {/* Hero Section with Image */}
      <div className="performer-detail-hero">
        <div className="performer-hero-image-container">
          {data.image ? (
            <img
              src={data.image}
              alt={data.name}
              className="performer-full-image"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <div className="performer-placeholder-large">
              👤
            </div>
          )}
        </div>
        
        <div className="performer-hero-info">
          <div className="performer-header-row">
            <h1 className="scene-title">👤 {data.name}</h1>
            <div className="performer-header-meta">
              {data.country && (
                <span className="country-badge">
                  🌍 {data.country}
                </span>
              )}
              {/* Social Links - Inline */}
              {data.url && (
                <a href={data.url} target="_blank" rel="noopener noreferrer" className="social-link-inline">
                  🔗
                </a>
              )}
              {data.instagram && (
                <a href={data.instagram} target="_blank" rel="noopener noreferrer" className="social-link-inline">
                  📷
                </a>
              )}
              {data.twitter && (
                <a href={data.twitter} target="_blank" rel="noopener noreferrer" className="social-link-inline">
                  🐦
                </a>
              )}
              {/* Stash Link */}
              {stashUrl && (
                <a 
                  href={`${stashUrl}/performers/${data.id}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="social-link-inline"
                  title="View in Stash"
                >
                  📊
                </a>
              )}
            </div>
          </div>
          
          {data.alias && (
            <p className="performer-alias">
              Also known as: <span>{data.alias}</span>
            </p>
          )}

          {/* Physical Attributes - Moved here */}
          <div className="performer-physical-attributes-inline">
            <h4 className="section-subtitle">📏 Physical Attributes</h4>
            <div className="attributes-compact">
              {data.height && (
                <span className="attribute-item">
                  <strong>Height:</strong> {formatHeight(data.height) || data.height}
                </span>
              )}
              {data.weight && (
                <span className="attribute-item">
                  <strong>Weight:</strong> {formatWeight(data.weight) || data.weight}
                </span>
              )}
              {data.penis_length && (
                <span className="attribute-item">
                  <strong>Penis Length:</strong> {formatPenisLength(data.penis_length) || data.penis_length}
                </span>
              )}
              {data.circumcised && (
                <span className="attribute-item">
                  <strong>Circumcised:</strong> {data.circumcised}
                </span>
              )}
              {data.measurements && (
                <span className="attribute-item">
                  <strong>Measurements:</strong> {data.measurements}
                </span>
              )}
              {data.eye_color && (
                <span className="attribute-item">
                  <strong>Eyes:</strong> {data.eye_color}
                </span>
              )}
              {data.hair_color && (
                <span className="attribute-item">
                  <strong>Hair:</strong> {data.hair_color}
                </span>
              )}
              {data.ethnicityTag && (
                <span className="attribute-item">
                  <strong>Ethnicity:</strong>{' '}
                  <Link to={`/media/stash/tags/${data.ethnicityTag.id}`} className="tag-link-inline">
                    {data.ethnicityTag.name}
                  </Link>
                </span>
              )}
              {!data.ethnicityTag && data.ethnicity && (
                <span className="attribute-item">
                  <strong>Ethnicity:</strong> {data.ethnicity}
                </span>
              )}
              {data.tattoos && (
                <span className="attribute-item">
                  <strong>Tattoos:</strong> {data.tattoos}
                </span>
              )}
              {data.piercings && (
                <span className="attribute-item">
                  <strong>Piercings:</strong> {data.piercings}
                </span>
              )}
              {data.career_length && (
                <span className="attribute-item">
                  <strong>Career:</strong> {data.career_length}
                </span>
              )}
            </div>
          </div>
          
          <div className="scene-meta-badges">
            {data.birthdate && (
              <div className="meta-badge">
                <span className="badge-icon">🎂</span>
                <span>{data.birthdate}</span>
              </div>
            )}
            {data.rating && (
              <div className="meta-badge rating">
                <span className="badge-icon">⭐</span>
                <span>{data.rating}/100</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="scene-detail-content">
        {/* Details Section */}
        {data.details && (
          <div className="card scene-details-card">
            <h3>📝 Details</h3>
            <p className="scene-description">{data.details}</p>
          </div>
        )}

        {/* Tags Section - Merged from performer and scene-specific */}
        <div className="card">
          <h3>🏷️ All Tags ({mergedTags.length})</h3>
          <p className="text-sm text-gray-600 mb-3">
            Tags applied to this performer (general) or in specific scenes
          </p>
          {mergedTags.length > 0 ? (
            <div className="tags-grid-detailed">
              {mergedTags.map(tag => (
                <div key={tag.id} className="tag-detail-item">
                  <Link
                    to={`/media/stash/tags/${tag.id}`}
                    className="tag-chip-detailed"
                  >
                    <span className="tag-name">{tag.name}</span>
                    {tag.isGeneral && tag.sceneCount > 0 && (
                      <span className="tag-badge general-and-scene">
                        General + {tag.sceneCount} scene{tag.sceneCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {tag.isGeneral && tag.sceneCount === 0 && (
                      <span className="tag-badge general-only">
                        General
                      </span>
                    )}
                    {!tag.isGeneral && (
                      <span className="tag-badge scene-only">
                        {tag.sceneCount} scene{tag.sceneCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </Link>
                  {tag.scenes.length > 0 && (
                    <div className="tag-scenes-list">
                      {tag.scenes.slice(0, 3).map(scene => (
                        <Link
                          key={scene.id}
                          to={`/media/stash/scenes/${scene.id}`}
                          className="tag-scene-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          🎬 {scene.title || 'Untitled'}
                        </Link>
                      ))}
                      {tag.scenes.length > 3 && (
                        <span className="more-scenes">
                          +{tag.scenes.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-400">
              No tags found for this performer.
            </div>
          )}
        </div>

        {/* Scenes Section */}
        {data.scenes && data.scenes.length > 0 && (
          <div className="card full-width">
            <h3>🎬 Recent Scenes ({data.scenes.length})</h3>
            <div className="scenes-list">
              {data.scenes.map(scene => (
                <div
                  key={scene.id}
                  className="scene-list-item clickable"
                  onClick={() => navigate(`/media/stash/scenes/${scene.id}`)}
                >
                  <div className="scene-list-info">
                    <div className="scene-list-title">
                      {scene.title || 'Untitled Scene'}
                    </div>
                    <div className="scene-list-meta">
                      {scene.date && <span>📅 {scene.date}</span>}
                      {scene.studio && (
                        <span>
                          🏢 {typeof scene.studio === 'string' ? scene.studio : scene.studio?.name}
                        </span>
                      )}
                    </div>
                    {/* Scene-specific performer tags */}
                    {scene.performerTags && scene.performerTags.length > 0 && (
                      <div className="scene-performer-tags">
                        <span className="tags-label">Tags in this scene:</span>
                        {scene.performerTags.map(tag => (
                          <Link
                            key={tag.id}
                            to={`/media/stash/tags/${tag.id}`}
                            className="mini-tag-chip"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {tag.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
