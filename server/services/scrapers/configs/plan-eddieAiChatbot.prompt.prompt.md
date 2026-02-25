# Plan: Eddie AI Chatbot with Local LLM Integration

Implement Eddie, a conversational AI assistant using a locally-hosted LLM (Ollama or LM Studio) that can access all application data, maintain conversation history, and develop personality through interactions. Eddie will integrate with media libraries (Plex, Stash, Komga), personal management (notes, tasks, dating), and watch tracking systems via a modular service architecture.

## Steps

1. **Add database schema for conversations and personality** - Extend [prisma/schema.prisma](server/prisma/schema.prisma) with `ChatConversation`, `ChatMessage`, `ChatPersonality`, and `UserPreferences` models, then synchronize to SQLite/PostgreSQL schemas per project standards and run migrations.

2. **Create local LLM integration service** - Build [server/services/LocalLLMService.js](server/services/LocalLLMService.js) supporting Ollama/LM Studio APIs with streaming responses, context window management, and fallback to existing `GeminiService` from [server/services/GeminiService.js](server/services/GeminiService.js).

3. **Implement ChatbotService with full data access** - Create [server/services/ChatbotService.js](server/services/ChatbotService.js) with methods to gather context from all 12 data sources (Plex media, Stash scenes, books, games, notes, tasks, dating, locations, watch tracking), build comprehensive prompts, manage conversation history, and execute actions like marking items complete or creating reminders.

4. **Build modular chat API routes** - Create [server/routes/chat.js](server/routes/chat.js) following existing patterns in [server/routes/](server/routes/) with endpoints for message processing (`POST /api/chat/message`), conversation management (`GET /conversations`, `DELETE /:id`), streaming via WebSocket, and personality evolution tracking.

5. **Design personality evolution system** - Implement memory storage tracking user preferences, interaction patterns, topic interests, and conversational style preferences in `ChatPersonality` model, with periodic personality prompt refinement based on conversation analysis.

6. **Build React chat interface** - Create [client/src/components/Chat/](client/src/components/Chat/) with ChatWidget (floating button), ChatPanel (expandable interface), MessageList, and ChatInput components using existing WebSocket patterns from Stash integration and Tailwind CSS styling conventions.

## Further Considerations

1. **LLM Selection & Configuration** - Should we prioritize Ollama (easier setup, model library) or LM Studio (better UI, model management)? Recommend Ollama with `llama3.2` or `mistral` models for balance of quality/performance. Need settings UI for model selection, temperature, and context window size.

2. **Privacy & Content Filtering** - Adult content from Stash integration requires explicit user consent before sharing with chatbot. Add `contentFilters` field to `UserPreferences` to control what data sources Eddie can access. Implement warning system for sensitive queries.

3. **Action Execution System** - Define structured action format for Eddie to modify data (e.g., `{"action": "markWatched", "itemId": 123, "mediaType": "movie"}`). Build action parser and validator in `ChatbotService` with confirmation prompts for destructive operations.

4. **Context Window Optimization** - With 12+ data sources, context can exceed LLM limits. Implement relevance scoring to prioritize most pertinent data based on user query intent (e.g., media queries → load Plex context, task queries → load tasks/notes).

5. **Personality Growth Metrics** - How should personality evolve? Options: **(A)** User feedback system (thumbs up/down on responses), **(B)** Conversation analysis (detect topics of interest, preferred response style), **(C)** Explicit user directives ("be more casual", "focus on recommendations"), or **(D)** Hybrid approach combining all three.

6. **Frontend Integration Point** - Where should Eddie live? **(A)** Floating widget accessible from all pages (like help/support chat), **(B)** Dedicated `/chat` route page, **(C)** Dashboard sidebar panel, or **(D)** All of the above with shared state management. Recommend **(D)** for maximum flexibility.
