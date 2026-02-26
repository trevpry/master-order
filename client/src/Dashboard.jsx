import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import config from './config';

const POLL_INTERVAL_MS = 15_000;

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDuration(ms) {
  if (!ms) return null;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDurationSec(sec) {
  if (!sec) return null;
  return formatDuration(sec * 1000);
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function plexArtworkUrl(thumb) {
  if (!thumb) return null;
  if (thumb.startsWith('http')) return thumb;
  const clean = thumb.startsWith('/') ? thumb.substring(1) : thumb;
  return `${config.apiBaseUrl}/api/artwork/${clean}`;
}

function progressPercent(offset, duration) {
  if (!offset || !duration) return 0;
  return Math.min(100, Math.round((offset / duration) * 100));
}

function stateColor(state) {
  if (state === 'playing') return '#22c55e';
  if (state === 'paused') return '#f59e0b';
  return '#6b7280';
}

function stateIcon(state) {
  if (state === 'playing') return '▶';
  if (state === 'paused') return '⏸';
  return '■';
}

// ── sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
      <span style={{ fontSize: '1.4rem' }}>{icon}</span>
      <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>{title}</h2>
      {count != null && (
        <span style={{
          background: count > 0 ? '#3b82f6' : '#94a3b8',
          color: 'white',
          fontSize: '0.75rem',
          fontWeight: 700,
          borderRadius: '9999px',
          padding: '0.1rem 0.5rem',
        }}>{count}</span>
      )}
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      padding: '1.25rem',
      ...style,
    }}>
      {children}
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div style={{ color: '#94a3b8', fontSize: '0.9rem', padding: '0.5rem 0' }}>
      {label}
    </div>
  );
}

// Active Plex session card
function PlexSessionCard({ session }) {
  const thumb = plexArtworkUrl(session.thumb);
  const pct = progressPercent(session.viewOffset, session.duration);
  const elapsed = formatDuration(session.viewOffset);
  const total = formatDuration(session.duration);
  const color = stateColor(session.state);

  let title = session.title;
  let subtitle = null;
  if (session.type === 'episode') {
    subtitle = session.grandparentTitle;
    if (session.parentIndex != null && session.index != null) {
      subtitle += ` · S${String(session.parentIndex).padStart(2, '0')}E${String(session.index).padStart(2, '0')}`;
    }
  } else if (session.type === 'movie') {
    subtitle = session.year ? String(session.year) : 'Movie';
  } else if (session.type === 'track') {
    subtitle = [session.grandparentTitle, session.parentTitle].filter(Boolean).join(' · ');
  }

  return (
    <div style={{
      display: 'flex', gap: '1rem', padding: '0.9rem', borderRadius: '10px',
      background: '#f8fafc', border: '1px solid #e2e8f0', alignItems: 'flex-start',
    }}>
      <div style={{
        width: 64, height: 64, flexShrink: 0, borderRadius: 8, overflow: 'hidden',
        background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {thumb ? (
          <img src={thumb} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { e.target.style.display = 'none'; }} />
        ) : (
          <span style={{ fontSize: '1.5rem' }}>
            {session.type === 'episode' ? '📺' : session.type === 'movie' ? '🎬' : '🎵'}
          </span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
          <span style={{ fontSize: '1rem', color, fontWeight: 700 }}>{stateIcon(session.state)}</span>
          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </span>
        </div>
        {subtitle && (
          <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.4rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {subtitle}
          </div>
        )}
        {session.duration > 0 && (
          <div style={{ marginBottom: '0.3rem' }}>
            <div style={{ background: '#e2e8f0', borderRadius: 9999, height: 4, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 9999, transition: 'width 0.5s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
              <span>{elapsed}</span><span>{pct}%</span><span>{total}</span>
            </div>
          </div>
        )}
        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
          {session.playerTitle && <span>📺 {session.playerTitle}</span>}
          {session.user && <span style={{ marginLeft: '0.5rem' }}>👤 {session.user}</span>}
        </div>
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [appMusic, setAppMusic] = useState(null);
  const timerRef = useRef(null);

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/monitoring`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
      setLastRefreshed(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    timerRef.current = setInterval(() => fetchData(), POLL_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [fetchData]);

  useEffect(() => {
    const applyState = ({ track, isPlaying: playing }) => {
      if (track) {
        setAppMusic({ title: track.title, artist: track.artist || track.grandparentTitle, album: track.album || track.parentTitle, isPlaying: playing });
      } else {
        setAppMusic(null);
      }
    };

    // Read cached state immediately (covers the case where music was already playing on mount)
    if (window.__musicPlayerState) {
      applyState(window.__musicPlayerState);
    }

    const onStateChanged = (e) => applyState(e.detail || {});
    // Fallback: catch the initial startMusicPlayback before player has processed it
    const onStart = (e) => {
      const first = e.detail?.playlist?.tracks?.[0];
      if (first) setAppMusic({ title: first.title, artist: first.artist, album: first.album, isPlaying: true });
    };
    window.addEventListener('musicPlayerStateChanged', onStateChanged);
    window.addEventListener('startMusicPlayback', onStart);
    // Ask the player to re-broadcast in case __musicPlayerState wasn't set yet
    window.dispatchEvent(new CustomEvent('requestMusicPlayerState'));
    return () => {
      window.removeEventListener('musicPlayerStateChanged', onStateChanged);
      window.removeEventListener('startMusicPlayback', onStart);
    };
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 40, height: 40, border: '4px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#64748b' }}>Loading monitoring data…</p>
      </div>
    );
  }

  const sessions = data?.plexSessions || [];
  const playingSessions = sessions.filter(s => s.state === 'playing');
  const pausedSessions = sessions.filter(s => s.state !== 'playing');

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto', background: '#f1f5f9', minHeight: '100vh' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>📡 Monitoring</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>Live playback activity across all sources</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {lastRefreshed && (
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Updated {timeAgo(lastRefreshed)}</span>
          )}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            style={{
              padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
              background: refreshing ? '#93c5fd' : '#3b82f6', color: 'white',
              fontWeight: 600, cursor: refreshing ? 'default' : 'pointer',
              fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem',
            }}
          >
            {refreshing
              ? <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              : '↺'}
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.5rem', color: '#dc2626', fontSize: '0.875rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Now Playing on Plex */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <SectionHeader icon="📺" title="Now Playing on Plex" count={sessions.length} />
        {data?.plexSessionsError && (
          <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
            Could not reach Plex: {data.plexSessionsError}
          </div>
        )}
        {sessions.length === 0 && !data?.plexSessionsError && (
          <EmptyState label="Nothing playing on Plex right now" />
        )}
        {playingSessions.length > 0 && (
          <div style={{ marginBottom: pausedSessions.length ? '1rem' : 0 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>▶ Playing</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {playingSessions.map(s => <PlexSessionCard key={s.sessionKey || s.ratingKey} session={s} />)}
            </div>
          </div>
        )}
        {pausedSessions.length > 0 && (
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>⏸ Paused</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {pausedSessions.map(s => <PlexSessionCard key={s.sessionKey || s.ratingKey} session={s} />)}
            </div>
          </div>
        )}
      </Card>

      {/* Music in App */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <SectionHeader icon="🎵" title="Music in App" />
        {appMusic ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 48, height: 48, borderRadius: 8, background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>🎵</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: appMusic.isPlaying ? '#22c55e' : '#f59e0b', animation: appMusic.isPlaying ? 'pulse 1.5s ease-in-out infinite' : 'none' }} />
                <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appMusic.title}</span>
              </div>
              {(appMusic.artist || appMusic.album) && (
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>{[appMusic.artist, appMusic.album].filter(Boolean).join(' · ')}</div>
              )}
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.15rem' }}>{appMusic.isPlaying ? '▶ Playing' : '⏸ Paused'} in Music Player</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <EmptyState label="Music player is not active" />
            {data?.lastMusicTrack && (
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Last: <em>{data.lastMusicTrack.title}</em> · {timeAgo(data.lastMusicTrack.lastViewedAt)}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Last Played grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '1.25rem' }}>

        {/* Last Plex item */}
        <Card>
          <SectionHeader icon="📺" title="Last Plex Item" />
          {data?.lastPlexItem ? (
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1e293b', marginBottom: '0.2rem' }}>{data.lastPlexItem.title}</div>
              {data.lastPlexItem.seriesTitle && (
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.15rem' }}>
                  {data.lastPlexItem.seriesTitle}
                  {data.lastPlexItem.seasonNumber != null && data.lastPlexItem.episodeNumber != null &&
                    ` · S${String(data.lastPlexItem.seasonNumber).padStart(2,'0')}E${String(data.lastPlexItem.episodeNumber).padStart(2,'0')}`}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ background: data.lastPlexItem.mediaType === 'movie' ? '#f0fdf4' : '#eff6ff', color: data.lastPlexItem.mediaType === 'movie' ? '#16a34a' : '#2563eb', fontSize: '0.75rem', fontWeight: 600, borderRadius: 6, padding: '0.15rem 0.5rem' }}>
                  {data.lastPlexItem.mediaType === 'movie' ? '🎬 Movie' : '📺 Episode'}
                </span>
                <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{timeAgo(data.lastPlexItem.watchedAt)}</span>
              </div>
              <Link to="/media/up-next" style={{ display: 'inline-block', marginTop: '0.75rem', fontSize: '0.8rem', color: '#3b82f6', textDecoration: 'none' }}>Open Media →</Link>
            </div>
          ) : <EmptyState label="No Plex items watched yet" />}
        </Card>

        {/* Last music track */}
        <Card>
          <SectionHeader icon="🎵" title="Last Music Track" />
          {data?.lastMusicTrack ? (
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1e293b', marginBottom: '0.2rem' }}>{data.lastMusicTrack.title}</div>
              {data.lastMusicTrack.artist && <div style={{ fontSize: '0.82rem', color: '#64748b' }}>{data.lastMusicTrack.artist}</div>}
              {data.lastMusicTrack.album && <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{data.lastMusicTrack.album}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                {data.lastMusicTrack.duration && <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>⏱ {formatDuration(data.lastMusicTrack.duration)}</span>}
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{timeAgo(data.lastMusicTrack.lastViewedAt)}</span>
              </div>
              <Link to="/media/music" style={{ display: 'inline-block', marginTop: '0.75rem', fontSize: '0.8rem', color: '#3b82f6', textDecoration: 'none' }}>Open Music →</Link>
            </div>
          ) : <EmptyState label="No music played yet" />}
        </Card>

        {/* Last Stash scene */}
        <Card>
          <SectionHeader icon="🎬" title="Last Stash Scene" />
          {data?.lastStashScene ? (
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1e293b', marginBottom: '0.2rem' }}>{data.lastStashScene.title || `Scene ${data.lastStashScene.id}`}</div>
              {data.lastStashScene.studio && <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.15rem' }}>🏢 {data.lastStashScene.studio}</div>}
              {data.lastStashScene.performers?.length > 0 && (
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.15rem' }}>
                  👤 {data.lastStashScene.performers.slice(0, 3).join(', ')}{data.lastStashScene.performers.length > 3 ? ` +${data.lastStashScene.performers.length - 3}` : ''}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                {data.lastStashScene.duration && <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>⏱ {formatDurationSec(data.lastStashScene.duration)}</span>}
                {data.lastStashScene.playCount > 0 && <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>▶ {data.lastStashScene.playCount}×</span>}
                {data.lastStashScene.userRating && <span style={{ fontSize: '0.78rem', color: '#f59e0b' }}>★ {data.lastStashScene.userRating}</span>}
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{timeAgo(data.lastStashScene.lastPlayedAt)}</span>
              </div>
              <Link to={`/media/stash/scenes/${data.lastStashScene.id}`} style={{ display: 'inline-block', marginTop: '0.75rem', fontSize: '0.8rem', color: '#3b82f6', textDecoration: 'none' }}>Open Scene →</Link>
            </div>
          ) : <EmptyState label="No Stash scenes played yet" />}
        </Card>

        {/* Last Stash clip */}
        <Card>
          <SectionHeader icon="✂️" title="Last Stash Clip" />
          {data?.lastStashClip ? (
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1e293b', marginBottom: '0.2rem' }}>
                {data.lastStashClip.title || `Clip #${data.lastStashClip.clipIndex}`}
              </div>
              {data.lastStashClip.sceneTitle && <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.15rem' }}>From: {data.lastStashClip.sceneTitle}</div>}
              {data.lastStashClip.studio && <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.15rem' }}>🏢 {data.lastStashClip.studio}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                {data.lastStashClip.duration && <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>⏱ {formatDurationSec(data.lastStashClip.duration)}</span>}
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{timeAgo(data.lastStashClip.watchedAt)}</span>
              </div>
              <Link to={`/media/stash/scenes/${data.lastStashClip.sceneId}`} style={{ display: 'inline-block', marginTop: '0.75rem', fontSize: '0.8rem', color: '#3b82f6', textDecoration: 'none' }}>Open Scene →</Link>
            </div>
          ) : <EmptyState label="No Stash clips watched yet" />}
        </Card>

      </div>
    </div>
  );
}

export default Dashboard;
