const { GoogleGenAI } = require('@google/genai');

/**
 * Gemini AI Service - Handles AI categorization and content analysis
 * Uses Google's Gemini AI for automated event categorization based on YouTube URLs
 */
class GeminiService {
  constructor() {
    this.ai = null;
    this.initialized = false;
    this.init();
  }

  /**
   * Initialize the Gemini AI client
   */
  init() {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn('⚠️ GEMINI_API_KEY not found in environment variables. AI categorization features will be disabled.');
        return;
      }

      this.ai = new GoogleGenAI({ apiKey });
      this.initialized = true;
      console.log('✅ Gemini AI Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Gemini AI Service:', error);
      this.initialized = false;
    }
  }

  /**
   * Check if the service is ready to use
   */
  isAvailable() {
    return this.initialized && this.ai;
  }

  /**
   * Analyze a YouTube URL and suggest the most appropriate historical category
   * @param {string} youtubeUrl - The YouTube URL to analyze
   * @param {Array} availableCategories - List of available category objects with {id, name, description}
   * @returns {Promise<Object>} - Analysis result with suggested category and confidence
   */
  async categorizeYouTubeContent(youtubeUrl, availableCategories) {
    if (!this.isAvailable()) {
      throw new Error('Gemini AI Service is not available. Please check your API key configuration.');
    }

    if (!youtubeUrl || !youtubeUrl.includes('youtube.com')) {
      throw new Error('Invalid YouTube URL provided');
    }

    if (!availableCategories || availableCategories.length === 0) {
      throw new Error('No categories available for classification');
    }

    try {
      // Extract video ID from URL for better context
      const videoId = this.extractVideoId(youtubeUrl);
      
      // Build the categorization prompt
      const prompt = this.buildCategorizationPrompt(youtubeUrl, videoId, availableCategories);
      
      // Generate response using the new API
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.1, // Low temperature for consistent categorization
          maxOutputTokens: 1024,
          thinkingConfig: {
            thinkingBudget: 0 // Disable thinking for faster response
          }
        }
      });

      // Parse the structured response
      return this.parseCategorizationResponse(response.text, availableCategories);

    } catch (error) {
      console.error('❌ Error during YouTube content categorization:', error);
      throw new Error(`AI categorization failed: ${error.message}`);
    }
  }

  /**
   * Extract YouTube video ID from URL
   * @param {string} url - YouTube URL
   * @returns {string} - Video ID or empty string if not found
   */
  extractVideoId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return '';
  }

  /**
   * Build the AI prompt for categorization
   * @param {string} youtubeUrl - YouTube URL
   * @param {string} videoId - Extracted video ID
   * @param {Array} categories - Available categories
   * @returns {string} - Formatted prompt
   */
  buildCategorizationPrompt(youtubeUrl, videoId, categories) {
    const categoryList = categories.map(cat => 
      `- "${cat.name}": ${cat.description || 'Historical category'}`
    ).join('\n');

    return `You are an expert historian and content analyst. Your task is to analyze a YouTube video and determine which historical category it belongs to.

YouTube URL: ${youtubeUrl}
${videoId ? `Video ID: ${videoId}` : ''}

Available Categories:
${categoryList}

Based on the URL and any context you can infer, please determine the most appropriate historical category for this content.

Respond ONLY with a valid JSON object in this exact format:
{
  "suggestedCategory": "EXACT_CATEGORY_NAME",
  "confidence": 0.85,
  "reasoning": "Brief explanation of why this category was chosen",
  "alternativeCategory": "SECOND_CHOICE_CATEGORY_NAME"
}

Requirements:
- suggestedCategory MUST be exactly one of the category names from the list above
- confidence should be between 0.0 and 1.0
- reasoning should be 1-2 sentences explaining the choice
- alternativeCategory should be your second choice (optional)
- Return ONLY the JSON object, no additional text`;
  }

  /**
   * Parse the AI response and validate the suggested category
   * @param {string} responseText - Raw AI response
   * @param {Array} availableCategories - Available categories for validation
   * @returns {Object} - Parsed and validated response
   */
  parseCategorizationResponse(responseText, availableCategories) {
    try {
      // Clean the response (remove any markdown or extra text)
      const cleanedText = responseText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanedText);

      // Validate the response structure
      if (!parsed.suggestedCategory || !parsed.confidence || !parsed.reasoning) {
        throw new Error('Invalid response structure from AI');
      }

      // Validate suggested category exists
      const categoryNames = availableCategories.map(cat => cat.name);
      if (!categoryNames.includes(parsed.suggestedCategory)) {
        console.warn('⚠️ AI suggested unknown category, using fallback');
        return {
          suggestedCategory: categoryNames[0], // Fallback to first category
          confidence: 0.3,
          reasoning: 'AI suggested an unknown category, using fallback',
          alternativeCategory: null,
          aiResponse: parsed
        };
      }

      // Find the category object
      const suggestedCategoryObj = availableCategories.find(cat => cat.name === parsed.suggestedCategory);
      const alternativeCategoryObj = parsed.alternativeCategory 
        ? availableCategories.find(cat => cat.name === parsed.alternativeCategory)
        : null;

      return {
        suggestedCategory: parsed.suggestedCategory,
        suggestedCategoryId: suggestedCategoryObj?.id || null,
        confidence: Math.max(0, Math.min(1, parsed.confidence)), // Clamp between 0-1
        reasoning: parsed.reasoning,
        alternativeCategory: parsed.alternativeCategory || null,
        alternativeCategoryId: alternativeCategoryObj?.id || null,
        success: true
      };

    } catch (error) {
      console.error('❌ Failed to parse AI categorization response:', error);
      console.log('Raw response:', responseText);
      
      // Return a safe fallback
      return {
        suggestedCategory: availableCategories[0]?.name || 'Unknown',
        suggestedCategoryId: availableCategories[0]?.id || null,
        confidence: 0.1,
        reasoning: 'Failed to parse AI response, manual categorization recommended',
        alternativeCategory: null,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze a video and suggest event assignment or new event creation
   * @param {string} youtubeUrl - The YouTube URL to analyze
   * @param {string} videoTitle - Video title for context
   * @param {string} videoDescription - Video description for context
   * @param {Array} availableEvents - List of existing events
   * @param {Array} availableCategories - List of available categories
   * @returns {Promise<Object>} - Analysis result with assignment suggestion
   */
  async categorizeVideoForEventAssignment(youtubeUrl, videoTitle = '', videoDescription = '', availableEvents = [], availableCategories = []) {
    if (!this.isAvailable()) {
      throw new Error('Gemini AI Service is not available. Please check your API key configuration.');
    }

    if (!youtubeUrl || !youtubeUrl.includes('youtube.com')) {
      throw new Error('Invalid YouTube URL provided');
    }

    try {
      // Build the assignment analysis prompt
      const prompt = this.buildVideoAssignmentPrompt(youtubeUrl, videoTitle, videoDescription, availableEvents, availableCategories);
      
      // Generate response using the new API
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.2, // Slightly higher for more creative suggestions
          maxOutputTokens: 1024,
          thinkingConfig: {
            thinkingBudget: 0
          }
        }
      });

      // Parse the structured response
      return this.parseVideoAssignmentResponse(response.text, availableEvents, availableCategories);

    } catch (error) {
      console.error('❌ Error during video assignment analysis:', error);
      throw new Error(`Video assignment analysis failed: ${error.message}`);
    }
  }

  /**
   * Build the AI prompt for video-to-event assignment
   * @param {string} youtubeUrl - YouTube URL
   * @param {string} videoTitle - Video title
   * @param {string} videoDescription - Video description
   * @param {Array} events - Available events
   * @param {Array} categories - Available categories
   * @returns {string} - Formatted prompt
   */
  buildVideoAssignmentPrompt(youtubeUrl, videoTitle, videoDescription, events, categories) {
    const eventsList = events.slice(0, 20).map(event => // Limit to 20 events to avoid token limits
      `- "${event.title}" (${event.startDate} - ${event.endDate || 'Ongoing'}) - Category: ${event.category}`
    ).join('\n');

    const categoryList = categories.map(cat => 
      `- "${cat.name}": ${cat.description || 'Historical category'}`
    ).join('\n');

    return `You are an expert historian and content analyst. Your task is to analyze a YouTube video and determine how it should be assigned to historical events.

YouTube URL: ${youtubeUrl}
${videoTitle ? `Video Title: ${videoTitle}` : ''}
${videoDescription ? `Video Description: ${videoDescription}` : ''}

Existing Historical Events:
${eventsList || 'No existing events'}

Available Categories:
${categoryList}

Please analyze this video and determine the BEST action:

1. **ASSIGN_TO_EXISTING**: If this video clearly belongs to an existing event
2. **CREATE_NEW_EVENT**: If this video represents a new historical topic/event
3. **UNCERTAIN**: If you cannot determine with reasonable confidence

Respond ONLY with a valid JSON object in this exact format:
{
  "action": "ASSIGN_TO_EXISTING" | "CREATE_NEW_EVENT" | "UNCERTAIN",
  "confidence": 0.85,
  "reasoning": "Brief explanation of the decision",
  "existingEventTitle": "EXACT_EVENT_TITLE_IF_ASSIGNING",
  "newEventSuggestion": {
    "title": "Suggested event title",
    "startDate": "YYYY-MM-DD or YYYY",
    "endDate": "YYYY-MM-DD or YYYY or null",
    "category": "EXACT_CATEGORY_NAME",
    "details": "Brief description"
  },
  "alternativeAction": "Alternative suggestion if confidence is medium"
}

Requirements:
- action MUST be one of the three options above
- confidence should be between 0.0 and 1.0
- existingEventTitle MUST exactly match one from the list (only if action is ASSIGN_TO_EXISTING)
- newEventSuggestion.category MUST exactly match one from the categories list
- newEventSuggestion should be null if action is ASSIGN_TO_EXISTING
- existingEventTitle should be null if action is CREATE_NEW_EVENT
- Return ONLY the JSON object, no additional text`;
  }

  /**
   * Parse the AI response for video assignment
   * @param {string} responseText - Raw AI response
   * @param {Array} availableEvents - Available events for validation
   * @param {Array} availableCategories - Available categories for validation
   * @returns {Object} - Parsed and validated response
   */
  parseVideoAssignmentResponse(responseText, availableEvents, availableCategories) {
    try {
      // Clean the response (remove any markdown or extra text)
      const cleanedText = responseText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanedText);

      // Validate the response structure
      if (!parsed.action || !parsed.confidence || !parsed.reasoning) {
        throw new Error('Invalid response structure from AI');
      }

      // Validate action type
      const validActions = ['ASSIGN_TO_EXISTING', 'CREATE_NEW_EVENT', 'UNCERTAIN'];
      if (!validActions.includes(parsed.action)) {
        throw new Error('Invalid action type from AI');
      }

      let result = {
        action: parsed.action,
        confidence: Math.max(0, Math.min(1, parsed.confidence)),
        reasoning: parsed.reasoning,
        alternativeAction: parsed.alternativeAction || null,
        success: true
      };

      // Handle ASSIGN_TO_EXISTING
      if (parsed.action === 'ASSIGN_TO_EXISTING' && parsed.existingEventTitle) {
        const matchingEvent = availableEvents.find(event => event.title === parsed.existingEventTitle);
        if (matchingEvent) {
          result.existingEvent = {
            id: matchingEvent.id,
            title: matchingEvent.title,
            startDate: matchingEvent.startDate,
            endDate: matchingEvent.endDate,
            category: matchingEvent.category
          };
        } else {
          console.warn('⚠️ AI suggested unknown event, falling back to CREATE_NEW_EVENT');
          result.action = 'CREATE_NEW_EVENT';
          result.confidence = 0.3;
          result.reasoning = 'AI suggested an unknown event, recommending new event creation';
        }
      }

      // Handle CREATE_NEW_EVENT
      if ((parsed.action === 'CREATE_NEW_EVENT' || result.action === 'CREATE_NEW_EVENT') && parsed.newEventSuggestion) {
        const suggestion = parsed.newEventSuggestion;
        
        // Validate category exists
        const categoryExists = availableCategories.find(cat => cat.name === suggestion.category);
        
        result.newEventSuggestion = {
          title: suggestion.title || 'New Historical Event',
          startDate: suggestion.startDate || new Date().getFullYear().toString(),
          endDate: suggestion.endDate || null,
          category: categoryExists ? suggestion.category : availableCategories[0]?.name || 'General',
          details: suggestion.details || 'Event created from video analysis',
          categoryId: categoryExists ? categoryExists.id : availableCategories[0]?.id
        };
      }

      return result;

    } catch (error) {
      console.error('❌ Failed to parse AI video assignment response:', error);
      console.log('Raw response:', responseText);
      
      // Return a safe fallback
      return {
        action: 'UNCERTAIN',
        confidence: 0.1,
        reasoning: 'Failed to parse AI response, manual assignment recommended',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get general content analysis for any text/URL
   * @param {string} content - Content to analyze
   * @param {string} context - Additional context for analysis
   * @returns {Promise<Object>} - Analysis result
   */
  async analyzeContent(content, context = '') {
    if (!this.isAvailable()) {
      throw new Error('Gemini AI Service is not available');
    }

    try {
      const prompt = `Analyze this content and provide insights:

Content: ${content}
${context ? `Context: ${context}` : ''}

Please provide a brief analysis including:
- Main topic/theme
- Historical period (if applicable)
- Key subjects covered
- Educational value

Respond in a clear, structured format.`;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.3,
          maxOutputTokens: 1024,
          thinkingConfig: {
            thinkingBudget: 0
          }
        }
      });
      
      return {
        analysis: response.text,
        success: true
      };

    } catch (error) {
      console.error('❌ Error during content analysis:', error);
      throw new Error(`Content analysis failed: ${error.message}`);
    }
  }

  /**
   * Health check for the service
   * @returns {Object} - Service status
   */
  getStatus() {
    return {
      available: this.isAvailable(),
      initialized: this.initialized,
      hasApiKey: !!process.env.GEMINI_API_KEY,
      model: this.ai ? 'gemini-2.5-flash' : null
    };
  }
}

module.exports = GeminiService;