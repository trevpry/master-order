const express = require('express');
const router = express.Router();
const ChatService = require('../services/ChatService');
const { asyncHandler, sendSuccess, sendBadRequest, sendNotFound, sendServerError, logError } = require('../utils/responses');

const chatService = new ChatService();

// ============================================================================
// OLLAMA SETTINGS
// ============================================================================

// GET /api/chat/settings - Get Ollama connection settings
router.get('/settings', asyncHandler(async (req, res) => {
  const settings = await chatService.getOllamaSettings();
  sendSuccess(res, settings);
}));

// PUT /api/chat/settings - Update Ollama connection settings
router.put('/settings', asyncHandler(async (req, res) => {
  const { ollamaUrl, ollamaDefaultModel } = req.body;
  await chatService.updateOllamaSettings({ ollamaUrl, ollamaDefaultModel });
  const updated = await chatService.getOllamaSettings();
  sendSuccess(res, updated);
}));

// GET /api/chat/models - List available Ollama models
router.get('/models', asyncHandler(async (req, res) => {
  const models = await chatService.listModels();
  sendSuccess(res, models);
}));

// POST /api/chat/test-connection - Test Ollama connectivity
router.post('/test-connection', asyncHandler(async (req, res) => {
  const { url } = req.body;
  const result = await chatService.testConnection(url);
  sendSuccess(res, result);
}));

// ============================================================================
// CONVERSATIONS
// ============================================================================

// GET /api/chat/conversations - List all conversations
router.get('/conversations', asyncHandler(async (req, res) => {
  const conversations = await chatService.getConversations();
  sendSuccess(res, conversations);
}));

// POST /api/chat/conversations - Create a new conversation
router.post('/conversations', asyncHandler(async (req, res) => {
  const { title, model } = req.body;
  const conversation = await chatService.createConversation(title, model);
  sendSuccess(res, conversation);
}));

// GET /api/chat/conversations/:id - Get a conversation with messages
router.get('/conversations/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return sendBadRequest(res, 'Invalid conversation ID');

  const conversation = await chatService.getConversation(id);
  if (!conversation) return sendNotFound(res, 'Conversation not found');
  sendSuccess(res, conversation);
}));

// PUT /api/chat/conversations/:id - Update conversation (title, model)
router.put('/conversations/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return sendBadRequest(res, 'Invalid conversation ID');

  const { title, model } = req.body;
  const conversation = await chatService.updateConversation(id, { title, model });
  sendSuccess(res, conversation);
}));

// DELETE /api/chat/conversations/:id - Delete a conversation
router.delete('/conversations/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return sendBadRequest(res, 'Invalid conversation ID');

  await chatService.deleteConversation(id);
  sendSuccess(res, { deleted: true });
}));

// ============================================================================
// CHAT MESSAGES (STREAMING)
// ============================================================================

// POST /api/chat/conversations/:id/messages - Send a message & stream response
router.post('/conversations/:id/messages', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return sendBadRequest(res, 'Invalid conversation ID');

  const { content, model } = req.body;
  if (!content || !content.trim()) return sendBadRequest(res, 'Message content is required');

  try {
    const { stream, model: activeModel, conversationId } = await chatService.sendMessage(id, content.trim(), model);

    // Set up SSE-style streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Chat-Model', activeModel);

    let fullResponse = '';
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          // Ollama streams newline-delimited JSON
          const lines = chunk.split('\n').filter(l => l.trim());
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.message?.content) {
                fullResponse += parsed.message.content;
                res.write(`data: ${JSON.stringify({ content: parsed.message.content })}\n\n`);
              }
              if (parsed.done) {
                res.write(`data: ${JSON.stringify({ done: true, model: activeModel })}\n\n`);
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }

        // Save the complete assistant message
        if (fullResponse) {
          await chatService.saveAssistantMessage(conversationId, fullResponse, activeModel);
        }

        res.write('data: [DONE]\n\n');
        res.end();
      } catch (err) {
        logError(err, 'chat-stream-pump');
        if (!res.headersSent) {
          sendServerError(res, 'Stream error');
        } else {
          res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
          res.end();
        }
      }
    };

    pump();

    // Handle client disconnect
    req.on('close', () => {
      reader.cancel();
    });
  } catch (error) {
    logError(error, 'chat-send-message');
    if (!res.headersSent) {
      sendServerError(res, error.message);
    }
  }
});

module.exports = router;
