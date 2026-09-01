const prisma = require('../prismaClient');

class ChatService {
  /**
   * Get Ollama connection settings from the database
   */
  async getOllamaSettings() {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    return {
      ollamaUrl: settings?.ollamaUrl || 'http://localhost:11434',
      ollamaDefaultModel: settings?.ollamaDefaultModel || 'llama3'
    };
  }

  /**
   * Update Ollama connection settings
   */
  async updateOllamaSettings({ ollamaUrl, ollamaDefaultModel }) {
    return prisma.settings.upsert({
      where: { id: 1 },
      update: { ollamaUrl, ollamaDefaultModel },
      create: { id: 1, ollamaUrl, ollamaDefaultModel }
    });
  }

  /**
   * List available models from the Ollama instance
   */
  async listModels() {
    const { ollamaUrl } = await this.getOllamaSettings();
    const response = await fetch(`${ollamaUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data.models || [];
  }

  /**
   * Test the Ollama connection
   */
  async testConnection(url) {
    const targetUrl = url || (await this.getOllamaSettings()).ollamaUrl;
    const response = await fetch(`${targetUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      throw new Error(`Connection failed: ${response.status}`);
    }
    const data = await response.json();
    return { connected: true, models: (data.models || []).length };
  }

  // ==========================================
  // CONVERSATION CRUD
  // ==========================================

  async getConversations() {
    return prisma.chatConversation.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        _count: { select: { messages: true } }
      }
    });
  }

  async getConversation(id) {
    return prisma.chatConversation.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } }
      }
    });
  }

  async createConversation(title, model) {
    const settings = await this.getOllamaSettings();
    return prisma.chatConversation.create({
      data: {
        title: title || 'New Conversation',
        model: model || settings.ollamaDefaultModel
      },
      include: { messages: true }
    });
  }

  async updateConversation(id, data) {
    return prisma.chatConversation.update({
      where: { id },
      data
    });
  }

  async deleteConversation(id) {
    return prisma.chatConversation.delete({ where: { id } });
  }

  // ==========================================
  // CHAT / STREAMING
  // ==========================================

  /**
   * Send a message and stream the AI response.
   * Returns a ReadableStream from Ollama.
   */
  async sendMessage(conversationId, userContent, model) {
    const conversation = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    });
    if (!conversation) throw new Error('Conversation not found');

    const { ollamaUrl } = await this.getOllamaSettings();
    const activeModel = model || conversation.model;

    // Save the user message
    await prisma.chatMessage.create({
      data: {
        conversationId,
        role: 'user',
        content: userContent,
        model: activeModel
      }
    });

    // Build message history for context
    const messages = conversation.messages.map(m => ({
      role: m.role,
      content: m.content
    }));
    messages.push({ role: 'user', content: userContent });

    // Call Ollama chat API with streaming
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: activeModel,
        messages,
        stream: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama error: ${response.status} - ${errorText}`);
    }

    // Update conversation title from first user message if still default
    if (conversation.title === 'New Conversation' && conversation.messages.length === 0) {
      const autoTitle = userContent.substring(0, 80) + (userContent.length > 80 ? '...' : '');
      await prisma.chatConversation.update({
        where: { id: conversationId },
        data: { title: autoTitle, model: activeModel }
      });
    }

    // Touch updatedAt
    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    });

    return { stream: response.body, model: activeModel, conversationId };
  }

  /**
   * Save the complete assistant response after streaming finishes
   */
  async saveAssistantMessage(conversationId, content, model) {
    return prisma.chatMessage.create({
      data: {
        conversationId,
        role: 'assistant',
        content,
        model
      }
    });
  }
}

module.exports = ChatService;
