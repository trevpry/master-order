import React, { useState } from 'react';

const CourseAIAssignment = ({ 
  course, 
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
  const [isCreatingEvents, setIsCreatingEvents] = useState(false);
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  const formatEventLine = (event) => {
    const title = event?.title || 'Untitled Event';
    const start = event?.startDate || 'Unknown Start';
    const end = event?.endDate || 'Ongoing';
    const category = event?.category || 'Uncategorized';
    return `- "${title}" (${start} - ${end}) - Category: ${category}`;
  };

  const formatCategoryLine = (category) => {
    if (typeof category === 'string') {
      return `- "${category}"`;
    }

    const name = category?.name || 'Unnamed Category';
    const description = category?.description ? `: ${category.description}` : '';
    return `- "${name}"${description}`;
  };

  const buildEventsCategoriesText = () => {
    const events = Array.isArray(promptData?.events) ? promptData.events : [];
    const categories = Array.isArray(promptData?.categories) ? promptData.categories : [];

    const eventsText = events.length > 0
      ? events.map(formatEventLine).join('\n')
      : 'No existing events';

    const categoriesText = categories.length > 0
      ? categories.map(formatCategoryLine).join('\n')
      : 'No available categories';

    return [
      `Course: ${course?.title || 'Unknown Course'}`,
      `Generated: ${new Date().toISOString()}`,
      '',
      'EXISTING HISTORICAL EVENTS:',
      eventsText,
      '',
      'AVAILABLE CATEGORIES:',
      categoriesText,
      ''
    ].join('\n');
  };

  const buildPromptWithoutEventsAndCategories = (fullPrompt) => {
    const prompt = String(fullPrompt || '');
    if (!prompt) return '';

    const eventsMarker = 'EXISTING HISTORICAL EVENTS:';
    const categoriesMarker = 'AVAILABLE CATEGORIES:';
    const analysisMarker = 'ANALYSIS REQUIREMENTS:';

    const eventsIndex = prompt.indexOf(eventsMarker);
    const categoriesIndex = prompt.indexOf(categoriesMarker);
    const analysisIndex = prompt.indexOf(analysisMarker);

    if (eventsIndex === -1 || categoriesIndex === -1 || analysisIndex === -1) {
      return prompt;
    }

    const before = prompt.slice(0, eventsIndex).trimEnd();
    const after = prompt.slice(analysisIndex).trimStart();

    return [
      before,
      'EXISTING HISTORICAL EVENTS and AVAILABLE CATEGORIES were exported to a separate text file.',
      '',
      after
    ].join('\n\n').trim();
  };

  const sanitizeFileName = (name) => {
    return String(name || 'course-analysis')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'course-analysis';
  };

  const downloadTextFile = (filename, textContent) => {
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  };

  const copyTextToClipboard = async (text) => {
    const value = String(text || '');
    if (!value) return false;

    // Preferred path: async clipboard API (requires secure context/permissions)
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch (error) {
        console.warn('Clipboard API failed, falling back to execCommand copy:', error?.message || error);
      }
    }

    // Fallback for production browsers/environments with blocked clipboard API.
    try {
      const textArea = document.createElement('textarea');
      textArea.value = value;
      textArea.setAttribute('readonly', '');
      textArea.style.position = 'fixed';
      textArea.style.top = '-9999px';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textArea);
      return copied;
    } catch (error) {
      console.error('Fallback clipboard copy failed:', error);
      return false;
    }
  };

  const handleAnalyzeCourse = async () => {
    if (!course?.id) {
      setError('No course ID available for analysis');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAiResult(null);
    setShowResult(false);

    try {
      // Fetch the prompt data instead of running the analysis
      const response = await fetch(`/api/courses/${course.id}/ai-analyze?preview=true`, {
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
      console.error('Course prompt generation error:', error);
      setError(error.message || 'Failed to generate AI prompt for course');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCallGeminiAPI = async () => {
    if (!course?.id) {
      setError('No course ID available for analysis');
      return;
    }

    setIsCallingAI(true);
    setError(null);
    setShowPromptModal(false);

    try {
      // Make the actual AI call without preview parameter
      const response = await fetch(`/api/courses/${course.id}/ai-analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to analyze course: ${response.statusText}`);
      }

      const result = await response.json();
      setAiResponse(result.data);
      setShowAIResult(true);

    } catch (error) {
      console.error('Course AI analysis error:', error);
      setError(error.message || 'Failed to analyze course with AI');
    } finally {
      setIsCallingAI(false);
    }
  };

  const handleAssignLecturesToEvents = async () => {
    if (!aiResponse?.suggestions || isCreatingEvents) return;

    console.log('🚀 Starting event assignment for course:', course.id);

    try {
      setIsCreatingEvents(true);
      setError(null);
      
      const response = await fetch(`/api/courses/${course.id}/ai-assign-lectures`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId: course.id,
          suggestions: aiResponse.suggestions
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to assign lectures: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Course lecture assignment successful:', result);
      
      setShowAIResult(false);
      setAiResponse(null);
      
      // Notify parent component to refresh data
      if (onAssignToEvent) {
        onAssignToEvent(course.id, result.data);
      }
    } catch (error) {
      console.error('Course assignment error:', error);
      setError(error.message || 'Failed to assign course lectures to events');
    } finally {
      setIsCreatingEvents(false);
    }
  };

  const handleCopyPrompt = async () => {
    if (!promptData?.fullPrompt) return;
    
    try {
      const contextText = buildEventsCategoriesText();
      const promptWithoutEventsAndCategories = buildPromptWithoutEventsAndCategories(promptData.fullPrompt);
      const safeCourseTitle = sanitizeFileName(course?.title);
      const contextFileName = `${safeCourseTitle}-events-categories-context.txt`;

      // Copy first while still in the direct button interaction context.
      const copied = await copyTextToClipboard(promptWithoutEventsAndCategories);
      if (!copied) {
        setError('Could not copy prompt to clipboard in this browser/environment.');
      }

      downloadTextFile(contextFileName, contextText);
      console.log('Course AI prompt copied to clipboard and context file downloaded');
    } catch (error) {
      console.error('Failed to copy course prompt:', error);
      setError('Failed to copy prompt and download context file');
    }
  };

  const handleJsonImport = () => {
    setShowPromptModal(false);
    setShowJsonImport(true);
  };

  const handleProcessImportedJson = async () => {
    if (!jsonInput.trim()) {
      setError('Please enter valid JSON data');
      return;
    }

    try {
      console.log('📥 Attempting to parse imported JSON...');
      const parsedData = JSON.parse(jsonInput);
      console.log('✅ JSON parsed successfully:', parsedData);
      
      // Validate the structure
      if (!parsedData.suggestions || !Array.isArray(parsedData.suggestions)) {
        setError('Invalid JSON structure. Expected an object with a "suggestions" array.');
        console.error('❌ Invalid structure:', parsedData);
        return;
      }
      
      if (parsedData.suggestions.length === 0) {
        setError('No suggestions found in the imported JSON.');
        return;
      }
      
      console.log(`✅ Found ${parsedData.suggestions.length} suggestions`);
      setAiResponse(parsedData);
      setShowJsonImport(false);
      setShowAIResult(true);
      setError(null);
    } catch (error) {
      console.error('❌ JSON parse error:', error);
      setError(`Invalid JSON format: ${error.message}`);
    }
  };

  const handleCancelJsonImport = () => {
    setShowJsonImport(false);
    setJsonInput('');
    setShowPromptModal(true);
  };

  return (
    <div className={`course-ai-assignment ${className}`}>
      {/* Main AI Button */}
      <button
        onClick={handleAnalyzeCourse}
        disabled={isAnalyzing}
        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs py-2 px-3 rounded font-medium disabled:bg-gray-400 flex items-center justify-center"
      >
        {isAnalyzing ? (
          <>
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
            Generating Course Analysis...
          </>
        ) : (
          <>
            🤖 AI Course Analysis
          </>
        )}
      </button>

      {/* Error Display */}
      {error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-400 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Prompt Preview Modal */}
      {showPromptModal && promptData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Course AI Analysis Preview</h3>
                <button
                  onClick={() => setShowPromptModal(false)}
                  className="text-white hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="mb-4">
                <h4 className="font-medium text-gray-900 mb-2">Course Information</h4>
                <div className="bg-gray-50 p-3 rounded text-sm">
                  <p><strong>Title:</strong> {course.title}</p>
                  <p><strong>Instructor:</strong> {course.instructor}</p>
                  <p><strong>Category:</strong> {course.category}</p>
                  {course.guidebook && (
                    <p><strong>Guidebook:</strong> Available for analysis</p>
                  )}
                </div>
              </div>

              {promptData.lectureCount && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Course Structure</h4>
                  <div className="bg-blue-50 p-3 rounded text-sm">
                    <p><strong>Total Lectures:</strong> {promptData.lectureCount}</p>
                    <p><strong>Analysis Goal:</strong> Chronologically assign lectures to historical events with guidebook context</p>
                  </div>
                </div>
              )}

              <div className="mb-4">
                <h4 className="font-medium text-gray-900 mb-2">AI Prompt</h4>
                <div className="bg-gray-100 p-3 rounded border text-sm font-mono max-h-96 overflow-y-auto">
                  {promptData.fullPrompt}
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t bg-gray-50 flex gap-3">
              <button
                onClick={handleCallGeminiAPI}
                disabled={isCallingAI}
                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-2 px-4 rounded font-medium disabled:bg-gray-400"
              >
                {isCallingAI ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                    Analyzing Course...
                  </>
                ) : (
                  'Run AI Analysis'
                )}
              </button>
              
              <button
                onClick={handleCopyPrompt}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
              >
                📋 Copy Prompt + Download Context
              </button>
              
              <button
                onClick={handleJsonImport}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
              >
                📥 Import JSON
              </button>
              
              <button
                onClick={() => setShowPromptModal(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JSON Import Modal */}
      {showJsonImport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">Import Course Analysis JSON</h3>
              <p className="text-sm text-gray-600 mt-1">
                Paste the complete JSON response from the AI analysis (must include "suggestions" array)
              </p>
            </div>
            
            <div className="p-4">
              {error && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  <strong>Error:</strong> {error}
                </div>
              )}
              <textarea
                value={jsonInput}
                onChange={(e) => {
                  setJsonInput(e.target.value);
                  setError(null); // Clear error when user types
                }}
                placeholder="Paste your course analysis JSON here..."
                className="w-full h-64 p-3 border border-gray-300 rounded font-mono text-sm"
              />
            </div>
            
            <div className="p-4 border-t flex gap-3">
              <button
                onClick={handleProcessImportedJson}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded font-medium"
              >
                Process JSON
              </button>
              <button
                onClick={handleCancelJsonImport}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Results Modal */}
      {showAIResult && aiResponse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b bg-gradient-to-r from-green-600 to-blue-600 text-white">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Course AI Analysis Results</h3>
                <button
                  onClick={() => setShowAIResult(false)}
                  className="text-white hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-200px)]">
              {aiResponse.suggestions && aiResponse.suggestions.length > 0 ? (
                <>
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">
                      Lecture-to-Event Assignments ({aiResponse.suggestions.length} lectures)
                    </h4>
                    <p className="text-sm text-gray-600 mb-3">
                      The AI has analyzed the course and guidebook content to suggest chronological event assignments:
                    </p>
                  </div>

                  <div className="space-y-3 mb-6">
                    {aiResponse.suggestions.map((suggestion, index) => (
                      <div key={index} className="border rounded-lg p-3 bg-gray-50">
                        <div className="flex justify-between items-start mb-2">
                          <h5 className="font-medium text-gray-900">
                            Lecture {suggestion.lectureNumber}: {suggestion.lectureTitle}
                          </h5>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                              {suggestion.confidence}% confidence
                            </span>
                            {/* Action Type Badge */}
                            {suggestion.action === 'ASSIGN_TO_EXISTING' ? (
                              <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded font-medium">
                                📚 Existing Event
                              </span>
                            ) : suggestion.action === 'CREATE_NEW_EVENT' ? (
                              <span className="text-xs text-purple-700 bg-purple-100 px-2 py-1 rounded font-medium">
                                ✨ New Event
                              </span>
                            ) : (
                              <span className="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded font-medium">
                                ❓ Unknown
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Existing Event Details */}
                        {suggestion.action === 'ASSIGN_TO_EXISTING' && (
                          <div className="bg-green-50 p-3 rounded border border-green-200 mb-2">
                            <div className="text-sm text-gray-700 mb-1">
                              <strong>Assigned Event:</strong> {suggestion.existingEventTitle || suggestion.eventTitle}
                            </div>
                            {suggestion.existingEventCategory && (
                              <div className="text-sm text-gray-700 mb-1">
                                <strong>Category:</strong> {suggestion.existingEventCategory}
                              </div>
                            )}
                            {(suggestion.existingEventStartDate || suggestion.existingEventEndDate) && (
                              <div className="text-sm text-gray-700 mb-1">
                                <strong>Time Period:</strong> {suggestion.existingEventStartDate} - {suggestion.existingEventEndDate}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* New Event Details */}
                        {suggestion.action === 'CREATE_NEW_EVENT' && suggestion.newEventSuggestion && (
                          <div className="bg-purple-50 p-3 rounded border border-purple-200 mb-2">
                            <div className="text-sm text-gray-700 mb-1">
                              <strong>New Event Title:</strong> {suggestion.newEventSuggestion.title}
                            </div>
                            <div className="text-sm text-gray-700 mb-1">
                              <strong>Category:</strong> {suggestion.newEventSuggestion.category}
                            </div>
                            <div className="text-sm text-gray-700 mb-1">
                              <strong>Time Period:</strong> {suggestion.newEventSuggestion.startDate} - {suggestion.newEventSuggestion.endDate}
                            </div>
                            {suggestion.newEventSuggestion.details && (
                              <div className="text-sm text-gray-700">
                                <strong>Details:</strong> {suggestion.newEventSuggestion.details}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Fallback for other formats or missing action */}
                        {!suggestion.action && (
                          <div className="bg-yellow-50 p-3 rounded border border-yellow-200 mb-2">
                            <div className="text-sm text-gray-700 mb-1">
                              <strong>Event:</strong> {suggestion.eventTitle || suggestion.newEventSuggestion?.title}
                            </div>
                            <div className="text-sm text-gray-700 mb-1">
                              <strong>Category:</strong> {suggestion.category || suggestion.newEventSuggestion?.category}
                            </div>
                            <div className="text-sm text-gray-700 mb-1">
                              <strong>Time Period:</strong> {suggestion.startDate || suggestion.newEventSuggestion?.startDate} - {suggestion.endDate || suggestion.newEventSuggestion?.endDate}
                            </div>
                          </div>
                        )}
                        
                        {suggestion.reasoning && (
                          <div className="text-xs text-gray-600 bg-white p-2 rounded border">
                            <strong>AI Reasoning:</strong> {suggestion.reasoning}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600">No course analysis suggestions available.</p>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t bg-gray-50 flex gap-3">
              {aiResponse.suggestions && aiResponse.suggestions.length > 0 && (
                <button
                  onClick={handleAssignLecturesToEvents}
                  disabled={isCreatingEvents}
                  className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white py-2 px-4 rounded font-medium disabled:bg-gray-400"
                >
                  {isCreatingEvents ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                      Assigning Lectures to Events...
                    </>
                  ) : (
                    'Apply All Assignments'
                  )}
                </button>
              )}
              
              <button
                onClick={() => setShowAIResult(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseAIAssignment;