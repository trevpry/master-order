import React from 'react';
import StatItem from './shared/StatItem';
import ToggleButtonGroup from './shared/ToggleButtonGroup';

const MoviesTab = ({ movieStats, formatDateWithTimezone, movieActorSortBy, setMovieActorSortBy }) => {
  return (
    <div className="tab-content">
      {movieStats ? (
        <>
          {/* Overall Movie Statistics */}
          <div className="stats-card">
            <h2>🎬 Movie Statistics</h2>
            <div className="stats-grid">
              <StatItem 
                label="Total Movies" 
                value={movieStats.totalStats?.totalMovies || 0} 
              />
              <StatItem 
                label="Total Watch Time" 
                value={movieStats.totalStats?.totalMovieWatchTimeFormatted || '0 minutes'} 
              />
              <StatItem 
                label="Custom Orders" 
                value={movieStats.totalStats?.uniqueCustomOrders || 0} 
              />
              <StatItem 
                label="Average Duration" 
                value={movieStats.totalStats?.totalMovies > 0 
                  ? Math.round((movieStats.totalStats?.totalMovieWatchTime || 0) / movieStats.totalStats.totalMovies) + ' min' 
                  : '0 min'
                } 
              />
            </div>
          </div>

          {/* Recent Movies */}
          {movieStats.logs && movieStats.logs.length > 0 && (
            <div className="stats-card">
              <h2>Recent Movies</h2>
              <div className="recent-activity">
                {movieStats.logs
                  .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
                  .slice(0, 10)
                  .map((log, index) => (
                  <div key={index} className="activity-item">
                    <div className="activity-info">
                      <div className="activity-title">
                        <span className="title">{log.title}</span>
                      </div>
                      <div className="activity-meta">
                        <span className="media-type">MOVIE</span>
                        <span className="separator">•</span>
                        <span className="duration">{Math.round(log.totalWatchTime)} min</span>
                        <span className="separator">•</span>
                        <span className="date">{formatDateWithTimezone(log.startTime)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top 10 Actors with Toggle for Movies */}
          {movieStats.totalStats?.actorBreakdown && (
            <div className="stats-card">
              <div className="actor-header">
                <h2>🎭 Top 10 Movie Actors</h2>
                <div className="actor-toggle-controls">
                  <ToggleButtonGroup
                    options={[
                      { value: 'playtime', label: 'By Playtime' },
                      { value: 'episodes', label: 'By Movies' },
                      { value: 'series', label: 'By Collections' }
                    ]}
                    activeValue={movieActorSortBy}
                    onChange={setMovieActorSortBy}
                  />
                </div>
              </div>
              {(() => {
                const getActorData = () => {
                  switch (movieActorSortBy) {
                    case 'playtime':
                      return movieStats.totalStats.actorBreakdown.byPlaytime || [];
                    case 'episodes':
                      return movieStats.totalStats.actorBreakdown.byMovieCount || [];
                    case 'series':
                      return movieStats.totalStats.actorBreakdown.byCollectionCount || [];
                    default:
                      return [];
                  }
                };
                
                const actorData = getActorData();
                
                return actorData.length > 0 ? (
                  <div className="time-breakdown">
                    {actorData.map((actor, index) => (
                      <div key={`movie-${movieActorSortBy}-${index}`} className="time-period">
                        <div className="period-header">
                          <div className="actor-info">
                            <span className="actor-rank">#{index + 1}</span>
                            <h3>{actor.name}</h3>
                          </div>
                          <span className="period-total">
                            {movieActorSortBy === 'playtime' && actor.totalWatchTimeFormatted}
                            {movieActorSortBy === 'episodes' && `${actor.movieCount} movies`}
                            {movieActorSortBy === 'series' && `${actor.collectionCount} collections`}
                          </span>
                        </div>
                        <div className="period-stats">
                          {movieActorSortBy !== 'playtime' && (
                            <div className="period-stat">
                              <span className="stat-type">Playtime:</span>
                              <span>{actor.totalWatchTimeFormatted}</span>
                            </div>
                          )}
                          {movieActorSortBy !== 'episodes' && (
                            <div className="period-stat">
                              <span className="stat-type">Movies:</span>
                              <span>{actor.movieCount}</span>
                            </div>
                          )}
                          {movieActorSortBy !== 'series' && (
                            <div className="period-stat">
                              <span className="stat-type">Collections:</span>
                              <span>{actor.collectionCount}</span>
                            </div>
                          )}
                        </div>
                        {actor.collections && actor.collections.length > 0 && movieActorSortBy === 'series' && (
                          <div className="collection-shows">
                            <h4>Collections Appeared In:</h4>
                            <div className="shows-list">
                              {actor.collections.map((collection, collectionIndex) => (
                                <span key={collectionIndex} className="show-tag">{collection}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {actor.movies && actor.movies.length > 0 && movieActorSortBy === 'episodes' && (
                          <div className="collection-shows">
                            <h4>Movies Appeared In:</h4>
                            <div className="shows-list">
                              {actor.movies.map((movie, movieIndex) => (
                                <span key={movieIndex} className="show-tag">{movie}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#8b949e' }}>
                    <p>No actor data available</p>
                  </div>
                );
              })()}
            </div>
          )}
        </>
      ) : (
        <div className="stats-card">
          <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>
            <h3>Loading Movie Statistics...</h3>
          </div>
        </div>
      )}
    </div>
  );
};

export default MoviesTab;
