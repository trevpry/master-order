import React, { useState } from 'react';

const VideoAIAssignment = ({ 
  video, 
  onAssignToEvent, 
  onCreateNewEvent, 
  className = '' 
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [error, setError] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptData, setPromptData] = useState(null);

  const handleAnalyzeVideo = async () => {
    if (!video?.url) {
      setError('No video URL available for analysis');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAiResult(null);
    setShowResult(false);

    try {
      // Fetch the prompt data instead of running the analysis
      const response = await fetch(`/api/history-plus/ai/categorize-video/${video.id}?preview=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to generate prompt: ${response.statusText}`);
      }

      const result = await response.json();
      setPromptData(result);
      setShowPromptModal(true);

    } catch (error) {
      console.error('Prompt generation error:', error);
      setError(error.message || 'Failed to generate AI prompt');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAssignToExistingEvent = async () => {
    if (!aiResult?.existingEvent) return;

    try {
      await onAssignToEvent(video.id, aiResult.existingEvent.id);
      setShowResult(false);
      setAiResult(null);
    } catch (error) {
      setError('Failed to assign video to event');
    }
  };

  const handleCreateNewEvent = async () => {
    if (!aiResult?.newEventSuggestion) return;

    try {
      await onCreateNewEvent(video.id, aiResult.newEventSuggestion);
      setShowResult(false);
      setAiResult(null);
    } catch (error) {
      setError('Failed to create new event');
    }
  };

  const getConfidenceBadge = (confidence) => {
    if (confidence >= 0.8) {
      return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">High Confidence</span>;
    } else if (confidence >= 0.6) {
      return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">Medium Confidence</span>;
    } else {
      return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">Low Confidence</span>;
    }
  };

  const isUnassignedYouTubeVideo = video?.url?.includes('youtube.com') && !video?.eventId;

  if (!isUnassignedYouTubeVideo) {
    return null;
  }

  return (
    <div className={`mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-blue-900">🤖 AI Event Assignment</h4>
        {!showResult && (
          <button
            onClick={handleAnalyzeVideo}
            disabled={isAnalyzing}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAnalyzing ? '🤔 Generating...' : '�️ Preview AI Prompt'}
          </button>
        )}
      </div>

      {error && (
        <div className="p-2 bg-red-100 border border-red-300 rounded text-red-700 text-sm mb-2">
          ❌ {error}
        </div>
      )}

      {isAnalyzing && (
        <div className="flex items-center gap-2 text-sm text-blue-700">
          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          <span>Generating AI prompt preview...</span>
        </div>
      )}

      {/* Prompt Preview Modal */}
      {showPromptModal && promptData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">🤖 AI Prompt Preview</h3>
              <button
                onClick={() => setShowPromptModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                <div className="bg-blue-50 p-3 rounded border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">📹 Video Information</h4>
                  <div className="text-sm space-y-1">
                    <div><strong>URL:</strong> {promptData.videoUrl}</div>
                    {promptData.videoTitle && <div><strong>Title:</strong> {promptData.videoTitle}</div>}
                    {promptData.videoDescription && <div><strong>Description:</strong> {promptData.videoDescription}</div>}
                  </div>
                </div>

                <div className="bg-green-50 p-3 rounded border border-green-200">
                  <h4 className="font-medium text-green-900 mb-2">📚 Available Events ({promptData.events?.length || 0})</h4>
                  <div className="text-sm max-h-40 overflow-y-auto">
                    {promptData.events?.length > 0 ? (
                      <ul className="space-y-1">
                        {promptData.events.slice(0, 10).map((event, index) => (
                          <li key={index} className="text-gray-700">
                            • "{event.title}" ({event.startDate} - {event.endDate || 'Ongoing'}) - {event.category}
                          </li>
                        ))}
                        {promptData.events.length > 10 && (
                          <li className="text-gray-500 italic">...and {promptData.events.length - 10} more events</li>
                        )}
                      </ul>
                    ) : (
                      <p className="text-gray-500">No events available</p>
                    )}
                  </div>
                </div>

                <div className="bg-purple-50 p-3 rounded border border-purple-200">
                  <h4 className="font-medium text-purple-900 mb-2">🏷️ Available Categories ({promptData.categories?.length || 0})</h4>
                  <div className="text-sm max-h-32 overflow-y-auto">
                    {promptData.categories?.length > 0 ? (
                      <ul className="space-y-1">
                        {promptData.categories.map((category, index) => (
                          <li key={index} className="text-gray-700">
                            • "{category.name}": {category.description || 'Historical category'}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500">No categories available</p>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded border border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-2">🤖 Complete AI Prompt</h4>
                  <div className="bg-white p-3 rounded border font-mono text-xs whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {promptData.fullPrompt}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowPromptModal(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowPromptModal(false);
                  // Here we could add actual AI call in the future
                  setError('AI analysis temporarily disabled - showing prompt preview only');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                🚀 Would Call Gemini API
              </button>
            </div>
          </div>
        </div>
      )}

      {showResult && aiResult && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            {getConfidenceBadge(aiResult.confidence)}
            <span className="text-xs text-gray-600">
              Confidence: {Math.round(aiResult.confidence * 100)}%
            </span>
          </div>

          <div className="text-sm text-gray-700 bg-white p-2 rounded border">
            <strong>AI Analysis:</strong> {aiResult.reasoning}
          </div>

          {aiResult.action === 'ASSIGN_TO_EXISTING' && aiResult.existingEvent && (
            <div className="space-y-2">
              <div className="text-sm">
                <strong>Suggested Event:</strong> {aiResult.existingEvent.title}
                <div className="text-xs text-gray-600 mt-1">
                  {aiResult.existingEvent.startDate} - {aiResult.existingEvent.endDate || 'Ongoing'} | 
                  Category: {aiResult.existingEvent.category}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAssignToExistingEvent}
                  className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  ✓ Assign to This Event
                </button>
                <button
                  onClick={() => setShowResult(false)}
                  className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {aiResult.action === 'CREATE_NEW_EVENT' && aiResult.newEventSuggestion && (
            <div className="space-y-2">
              <div className="text-sm">
                <strong>Suggested New Event:</strong> {aiResult.newEventSuggestion.title}
                <div className="text-xs text-gray-600 mt-1">
                  {aiResult.newEventSuggestion.startDate} - {aiResult.newEventSuggestion.endDate || 'Ongoing'} | 
                  Category: {aiResult.newEventSuggestion.category}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {aiResult.newEventSuggestion.details}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateNewEvent}
                  className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                >
                  ✨ Create New Event
                </button>
                <button
                  onClick={() => setShowResult(false)}
                  className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {aiResult.action === 'UNCERTAIN' && (
            <div className="space-y-2">
              <div className="text-sm text-yellow-700">
                <strong>AI is Uncertain:</strong> Manual assignment recommended
              </div>
              <button
                onClick={() => setShowResult(false)}
                className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Dismiss
              </button>
            </div>
          )}

          {aiResult.alternativeAction && (
            <div className="text-xs text-gray-600 border-t pt-2">
              <strong>Alternative:</strong> {aiResult.alternativeAction}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoAIAssignment;