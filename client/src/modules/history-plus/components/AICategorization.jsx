import React, { useState } from 'react';
import LoadingSpinner from '../../../components/LoadingSpinner';
import './AICategorization.css';

/**
 * AICategorization Component - Reusable AI categorization interface
 * Provides AI-powered categorization for YouTube content and events
 */
const AICategorization = ({ 
  variant = 'youtube', // 'youtube' | 'event'
  youtubeUrl = '',
  eventId = null,
  eventTitle = '',
  currentCategory = '',
  onSuccess = () => {},
  onError = () => {},
  disabled = false,
  className = ''
}) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleCategorize = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let response;
      
      if (variant === 'youtube' && youtubeUrl) {
        response = await fetch('/api/history-plus/ai/categorize-youtube', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ youtubeUrl })
        });
      } else if (variant === 'event' && eventId) {
        response = await fetch(`/api/history-plus/ai/categorize-event/${eventId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            autoApply: false, // Don't auto-apply, let user decide
            confidenceThreshold: 0.7 
          })
        });
      } else {
        throw new Error('Invalid configuration for AI categorization');
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'AI categorization failed');
      }

      const data = await response.json();
      setResult(data.data);
      onSuccess(data.data);

    } catch (err) {
      console.error('AI categorization error:', err);
      setError(err.message);
      onError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCategory = async () => {
    if (!result?.categorization?.suggestedCategoryId || variant !== 'event') {
      return;
    }

    try {
      setLoading(true);
      
      // Update the event with the suggested category
      const response = await fetch(`/api/history-plus/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: result.categorization.suggestedCategory,
          categoryId: result.categorization.suggestedCategoryId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to apply category');
      }

      // Trigger success callback with updated data
      onSuccess({ 
        ...result, 
        applied: true,
        appliedCategory: result.categorization.suggestedCategory
      });

    } catch (err) {
      console.error('Apply category error:', err);
      setError(err.message);
      onError(err);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'confidence-high';
    if (confidence >= 0.6) return 'confidence-medium';
    return 'confidence-low';
  };

  const getConfidenceText = (confidence) => {
    if (confidence >= 0.8) return 'High Confidence';
    if (confidence >= 0.6) return 'Medium Confidence';
    return 'Low Confidence';
  };

  return (
    <div className={`ai-categorization ${className}`}>
      {/* Action Button */}
      <button
        onClick={handleCategorize}
        disabled={disabled || loading}
        className="ai-categorize-button"
        title={variant === 'youtube' ? 'Analyze YouTube URL with AI' : 'Categorize event with AI'}
      >
        {loading ? (
          <>
            <div className="button-spinner"></div>
            Analyzing...
          </>
        ) : (
          <>
            🤖 AI Categorize
          </>
        )}
      </button>

      {/* Error Display */}
      {error && (
        <div className="ai-error">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
          <button 
            className="error-dismiss"
            onClick={() => setError(null)}
            title="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Results Display */}
      {result && result.categorization && (
        <div className="ai-result">
          <div className="result-header">
            <div className="result-title">
              <span className="ai-icon">🤖</span>
              <span>AI Suggestion</span>
            </div>
            <div className={`confidence-badge ${getConfidenceColor(result.categorization.confidence)}`}>
              {getConfidenceText(result.categorization.confidence)}
              <span className="confidence-score">
                ({Math.round(result.categorization.confidence * 100)}%)
              </span>
            </div>
          </div>

          <div className="suggestion-content">
            <div className="suggested-category">
              <strong>Suggested Category:</strong>
              <span className="category-name">{result.categorization.suggestedCategory}</span>
              {variant === 'event' && currentCategory && currentCategory !== result.categorization.suggestedCategory && (
                <span className="category-change">
                  (was: {currentCategory})
                </span>
              )}
            </div>

            <div className="reasoning">
              <strong>Reasoning:</strong>
              <span className="reasoning-text">{result.categorization.reasoning}</span>
            </div>

            {result.categorization.alternativeCategory && (
              <div className="alternative">
                <strong>Alternative:</strong>
                <span className="alternative-category">{result.categorization.alternativeCategory}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="result-actions">
            {variant === 'event' && result.categorization.suggestedCategoryId && (
              <button
                onClick={handleApplyCategory}
                disabled={loading}
                className="apply-category-button"
                title="Apply the suggested category to this event"
              >
                {loading ? 'Applying...' : 'Apply Category'}
              </button>
            )}

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="toggle-details-button"
              title="Show/hide detailed analysis"
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>

          {/* Detailed Analysis */}
          {showDetails && (
            <div className="analysis-details">
              <h4>Analysis Details</h4>
              {variant === 'youtube' && result.youtubeUrl && (
                <div className="detail-item">
                  <strong>Analyzed URL:</strong>
                  <a href={result.youtubeUrl} target="_blank" rel="noopener noreferrer">
                    {result.youtubeUrl}
                  </a>
                </div>
              )}
              {variant === 'event' && result.event && (
                <div className="detail-item">
                  <strong>Event:</strong>
                  <span>{result.event.title}</span>
                </div>
              )}
              {result.analyzedVideo && (
                <div className="detail-item">
                  <strong>Primary Video:</strong>
                  <a href={result.analyzedVideo.url} target="_blank" rel="noopener noreferrer">
                    {result.analyzedVideo.title || result.analyzedVideo.url}
                  </a>
                </div>
              )}
              <div className="detail-item">
                <strong>Available Categories:</strong>
                <span>{result.availableCategories} categories analyzed</span>
              </div>
              {result.categorization.success === false && (
                <div className="detail-item warning">
                  <strong>Note:</strong>
                  <span>AI response parsing had issues. Manual verification recommended.</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AICategorization;