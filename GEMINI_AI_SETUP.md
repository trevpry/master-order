# Gemini AI Integration Guide

## Overview
Eddie Life Management now includes AI-powered event categorization using Google's Gemini AI. This feature automatically analyzes YouTube videos associated with historical events and suggests appropriate categories.

## Features
- 🤖 **AI Event Categorization**: Automatically categorize unassigned events based on their YouTube videos
- 📊 **Confidence Scoring**: Get confidence levels for AI suggestions (High/Medium/Low)  
- 🎯 **Smart Detection**: Only shows AI categorization for events that need it (unassigned category + YouTube videos)
- 🔄 **Easy Application**: One-click application of suggested categories
- 📋 **Detailed Analysis**: View reasoning and alternative suggestions

## Setup Instructions

### 1. Get a Gemini API Key
1. Visit [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

### 2. Configure Environment Variables
Add your API key to your environment configuration:

**For Development (.env file):**
```bash
# Gemini AI Configuration
GEMINI_API_KEY=your-actual-api-key-here
```

**For Production/Docker:**
```bash
# Add to your docker-compose.yml or production environment
GEMINI_API_KEY=your-actual-api-key-here
```

### 3. Restart the Server
After adding the API key, restart your server to load the new configuration:
```bash
npm run dev
# or for production
npm start
```

## How to Use

### Automatic Detection
The AI categorization feature automatically appears on event cards that meet these criteria:
- Event has an unassigned category (Unassigned, General, Uncategorized, or empty)
- Event has at least one YouTube video associated with it

### Using AI Categorization
1. **Navigate to History Plus** → Events
2. **Look for the 🤖 AI Categorize button** on eligible event cards
3. **Click the button** to analyze the event's YouTube content
4. **Review the suggestion** including:
   - Suggested category
   - Confidence level (High/Medium/Low)
   - AI reasoning
   - Alternative suggestions
5. **Apply the category** by clicking "Apply Category" if you agree

### Understanding Confidence Levels
- **High Confidence (80%+)**: AI is very sure about the categorization
- **Medium Confidence (60-79%)**: AI has a good guess but manual review recommended
- **Low Confidence (<60%)**: AI is uncertain, manual categorization recommended

## API Endpoints

### Event Categorization
```
POST /api/history-plus/ai/categorize-event/:eventId
```
Analyzes an event and suggests a category based on its YouTube videos.

### YouTube URL Analysis
```
POST /api/history-plus/ai/categorize-youtube
Body: { "youtubeUrl": "https://youtube.com/watch?v=..." }
```
Directly analyzes a YouTube URL for categorization.

### Service Status
```
GET /api/history-plus/ai/status
```
Check if the AI service is properly configured and available.

## Troubleshooting

### "AI categorization service is not available"
- Check that `GEMINI_API_KEY` is set in your environment variables
- Verify your API key is valid and active
- Restart the server after adding the API key

### No AI Categorize Button Appears
- Ensure the event has an unassigned category (empty, "Unassigned", etc.)
- Verify the event has at least one YouTube video
- Check that the server has the AI service properly initialized

### Low Confidence Suggestions
- The AI may not have enough context from the YouTube URL alone
- Consider adding more descriptive video titles or content
- Manual categorization may be more appropriate for unclear content

### Rate Limiting
- Gemini API has rate limits for free tier usage
- If you hit limits, wait or consider upgrading your API plan
- The service will show error messages if rate limited

## Technical Details

### Model Used
- **Gemini 2.5 Flash**: Fast, efficient model optimized for categorization tasks
- **Low Temperature (0.1)**: Ensures consistent, deterministic categorization
- **Structured Output**: Returns JSON with category, confidence, and reasoning

### Data Privacy
- Only YouTube URLs are sent to Google's API
- No personal data or event details are transmitted
- AI responses are not stored permanently

### Performance
- Average response time: 2-4 seconds per categorization
- Cached category lists for faster processing
- Graceful error handling with fallback options

## Support
If you encounter issues with the AI categorization feature:
1. Check the browser console for error messages
2. Verify your API key configuration
3. Test the service status endpoint
4. Review the server logs for detailed error information

The AI categorization feature is optional and the app works fully without it if you prefer manual categorization.