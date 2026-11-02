import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import config from '../../../../../config';

const proxied = (url) => (url && url.startsWith('https://gayeroticvideoindex.com/')
  ? `${config.apiBaseUrl}/api/stash/gevi-image-proxy?url=${encodeURIComponent(url)}`
  : url);

/** Groups the performer is attached to (from the group's scenes or added manually). */
export default function PerformerGroupsCard({ performerId }) {
  const [groups, setGroups] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setGroups(null);
    fetch(`${config.apiBaseUrl}/api/stash/groups?performerId=${encodeURIComponent(performerId)}&limit=100&sortBy=date&sortOrder=desc`)
      .then(res => res.json())
      .then(json => { if (!cancelled) setGroups(json.success ? json.data.groups : []); })
      .catch(() => { if (!cancelled) setGroups([]); });
    return () => { cancelled = true; };
  }, [performerId]);

  if (!groups || groups.length === 0) return null;

  return (
    <div className="card full-width">
      <h3>🎞️ Groups ({groups.length})</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1rem', marginTop: '0.75rem' }}>
        {groups.map(group => {
          const manual = group.performers?.[0]?.source === 'manual';
          return (
            <Link
              key={group.id}
              to={`/media/stash/groups/${group.id}`}
              style={{ color: 'inherit', textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}
            >
              <div style={{ aspectRatio: '2 / 3', borderRadius: '6px', overflow: 'hidden', background: 'rgba(255, 255, 255, 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {group.frontImage
                  ? <img src={proxied(group.frontImage)} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: '2rem', opacity: 0.4 }}>🎞️</span>}
              </div>
              <span style={{ fontSize: '0.85rem', lineHeight: 1.25 }}>{group.name}</span>
              <span style={{ fontSize: '0.7rem', color: manual ? '#90cdf4' : '#a0aec0' }}>
                {manual ? 'Added manually' : 'From scenes'}
                {group.date ? ` · ${String(group.date).slice(0, 4)}` : ''}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
