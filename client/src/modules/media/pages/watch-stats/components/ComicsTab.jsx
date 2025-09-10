import React from 'react';
import StatItem from './shared/StatItem';
import ToggleButtonGroup from './shared/ToggleButtonGroup';

const ComicsTab = ({ comicStats, formatDateWithTimezone, publisherSortBy, setPublisherSortBy, characterSortBy, setCharacterSortBy }) => {
  return (
    <div className="tab-content">
      {comicStats ? (
        <>
          {/* Overall Comic Statistics */}
          <div className="stats-card">
            <h2>📖 Comic Statistics</h2>
            <div className="stats-grid">
              <StatItem 
                label="Total Comics" 
                value={comicStats.totalStats?.totalComics || 0} 
              />
              <StatItem 
                label="Total Read Time" 
                value={comicStats.totalStats?.totalComicReadTimeFormatted || '0 minutes'} 
              />
              <StatItem 
                label="Custom Orders" 
                value={comicStats.totalStats?.uniqueCustomOrders || 0} 
              />
              <StatItem 
                label="Average Read Time" 
                value={comicStats.totalStats?.totalComics > 0 
                  ? Math.round((comicStats.totalStats?.totalComicReadTime || 0) / comicStats.totalStats.totalComics) + ' min' 
                  : '0 min'
                } 
              />
            </div>
          </div>

          {/* Publisher Breakdown */}
          {comicStats.totalStats?.publisherBreakdown && (
            <div className="stats-card">
              <div className="breakdown-header">
                <h2>📚 Publishers</h2>
                <ToggleButtonGroup
                  options={[
                    { value: 'readtime', label: 'By Read Time' },
                    { value: 'comics', label: 'By Comic Count' }
                  ]}
                  activeValue={publisherSortBy}
                  onChange={setPublisherSortBy}
                />
              </div>
              {(() => {
                const getPublisherData = () => {
                  switch (publisherSortBy) {
                    case 'readtime':
                      return comicStats.totalStats.publisherBreakdown.byReadTime || [];
                    case 'comics':
                      return comicStats.totalStats.publisherBreakdown.byComicCount || [];
                    default:
                      return [];
                  }
                };
                
                const publisherData = getPublisherData();
                
                return publisherData.length > 0 ? (
                  <div className="time-breakdown">
                    {publisherData.map((publisher, index) => (
                      <div key={`comic-${publisherSortBy}-${index}`} className="time-period">
                        <div className="period-header">
                          <div className="actor-info">
                            <span className="actor-rank">#{index + 1}</span>
                            <h3>{publisher.name}</h3>
                          </div>
                          <span className="period-total">
                            {publisherSortBy === 'readtime' && publisher.totalReadTimeFormatted}
                            {publisherSortBy === 'comics' && `${publisher.comicCount} comics`}
                          </span>
                        </div>
                        <div className="period-stats">
                          {publisherSortBy !== 'readtime' && (
                            <div className="period-stat">
                              <span className="stat-type">Read Time:</span>
                              <span>{publisher.totalReadTimeFormatted}</span>
                            </div>
                          )}
                          {publisherSortBy !== 'comics' && (
                            <div className="period-stat">
                              <span className="stat-type">Comics:</span>
                              <span>{publisher.comicCount}</span>
                            </div>
                          )}
                          {publisher.averageReadTime > 0 && (
                            <div className="period-stat">
                              <span className="stat-type">Avg Read Time:</span>
                              <span>{publisher.averageReadTime} min</span>
                            </div>
                          )}
                        </div>
                        {publisher.comics && publisher.comics.length > 0 && publisherSortBy === 'comics' && (
                          <div className="collection-shows">
                            <h4>Comics Read:</h4>
                            <div className="shows-list">
                              {publisher.comics.map((comic, comicIndex) => (
                                <span key={comicIndex} className="show-tag">{comic.title}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#8b949e' }}>
                    <p>No publisher data available</p>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Character Breakdown */}
          {comicStats.totalStats?.characterBreakdown && (
            <div className="stats-card">
              <div className="breakdown-header">
                <h2>🦸 Top Characters</h2>
                <ToggleButtonGroup
                  options={[
                    { value: 'readtime', label: 'By Read Time' },
                    { value: 'comics', label: 'By Comic Count' }
                  ]}
                  activeValue={characterSortBy}
                  onChange={setCharacterSortBy}
                />
              </div>
              {(() => {
                const getCharacterData = () => {
                  switch (characterSortBy) {
                    case 'readtime':
                      return comicStats.totalStats.characterBreakdown.byReadTime || [];
                    case 'comics':
                      return comicStats.totalStats.characterBreakdown.byComicCount || [];
                    default:
                      return [];
                  }
                };
                
                const characterData = getCharacterData();
                
                return characterData.length > 0 ? (
                  <div className="time-breakdown">
                    {characterData.map((character, index) => (
                      <div key={`comic-character-${characterSortBy}-${index}`} className="time-period">
                        <div className="period-header">
                          <div className="actor-info">
                            <span className="actor-rank">#{index + 1}</span>
                            <h3>{character.name}</h3>
                          </div>
                          <span className="period-total">
                            {characterSortBy === 'readtime' && character.totalReadTimeFormatted}
                            {characterSortBy === 'comics' && `${character.comicCount} comics`}
                          </span>
                        </div>
                        <div className="period-stats">
                          {characterSortBy !== 'readtime' && (
                            <div className="period-stat">
                              <span className="stat-type">Read Time:</span>
                              <span>{character.totalReadTimeFormatted}</span>
                            </div>
                          )}
                          {characterSortBy !== 'comics' && (
                            <div className="period-stat">
                              <span className="stat-type">Comics:</span>
                              <span>{character.comicCount}</span>
                            </div>
                          )}
                          {character.averageReadTime > 0 && (
                            <div className="period-stat">
                              <span className="stat-type">Avg Read Time:</span>
                              <span>{character.averageReadTime} min</span>
                            </div>
                          )}
                        </div>
                        {character.comics && character.comics.length > 0 && characterSortBy === 'comics' && (
                          <div className="collection-shows">
                            <h4>Comics with {character.name}:</h4>
                            <div className="shows-list">
                              {character.comics.map((comic, comicIndex) => (
                                <span key={comicIndex} className="show-tag">
                                  {comic.series} #{comic.issue} ({comic.publisher})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#8b949e' }}>
                    <p>No character data available</p>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Recent Comics */}
          {comicStats.logs && comicStats.logs.length > 0 && (
            <div className="stats-card">
              <h2>Recent Comics</h2>
              <div className="recent-activity">
                {comicStats.logs
                  .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
                  .slice(0, 10)
                  .map((log, index) => (
                  <div key={index} className="activity-item">
                    <div className="activity-info">
                      <div className="activity-title">
                        <span className="title">{log.title}</span>
                      </div>
                      <div className="activity-meta">
                        <span className="media-type">COMIC</span>
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
        </>
      ) : (
        <div className="stats-card">
          <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>
            <h3>Loading Comic Statistics...</h3>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComicsTab;
