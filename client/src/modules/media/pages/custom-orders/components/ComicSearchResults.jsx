import React, { useState } from 'react';
import Button from '../../../../../shared/components/Button';

const ComicSearchResults = ({ 
  comicSearchResults, 
  comicFormData,
  onSelectComic, 
  reselectingItem,
  onSelectAllComics
}) => {
  const [isLoadingAll, setIsLoadingAll] = useState({});

  if (comicSearchResults.length === 0) {
    return null;
  }

  const handleAddAll = async (series) => {
    setIsLoadingAll(prev => ({ ...prev, [series.series.id]: true }));
    try {
      if (onSelectAllComics) {
        await onSelectAllComics(series);
      }
    } finally {
      setIsLoadingAll(prev => ({ ...prev, [series.series.id]: false }));
    }
  };

  return (
    <div className="comic-search-results">
      <h4>Select Comic Series</h4>
      <p className="search-note">
        Found {comicSearchResults.length} series that have issue #{comicFormData.issue}. Select the correct series:
      </p>
      <div className="comic-results-list">
        {comicSearchResults.map((series, index) => (
          <div key={index} className="comic-result-item">
            <div className="comic-info">
              {series.coverUrl && (
                <div className="comic-cover-container">
                  <img 
                    src={series.coverUrl} 
                    alt={`Cover of ${series.name} #${comicFormData.issue}`} 
                    className="comic-cover-small"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div className="comic-details">
                <h5>
                  {series.series.name}
                  {series.isFuzzyMatch && (
                    <span className="fuzzy-match-indicator" title={`${Math.round(series.similarity * 100)}% similarity match`}>
                      ~{Math.round(series.similarity * 100)}%
                    </span>
                  )}
                </h5>
                <p className="comic-publisher">
                  Publisher: {series.series.publisher?.name || 'Unknown'}
                </p>
                {series.series.start_year && (
                  <p className="comic-year">Started: {series.series.start_year}</p>
                )}
                {series.series.count_of_issues && (
                  <p className="comic-issues">Total Issues: {series.series.count_of_issues}</p>
                )}
                {series.issueName && (
                  <p className="comic-issue-name">Issue #{comicFormData.issue}: {series.issueName}</p>
                )}
              </div>
            </div>
            <div className="comic-result-actions">
              <Button
                onClick={() => onSelectComic(series)}
                className="primary"
                size="small"
              >
                {reselectingItem ? 'Re-select This Comic' : 'Add This Comic'}
              </Button>
              {series.series.count_of_issues && !reselectingItem && (
                <Button
                  onClick={() => handleAddAll(series)}
                  className="secondary"
                  size="small"
                  disabled={isLoadingAll[series.series.id]}
                  title={`Add all ${series.series.count_of_issues} issues from this series`}
                >
                  {isLoadingAll[series.series.id] ? '⏳ Adding All...' : `Add All ${series.series.count_of_issues} Issues`}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ComicSearchResults;
