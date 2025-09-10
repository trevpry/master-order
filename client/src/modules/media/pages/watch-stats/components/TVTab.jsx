import React from 'react';
import StatItem from './shared/StatItem';
import ToggleButtonGroup from './shared/ToggleButtonGroup';

const TVTab = ({ tvStats, formatDateWithTimezone, actorSortBy, setActorSortBy }) => {
  console.log('TVTab received tvStats:', tvStats);
  
  return (
    <div className="tab-content">
      {tvStats ? (
        <>
          {/* Overall TV Statistics */}
          <div className="stats-card">
            <h2>📺 TV Show Statistics</h2>
            <div className="stats-grid">
              <StatItem 
                label="Total Episodes" 
                value={tvStats.totalStats?.totalTvEpisodes || 0} 
              />
              <StatItem 
                label="Total Watch Time" 
                value={tvStats.totalStats?.totalTvWatchTimeFormatted || '0 minutes'} 
              />
              <StatItem 
                label="Unique Shows" 
                value={tvStats.totalStats?.uniqueShows || 0} 
              />
              <StatItem 
                label="Unique Seasons" 
                value={tvStats.totalStats?.uniqueSeasons || 0} 
              />
              <StatItem 
                label="Collections" 
                value={tvStats.totalStats?.uniqueCollections || 0} 
              />
              <StatItem 
                label="Custom Orders" 
                value={tvStats.totalStats?.uniqueCustomOrders || 0} 
              />
              <StatItem 
                label="Average Episode Length" 
                value={tvStats.totalStats?.totalTvEpisodes > 0 
                  ? Math.round((tvStats.totalStats?.totalTvWatchTime || 0) / tvStats.totalStats.totalTvEpisodes) + ' min'
                  : '0 min'
                } 
              />
            </div>
          </div>

          {/* Recent TV Episodes */}
          {tvStats.logs && tvStats.logs.length > 0 && (
            <div className="stats-card">
              <h2>Recent TV Episodes</h2>
              <div className="recent-activity">
                {tvStats.logs
                  .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
                  .slice(0, 10)
                  .map((log, index) => (
                  <div key={index} className="activity-item">
                    <div className="activity-info">
                      <div className="activity-title">
                        {log.seriesTitle && (
                          <span className="series-title">{log.seriesTitle} - </span>
                        )}
                        <span className="title">{log.title}</span>
                        {log.seasonNumber && log.episodeNumber && (
                          <span className="episode-info"> (S{log.seasonNumber}E{log.episodeNumber})</span>
                        )}
                      </div>
                      <div className="activity-meta">
                        <span className="media-type">TV</span>
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

          {/* Collections Breakdown */}
          {tvStats.totalStats?.collectionBreakdown && tvStats.totalStats.collectionBreakdown.length > 0 && (
            <div className="stats-card">
              <h2>Collections Breakdown</h2>
              <div className="time-breakdown">
                {tvStats.totalStats.collectionBreakdown.map((collection, index) => (
                  <div key={index} className="time-period">
                    <div className="period-header">
                      <h3>{collection.name}</h3>
                      <span className="period-total">
                        {collection.totalWatchTimeFormatted}
                      </span>
                    </div>
                    <div className="period-stats">
                      <div className="period-stat">
                        <span className="stat-type">Shows:</span>
                        <span>{collection.uniqueShows}</span>
                      </div>
                      <div className="period-stat">
                        <span className="stat-type">Episodes:</span>
                        <span>{collection.totalEpisodes}</span>
                      </div>
                      <div className="period-stat">
                        <span className="stat-type">Seasons:</span>
                        <span>{collection.uniqueSeasons}</span>
                      </div>
                    </div>
                    {collection.shows && collection.shows.length > 0 && (
                      <div className="collection-shows">
                        <h4>Shows in Collection:</h4>
                        <div className="shows-list">
                          {collection.shows.map((show, showIndex) => (
                            <span key={showIndex} className="show-tag">{show}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Series Breakdown */}
          {tvStats.totalStats?.seriesBreakdown && tvStats.totalStats.seriesBreakdown.length > 0 && (
            <div className="stats-card">
              <h2>Series Breakdown</h2>
              <div className="time-breakdown">
                {tvStats.totalStats.seriesBreakdown.map((series, index) => (
                  <div key={index} className="time-period">
                    <div className="period-header">
                      <h3>{series.name}</h3>
                      <span className="period-total">
                        {series.totalWatchTimeFormatted}
                      </span>
                    </div>
                    <div className="period-stats">
                      <div className="period-stat">
                        <span className="stat-type">Episodes:</span>
                        <span>{series.totalEpisodes}</span>
                      </div>
                      <div className="period-stat">
                        <span className="stat-type">Seasons:</span>
                        <span>{series.uniqueSeasons}</span>
                      </div>
                      <div className="period-stat">
                        <span className="stat-type">Avg Episode:</span>
                        <span>{series.averageEpisodeLength} min</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top 10 Actors with Toggle */}
          {tvStats.totalStats?.actorBreakdown && (
            <div className="stats-card">
              <div className="actor-header">
                <h2>🎭 Top 10 Actors</h2>
                <div className="actor-toggle-controls">
                  <ToggleButtonGroup
                    options={[
                      { value: 'playtime', label: 'By Playtime' },
                      { value: 'episodes', label: 'By Episodes' },
                      { value: 'series', label: 'By Series' }
                    ]}
                    activeValue={actorSortBy}
                    onChange={setActorSortBy}
                  />
                </div>
              </div>
              {(() => {
                const getActorData = () => {
                  switch (actorSortBy) {
                    case 'playtime':
                      return tvStats.totalStats.actorBreakdown.byPlaytime || [];
                    case 'episodes':
                      return tvStats.totalStats.actorBreakdown.byEpisodeCount || [];
                    case 'series':
                      return tvStats.totalStats.actorBreakdown.bySeriesCount || [];
                    default:
                      return [];
                  }
                };
                
                const actorData = getActorData();
                const sortLabel = actorSortBy === 'playtime' ? 'Total Playtime' : 
                                 actorSortBy === 'episodes' ? 'Episode Count' : 
                                 'Series Count';
                
                return actorData.length > 0 ? (
                  <div className="time-breakdown">
                    {actorData.map((actor, index) => (
                      <div key={`${actorSortBy}-${index}`} className="time-period">
                        <div className="period-header">
                          <div className="actor-info">
                            <span className="actor-rank">#{index + 1}</span>
                            <h3>{actor.name}</h3>
                          </div>
                          <span className="period-total">
                            {actorSortBy === 'playtime' && actor.totalWatchTimeFormatted}
                            {actorSortBy === 'episodes' && `${actor.episodeCount} episodes`}
                            {actorSortBy === 'series' && `${actor.seriesCount} series`}
                          </span>
                        </div>
                        <div className="period-stats">
                          {actorSortBy !== 'playtime' && (
                            <div className="period-stat">
                              <span className="stat-type">Playtime:</span>
                              <span>{actor.totalWatchTimeFormatted}</span>
                            </div>
                          )}
                          {actorSortBy !== 'episodes' && (
                            <div className="period-stat">
                              <span className="stat-type">Episodes:</span>
                              <span>{actor.episodeCount}</span>
                            </div>
                          )}
                          {actorSortBy !== 'series' && (
                            <div className="period-stat">
                              <span className="stat-type">Series:</span>
                              <span>{actor.seriesCount}</span>
                            </div>
                          )}
                        </div>
                        {actor.series && actor.series.length > 0 && actorSortBy === 'series' && (
                          <div className="collection-shows">
                            <h4>Series Appeared In:</h4>
                            <div className="shows-list">
                              {actor.series.map((series, seriesIndex) => (
                                <span key={seriesIndex} className="show-tag">{series}</span>
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
            <h3>Loading TV Statistics...</h3>
          </div>
        </div>
      )}
    </div>
  );
};

export default TVTab;
