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
  const [showAIResult, setShowAIResult] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);
  const [isCallingAI, setIsCallingAI] = useState(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

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
      setPromptData(result.data);
      setShowPromptModal(true);

    } catch (error) {
      console.error('Prompt generation error:', error);
      setError(error.message || 'Failed to generate AI prompt');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCallGeminiAPI = async () => {
    if (!video?.id) {
      setError('No video ID available for analysis');
      return;
    }

    setIsCallingAI(true);
    setError(null);
    setShowPromptModal(false);

    try {
      // Make the actual AI call without preview parameter
      const response = await fetch(`/api/history-plus/ai/categorize-video/${video.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to analyze video: ${response.statusText}`);
      }

      const result = await response.json();
      setAiResponse(result.data);
      setShowAIResult(true);

    } catch (error) {
      console.error('AI analysis error:', error);
      setError(error.message || 'Failed to analyze video with AI');
    } finally {
      setIsCallingAI(false);
    }
  };

  const handleAssignToExistingEvent = async () => {
    if (!aiResponse?.suggestion?.existingEventTitle) return;

    try {
      // Get all events to find the ID by title
      const eventsResponse = await fetch('/api/history-plus/events');
      if (!eventsResponse.ok) {
        throw new Error('Failed to fetch events');
      }
      
      const eventsResult = await eventsResponse.json();
      const events = eventsResult.data || eventsResult;
      const targetEvent = events.find(event => event.title === aiResponse.suggestion.existingEventTitle);
      
      if (!targetEvent) {
        setError('Could not find the specified event');
        return;
      }

      const response = await fetch('/api/history-plus/ai/assign-video-to-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: video.id,
          eventId: targetEvent.id
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to assign video: ${response.statusText}`);
      }

      setShowAIResult(false);
      setAiResponse(null);
      // Refresh parent component if needed
      if (onAssignToEvent) {
        onAssignToEvent(video.id, targetEvent.id);
      }
    } catch (error) {
      console.error('Assignment error:', error);
      setError(error.message || 'Failed to assign video to event');
    }
  };

  const handleCreateNewEvent = async () => {
    if (!aiResponse?.suggestion?.newEventSuggestion || isCreatingEvent) return;

    console.log('🚀 Starting event creation for video:', video.id);

    try {
      setIsCreatingEvent(true);
      setError(null);
      
      const response = await fetch('/api/history-plus/ai/create-event-for-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: video.id,
          eventData: aiResponse.suggestion.newEventSuggestion
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create event: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Event creation successful:', result);
      
      setShowAIResult(false);
      setAiResponse(null);
      
      // Notify parent component to refresh data (not to create another event!)
      if (onCreateNewEvent) {
        onCreateNewEvent(video.id, result.data.event, { skipApiCall: true });
      }
    } catch (error) {
      console.error('Event creation error:', error);
      setError(error.message || 'Failed to create new event');
    } finally {
      setIsCreatingEvent(false);
    }
  };

  const handleCopyPrompt = async () => {
    if (!promptData?.fullPrompt) return;
    
    try {
      await navigator.clipboard.writeText(promptData.fullPrompt);
      // Could add a temporary success message here
      console.log('AI prompt copied to clipboard');
    } catch (error) {
      console.error('Failed to copy prompt:', error);
      setError('Failed to copy prompt to clipboard');
    }
  };

  const handleJsonImport = () => {
    setShowPromptModal(false);
    setShowJsonImport(true);
  };

  const handleProcessImportedJson = async () => {
    if (!jsonInput.trim()) {
      setError('Please enter valid JSON response');
      return;
    }

    try {
      const parsedJson = JSON.parse(jsonInput.trim());
      
      // Handle both formats: direct Gemini response or wrapped in suggestion object
      let normalizedResponse;
      if (parsedJson.suggestion) {
        // Already in expected format
        normalizedResponse = parsedJson;
      } else if (parsedJson.action) {
        // Direct Gemini format - wrap it in a suggestion object
        normalizedResponse = {
          suggestion: {
            action: parsedJson.action,
            confidence: parsedJson.confidence,
            reasoning: parsedJson.reasoning,
            existingEventTitle: parsedJson.existingEventTitle,
            newEventSuggestion: parsedJson.newEventSuggestion,
            alternativeAction: parsedJson.alternativeAction
          }
        };
      } else {
        throw new Error('Invalid JSON format: missing action field');
      }
      
      // Set the AI response as if it came from the API
      setAiResponse(normalizedResponse);
      setShowJsonImport(false);
      setJsonInput('');
      setShowAIResult(true);

    } catch (error) {
      console.error('JSON import error:', error);
      setError(error.message || 'Failed to parse JSON response');
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

  const isUnassignedVideo = video?.url && !video?.eventId;

  if (!isUnassignedVideo) {
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

      {isCallingAI && (
        <div className="flex items-center gap-2 text-sm text-green-700">
          <div className="animate-spin h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full"></div>
          <span>Calling Gemini AI for analysis...</span>
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
            
            <div className="p-4 border-t border-gray-200 flex justify-between items-center">
              <div className="flex gap-3">
                <button
                  onClick={handleCopyPrompt}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  📋 Copy AI Prompt
                </button>
                <button
                  onClick={handleJsonImport}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                >
                  📥 Import JSON
                </button>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPromptModal(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={handleCallGeminiAPI}
                  disabled={isCallingAI}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCallingAI ? '🤔 Analyzing...' : '🚀 Call Gemini API'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Result Modal */}
      {showAIResult && aiResponse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">🤖 AI Analysis Result</h3>
              <button
                onClick={() => setShowAIResult(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                <div className="bg-blue-50 p-3 rounded border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">📊 Analysis Summary</h4>
                  <div className="text-sm space-y-2">
                    <div><strong>Action:</strong> <span className="font-mono bg-gray-100 px-2 py-1 rounded">{aiResponse.suggestion?.action}</span></div>
                    <div><strong>Confidence:</strong> {Math.round((aiResponse.suggestion?.confidence || 0) * 100)}%</div>
                    <div><strong>Reasoning:</strong> {aiResponse.suggestion?.reasoning}</div>
                  </div>
                </div>

                {aiResponse.suggestion?.action === 'ASSIGN_TO_EXISTING' && aiResponse.suggestion?.existingEventTitle && (
                  <div className="bg-green-50 p-3 rounded border border-green-200">
                    <h4 className="font-medium text-green-900 mb-2">📚 Suggested Existing Event</h4>
                    <div className="text-sm">
                      <strong>Event:</strong> {aiResponse.suggestion.existingEventTitle}
                    </div>
                  </div>
                )}

                {aiResponse.suggestion?.action === 'CREATE_NEW_EVENT' && aiResponse.suggestion?.newEventSuggestion && (
                  <div className="bg-purple-50 p-3 rounded border border-purple-200">
                    <h4 className="font-medium text-purple-900 mb-2">✨ Suggested New Event</h4>
                    <div className="text-sm space-y-1">
                      <div><strong>Title:</strong> {aiResponse.suggestion.newEventSuggestion.title}</div>
                      <div><strong>Start Date:</strong> {aiResponse.suggestion.newEventSuggestion.startDate}</div>
                      {aiResponse.suggestion.newEventSuggestion.endDate && (
                        <div><strong>End Date:</strong> {aiResponse.suggestion.newEventSuggestion.endDate}</div>
                      )}
                      <div><strong>Category:</strong> {aiResponse.suggestion.newEventSuggestion.category}</div>
                      {aiResponse.suggestion.newEventSuggestion.details && (
                        <div><strong>Details:</strong> {aiResponse.suggestion.newEventSuggestion.details}</div>
                      )}
                    </div>
                  </div>
                )}

                {aiResponse.suggestion?.alternativeAction && (
                  <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                    <h4 className="font-medium text-yellow-900 mb-2">💡 Alternative Suggestion</h4>
                    <div className="text-sm">
                      {aiResponse.suggestion.alternativeAction}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowAIResult(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
              {aiResponse.suggestion?.action === 'ASSIGN_TO_EXISTING' && (
                <button
                  onClick={handleAssignToExistingEvent}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  ✅ Assign to Event
                </button>
              )}
              {aiResponse.suggestion?.action === 'CREATE_NEW_EVENT' && (
                <button
                  onClick={handleCreateNewEvent}
                  disabled={isCreatingEvent}
                  className={`px-4 py-2 text-white rounded transition-colors ${
                    isCreatingEvent 
                      ? 'bg-purple-400 cursor-not-allowed' 
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  {isCreatingEvent ? '⏳ Creating Event...' : '✨ Create New Event'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* JSON Import Modal */}
      {showJsonImport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">📥 Import AI JSON Response</h3>
              <button
                onClick={() => setShowJsonImport(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            
            <div className="flex-1 p-4">
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  <p className="mb-2">Paste the JSON response from Gemini AI here:</p>
                  <div className="bg-blue-50 p-3 rounded border border-blue-200">
                    <h4 className="font-medium text-blue-900 mb-2">Expected JSON Format (Direct from Gemini):</h4>
                    <pre className="text-xs font-mono whitespace-pre-wrap text-blue-800">
{`{
  "action": "ASSIGN_TO_EXISTING" | "CREATE_NEW_EVENT" | "UNCERTAIN",
  "confidence": 0.95,
  "reasoning": "Analysis explanation...",
  "existingEventTitle": "Event Name", // for ASSIGN_TO_EXISTING
  "newEventSuggestion": { // for CREATE_NEW_EVENT
    "title": "German Rearmament under the Weimar Republic",
    "startDate": "1918-11-11",
    "endDate": "1933-01-30",
    "category": "Modern History 2",
    "details": "Event details..."
  },
  "alternativeAction": null
}`}
                    </pre>
                  </div>
                </div>
                
                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder="Paste your Gemini AI JSON response here..."
                  className="w-full h-64 p-3 border border-gray-300 rounded font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowJsonImport(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleProcessImportedJson}
                disabled={!jsonInput.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                🚀 Process JSON
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