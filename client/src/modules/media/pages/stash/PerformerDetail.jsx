import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import config from '../../../../config';

export default function PerformerDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPerformer = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${config.apiBaseUrl}/api/stash/performers/${id}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to load performer');
        setData(json.data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPerformer();
  }, [id]);

  if (loading) return <div className="page pad">Loading performer…</div>;
  if (error) return <div className="page pad">Error: {error}</div>;
  if (!data) return null;

  return (
    <div className="page pad performer-detail">
      <div className="breadcrumb">
        <Link to="/media/stash">← Back to Stash</Link>
      </div>

      <div className="header">
        <div className="image">
          {data.image ? (
            <img src={data.image} alt={data.name} />
          ) : (
            <div className="placeholder">👤</div>
          )}
        </div>
        <div className="info">
          <h1>{data.name}</h1>
          {data.alias && <p className="muted">Aliases: {data.alias}</p>}
          <div className="grid grid-2">
            {data.gender && <div><strong>Gender:</strong> {data.gender}</div>}
            {data.birthdate && <div><strong>Birthdate:</strong> {data.birthdate}</div>}
            {data.death_date && <div><strong>Death:</strong> {data.death_date}</div>}
            {data.country && <div><strong>Country:</strong> {data.country}</div>}
            {data.ethnicity && <div><strong>Ethnicity:</strong> {data.ethnicity}</div>}
            {data.eye_color && <div><strong>Eye color:</strong> {data.eye_color}</div>}
            {data.hair_color && <div><strong>Hair color:</strong> {data.hair_color}</div>}
            {data.height && <div><strong>Height:</strong> {data.height}</div>}
            {data.weight && <div><strong>Weight:</strong> {data.weight}</div>}
            {data.measurements && <div><strong>Measurements:</strong> {data.measurements}</div>}
            {data.rating && <div><strong>Rating:</strong> {data.rating}</div>}
          </div>
          {data.details && (
            <div className="details">
              <h3>Details</h3>
              <p>{data.details}</p>
            </div>
          )}
          <div className="links">
            {data.url && <a href={data.url} target="_blank" rel="noopener noreferrer">Website</a>}
            {data.instagram && <a href={data.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>}
            {data.twitter && <a href={data.twitter} target="_blank" rel="noopener noreferrer">Twitter</a>}
          </div>
          {data.tags && data.tags.length > 0 && (
            <div className="tags">
              <h3>Tags</h3>
              <div className="chips">
                {data.tags.map(t => (
                  <span key={t.id} className="chip">{t.name}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {data.scenes && data.scenes.length > 0 && (
        <div className="section">
          <h2>Recent Scenes</h2>
          <div className="cards grid-3">
            {data.scenes.map(scene => (
              <div key={scene.id} className="card">
                <div className="card-body">
                  <div className="title">{scene.title || 'Untitled scene'}</div>
                  <div className="muted small">
                    {scene.date && <span>📅 {scene.date} </span>}
                    {scene.studio && <span>🏢 {typeof scene.studio === 'string' ? scene.studio : scene.studio?.name}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
