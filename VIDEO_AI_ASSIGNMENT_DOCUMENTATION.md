# Video AI Assignment Feature Documentation

## Overview
The Video AI Assignment feature extends the Gemini AI integration to help automatically assign unassigned YouTube videos to existing historical events or suggest creating new events based on video content analysis.

## Features

### 🎯 AI-Powered Video Analysis
- **Smart Content Detection**: Analyzes YouTube video URLs, titles, and descriptions
- **Event Matching**: Suggests assignment to existing historical events
- **New Event Creation**: Recommends creating new events for unique content
- **Confidence Scoring**: Provides AI confidence levels (High/Medium/Low)

### 🎛️ User Interface
- **Smart Detection**: Only shows AI buttons for unassigned YouTube videos
- **Three Action Types**:
  - `ASSIGN_TO_EXISTING`: Assign to an existing event
  - `CREATE_NEW_EVENT`: Create a new event for this video
  - `UNCERTAIN`: Manual assignment recommended
- **Interactive Flow**: User-friendly buttons with clear actions and feedback

## API Endpoints

### 1. Analyze Video for Event Assignment
```
POST /api/history-plus/ai/categorize-video/:videoId
```
**Purpose**: Analyze a video and suggest event assignment or new event creation

**Response**:
```json
{
  "action": "ASSIGN_TO_EXISTING" | "CREATE_NEW_EVENT" | "UNCERTAIN",
  "confidence": 0.85,
  "reasoning": "Brief explanation of the decision",
  "existingEvent": {
    "id": 123,
    "title": "Event Title",
    "startDate": "2024-01-01",
    "endDate": "2024-01-31",
    "category": "Category Name"
  },
  "newEventSuggestion": {
    "title": "Suggested Event Title",
    "startDate": "2024-01-01",
    "endDate": null,
    "category": "Category Name",
    "details": "Event description",
    "categoryId": 456
  },
  "alternativeAction": "Alternative suggestion if confidence is medium"
}
```

### 2. Assign Video to Existing Event
```
POST /api/history-plus/ai/assign-video-to-event
```
**Body**:
```json
{
  "videoId": 123,
  "eventId": 456
}
```

### 3. Create New Event for Video
```
POST /api/history-plus/ai/create-event-for-video
```
**Body**:
```json
{
  "videoId": 123,
  "eventSuggestion": {
    "title": "New Event Title",
    "startDate": "2024-01-01",
    "endDate": null,
    "category": "Category Name",
    "details": "Event description",
    "categoryId": 456
  }
}
```

## Implementation Details

### Backend Services

#### GeminiService.js
- **`categorizeVideoForEventAssignment()`**: Main analysis method
- **`buildVideoAssignmentPrompt()`**: Constructs AI prompt with context
- **`parseVideoAssignmentResponse()`**: Validates and processes AI response

Key features:
- Limits events list to 20 items to avoid token limits
- Validates suggested events against available events
- Provides fallback to CREATE_NEW_EVENT if AI suggests unknown event
- Handles error cases gracefully with safe fallbacks

#### Route Handlers (historyPlus.js)
- **Video Analysis**: Fetches video, events, and categories for context
- **Event Assignment**: Updates video with eventId and clears assignLater flag
- **Event Creation**: Creates new event and assigns video automatically

### Frontend Components

#### VideoAIAssignment.jsx
**Reusable component for video AI categorization**

Features:
- Automatic detection of unassigned YouTube videos
- Loading states with spinner animation
- Confidence badges (High/Medium/Low)
- Interactive action buttons
- Error handling and user feedback

#### VideoCard.jsx Integration
- Seamlessly integrated into existing VideoCard component
- Passes through necessary handlers from parent component
- Only displays for eligible videos (unassigned YouTube videos)

#### Videos.jsx Page Integration
- Added `handleAssignToEvent()` and `handleCreateNewEvent()` handlers
- Calls API endpoints and refreshes data on success
- Error handling with user-friendly messages

## AI Prompt Engineering

### Context Provided to AI
1. **Video Information**: YouTube URL, title, description
2. **Available Events**: Up to 20 recent events with dates and categories
3. **Available Categories**: All historical categories with descriptions
4. **Clear Instructions**: Specific format requirements and validation rules

### Response Validation
- **Action Type Validation**: Must be one of three valid options
- **Event Title Matching**: Exact match required for existing events
- **Category Validation**: Must use existing category names
- **Confidence Clamping**: Ensures confidence is between 0.0 and 1.0
- **Fallback Handling**: Safe defaults for parsing errors

## User Workflow

### For Unassigned YouTube Videos:
1. **Detection**: VideoAIAssignment component automatically appears
2. **Analysis**: User clicks "🔍 Analyze Video" button
3. **AI Processing**: Video content is analyzed by Gemini AI
4. **Results Display**: AI shows recommendation with confidence level
5. **User Action**: 
   - **Assign to Existing**: Click "✓ Assign to This Event"
   - **Create New Event**: Click "✨ Create New Event"
   - **Manual Assignment**: Dismiss if uncertain or use traditional assignment

### Example AI Responses:

**High Confidence Assignment**:
```
✅ High Confidence (89%)
AI Analysis: This video discusses the Battle of Gettysburg tactics and fits perfectly with existing Civil War coverage.
Suggested Event: American Civil War (1861-1865)
[✓ Assign to This Event] [Cancel]
```

**New Event Suggestion**:
```
🟡 Medium Confidence (72%)
AI Analysis: This covers a specific historical topic not present in existing events.
Suggested New Event: The Great Chicago Fire (1871-1871) | Category: Natural Disasters
[✨ Create New Event] [Cancel]
```

**Uncertain Case**:
```
🔴 Low Confidence (35%)
AI Analysis: Video content is unclear or doesn't match historical topics well. Manual assignment recommended.
[Dismiss]
```

## Error Handling

### Backend Error Cases
- **Invalid YouTube URL**: Returns 400 error with message
- **Missing Video**: Returns 404 error
- **AI Service Unavailable**: Returns 503 error with configuration message
- **Parsing Errors**: Safe fallback to UNCERTAIN action

### Frontend Error Handling
- **Network Errors**: User-friendly error messages
- **Invalid Responses**: Graceful degradation
- **Loading States**: Clear visual feedback during AI processing
- **Action Failures**: Specific error messages for assignment/creation failures

## Configuration Requirements

### Environment Variables
```bash
GEMINI_API_KEY=your_api_key_here
```

### Dependencies
- **Backend**: `@google/genai` package for Gemini AI integration
- **Frontend**: No additional dependencies beyond existing React setup

## Performance Considerations

- **Token Limits**: Events list limited to 20 items to stay within AI token limits
- **Caching**: AI service maintains connection to avoid initialization overhead
- **Error Recovery**: Graceful handling of AI service unavailability
- **User Feedback**: Immediate loading states to indicate processing

## Future Enhancements

1. **Batch Processing**: Analyze multiple videos simultaneously
2. **Learning Integration**: Train on user corrections to improve suggestions
3. **Category Suggestions**: AI-suggested new categories for events
4. **Video Thumbnails**: Include thumbnail analysis for better context
5. **Channel Analysis**: Consider channel context for better event matching

## Security Considerations

- **API Key Protection**: Gemini API key stored securely in environment variables
- **Input Validation**: All user inputs validated before processing
- **Error Information**: Sensitive error details not exposed to frontend
- **Rate Limiting**: Inherent protection through Gemini API rate limits