const prisma = require('../prismaClient');
const WikiService = require('./WikiService');

class ChatService {
  constructor() {
    this.wikiService = new WikiService();
  }

  /**
   * Get Ollama connection settings from the database
   */
  async getOllamaSettings() {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    return {
      ollamaUrl: settings?.ollamaUrl || 'http://localhost:11434',
      ollamaDefaultModel: settings?.ollamaDefaultModel || 'llama3',
      ollamaEmbeddingModel: settings?.ollamaEmbeddingModel || 'nomic-embed-text'
    };
  }

  /**
   * Update Ollama connection settings
   */
  async updateOllamaSettings({ ollamaUrl, ollamaDefaultModel, ollamaEmbeddingModel }) {
    return prisma.settings.upsert({
      where: { id: 1 },
      update: { ollamaUrl, ollamaDefaultModel, ollamaEmbeddingModel },
      create: { id: 1, ollamaUrl, ollamaDefaultModel, ollamaEmbeddingModel }
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
  // RAG - EMBEDDING & RETRIEVAL
  // ==========================================

  /**
   * Generate an embedding vector via Ollama /api/embed
   */
  async generateEmbedding(text) {
    const { ollamaUrl, ollamaEmbeddingModel } = await this.getOllamaSettings();
    try {
      const response = await fetch(`${ollamaUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaEmbeddingModel,
          input: text.substring(0, 8000)
        }),
        signal: AbortSignal.timeout(60000) // 60s — model may need cold start
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.embeddings?.[0] || null;
    } catch (err) {
      console.error('Embedding generation failed:', err.message);
      return null;
    }
  }

  /**
   * Cosine similarity between two vectors
   */
  cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  }

  /**
   * Retrieve relevant notes directly (keyword/phrase scoring).
   */
  async retrieveRelevantNotes(queryText, topK = 5) {
    const raw = (queryText || '').trim();
    if (!raw) return null;

    const words = [...new Set(
      raw
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(w => w.length > 2)
    )].slice(0, 8);

    if (words.length === 0) return null;

    const orConditions = [
      { title: { contains: raw } },
      { content: { contains: raw } }
    ];

    for (const word of words) {
      orConditions.push({ title: { contains: word } });
      orConditions.push({ content: { contains: word } });
      orConditions.push({ tags: { contains: word } });
    }

    const candidates = await prisma.note.findMany({
      where: {
        OR: orConditions,
        content: { not: '' }
      },
      orderBy: { updatedAt: 'desc' },
      take: 60,
      select: {
        id: true,
        title: true,
        content: true,
        tags: true,
        updatedAt: true,
        isFavorite: true,
        type: true
      }
    });

    if (candidates.length === 0) return null;

    const scored = candidates.map(note => {
      const haystack = `${note.title} ${note.content} ${note.tags || ''}`.toLowerCase();
      let score = 0;

      if (haystack.includes(raw.toLowerCase())) score += 5;
      for (const word of words) {
        if (note.title.toLowerCase().includes(word)) score += 2;
        if ((note.tags || '').toLowerCase().includes(word)) score += 1;
        if (note.content.toLowerCase().includes(word)) score += 1;
      }
      if (note.isFavorite) score += 1;

      return { ...note, score };
    });

    scored.sort((a, b) => b.score - a.score || new Date(b.updatedAt) - new Date(a.updatedAt));
    const topNotes = scored.filter(n => n.score > 0).slice(0, topK);
    if (topNotes.length === 0) return null;

    let notesContext = '';
    for (const note of topNotes) {
      const snippet = this.buildNoteSnippet(note.content, words, 450);
      notesContext += `\n- Note #${note.id}: ${note.title} (type: ${note.type}, updated: ${new Date(note.updatedAt).toISOString().split('T')[0]})\n  ${snippet}\n`;
    }

    return `You can also use the user's direct notes as high-signal personal context. Use these note excerpts when relevant, and prefer concrete note facts over assumptions.\n\n--- Relevant Notes ---${notesContext}--- End Notes ---`;
  }

  buildNoteSnippet(content, words, maxLen = 450) {
    const text = (content || '').replace(/\s+/g, ' ').trim();
    if (!text) return '(empty note)';

    const lower = text.toLowerCase();
    let start = 0;
    for (const word of words) {
      const idx = lower.indexOf(word);
      if (idx >= 0) {
        start = Math.max(0, idx - 90);
        break;
      }
    }

    const snippet = text.slice(start, start + maxLen);
    return snippet + (start + maxLen < text.length ? ' ...' : '');
  }

  combineContextSections(...sections) {
    const compact = sections.filter(Boolean).map(s => s.trim()).filter(Boolean);
    return compact.length ? compact.join('\n\n') : null;
  }

  /**
   * Save a message and queue embedding generation in background
   */
  async saveMessageWithEmbedding(data) {
    const message = await prisma.chatMessage.create({ data });

    this.generateEmbedding(data.content).then(async (embedding) => {
      if (embedding) {
        await prisma.chatMessage.update({
          where: { id: message.id },
          data: { embedding: JSON.stringify(embedding) }
        });
      }
    }).catch(err => console.error('Background embedding error:', err.message));

    return message;
  }

  /**
   * RAG retrieval: embed the query and find the most relevant past messages + wiki pages
   */
  async retrieveRelevantContext(queryText, excludeConversationId, topK = 20) {
    // Get wiki context (Layer 2 synthesized knowledge)
    let wikiContext = null;
    let notesContext = null;
    try {
      [wikiContext, notesContext] = await Promise.all([
        this.wikiService.getWikiContext(queryText, 5),
        this.retrieveRelevantNotes(queryText, 5)
      ]);
    } catch (err) {
      console.error('Context retrieval failed:', err.message);
    }

    const queryEmbedding = await this.generateEmbedding(queryText);

    if (!queryEmbedding) {
      const recentContext = await this.fallbackRecentContext(excludeConversationId);
      return this.combineContextSections(wikiContext, notesContext, recentContext);
    }

    const embeddedMessages = await prisma.chatMessage.findMany({
      where: {
        conversationId: { not: excludeConversationId },
        embedding: { not: null }
      },
      select: {
        role: true,
        content: true,
        embedding: true,
        createdAt: true,
        conversation: { select: { title: true } }
      }
    });

    if (embeddedMessages.length === 0) {
      const recentContext = await this.fallbackRecentContext(excludeConversationId);
      return this.combineContextSections(wikiContext, notesContext, recentContext);
    }

    const scored = embeddedMessages.map(msg => ({
      ...msg,
      score: this.cosineSimilarity(queryEmbedding, JSON.parse(msg.embedding))
    }));

    scored.sort((a, b) => b.score - a.score);
    const topMessages = scored.slice(0, topK).filter(m => m.score >= 0.3);

    if (topMessages.length === 0) return this.combineContextSections(wikiContext, notesContext);

    const byConversation = {};
    for (const msg of topMessages) {
      const title = msg.conversation.title;
      if (!byConversation[title]) byConversation[title] = [];
      byConversation[title].push(msg);
    }

    let context = '';
    for (const [title, msgs] of Object.entries(byConversation)) {
      msgs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      context += `\n[${title}]\n`;
      for (const m of msgs) {
        const prefix = m.role === 'user' ? 'User' : 'Assistant';
        context += `${prefix}: ${m.content}\n`;
      }
    }

    const memorySection = `You have memory of the user's previous conversations. Use these relevant excerpts to remember personal details, preferences, and facts the user has shared before. Do not mention you are reading previous conversations unless asked.\n\n--- Relevant Memory ---${context}--- End Memory ---`;

    // Combine wiki context, direct notes, and conversation memory.
    return this.combineContextSections(wikiContext, notesContext, memorySection);
  }

  /**
   * Fallback when embeddings are unavailable
   */
  async fallbackRecentContext(excludeConversationId) {
    const pastMessages = await prisma.chatMessage.findMany({
      where: { conversationId: { not: excludeConversationId } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        role: true,
        content: true,
        conversation: { select: { title: true } }
      }
    });

    if (pastMessages.length === 0) return null;

    const byConversation = {};
    for (const msg of pastMessages.reverse()) {
      const title = msg.conversation.title;
      if (!byConversation[title]) byConversation[title] = [];
      byConversation[title].push(msg);
    }

    let context = '';
    for (const [title, msgs] of Object.entries(byConversation)) {
      context += `\n[${title}]\n`;
      for (const m of msgs) {
        const prefix = m.role === 'user' ? 'User' : 'Assistant';
        context += `${prefix}: ${m.content}\n`;
      }
      if (context.length > 10000) break;
    }

    return `You have memory of the user's previous conversations. Use this context to remember personal details, preferences, and facts. Do not mention you are reading previous conversations unless asked.\n\n--- Recent Memory ---${context}--- End Memory ---`;
  }

  /**
   * Backfill embeddings for messages that don't have them yet
   */
  async backfillEmbeddings(batchSize = 50) {
    const unembedded = await prisma.chatMessage.findMany({
      where: { embedding: null },
      take: batchSize,
      orderBy: { createdAt: 'asc' }
    });

    let count = 0;
    for (const msg of unembedded) {
      const embedding = await this.generateEmbedding(msg.content);
      if (embedding) {
        await prisma.chatMessage.update({
          where: { id: msg.id },
          data: { embedding: JSON.stringify(embedding) }
        });
        count++;
      }
    }
    return { processed: count, total: unembedded.length };
  }

  /**
   * Get embedding coverage stats
   */
  async getEmbeddingStatus() {
    const total = await prisma.chatMessage.count();
    const embedded = await prisma.chatMessage.count({ where: { embedding: { not: null } } });
    return { total, embedded, pending: total - embedded };
  }

  // ==========================================
  // CHAT / STREAMING
  // ==========================================

  /**
   * Send a message and stream the AI response.
   */
  async sendMessage(conversationId, userContent, model) {
    const conversation = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    });
    if (!conversation) throw new Error('Conversation not found');

    const { ollamaUrl } = await this.getOllamaSettings();
    const activeModel = model || conversation.model;

    // Save the user message with background embedding
    await this.saveMessageWithEmbedding({
      conversationId,
      role: 'user',
      content: userContent,
      model: activeModel
    });

    // RAG: retrieve relevant context from past conversations
    const memoryContext = await this.retrieveRelevantContext(userContent, conversationId);

    // Build message history
    const messages = [];
    if (memoryContext) {
      messages.push({ role: 'system', content: memoryContext });
    }
    messages.push(...conversation.messages.map(m => ({
      role: m.role,
      content: m.content
    })));
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
   * Save the complete assistant response after streaming finishes.
   * Also triggers wiki extraction in the background (fire-and-forget).
   */
  async saveAssistantMessage(conversationId, content, model) {
    const message = await this.saveMessageWithEmbedding({
      conversationId,
      role: 'assistant',
      content,
      model
    });

    // Fire-and-forget: extract personal facts from this exchange into the wiki
    this.triggerWikiExtraction(conversationId, content).catch(err => {
      console.error('Wiki extraction background error:', err.message);
    });

    return message;
  }

  /**
   * Background wiki extraction from a chat exchange
   */
  async triggerWikiExtraction(conversationId, assistantContent) {
    // Find the most recent user message in this conversation
    const userMsg = await prisma.chatMessage.findFirst({
      where: { conversationId, role: 'user' },
      orderBy: { createdAt: 'desc' }
    });
    if (!userMsg) return;

    const conversation = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      select: { title: true }
    });

    const extractionResult = await this.wikiService.extractFromChat(
      userMsg.content,
      assistantContent,
      conversation?.title || 'Untitled',
      conversationId
    );

    // Keep messages retriable if extraction is disabled or fails.
    if (extractionResult && extractionResult.processed === false) {
      return;
    }

    // Mark both messages as wiki-extracted
    await prisma.chatMessage.updateMany({
      where: {
        conversationId,
        id: { in: [userMsg.id] },
        wikiExtracted: false
      },
      data: { wikiExtracted: true }
    });
    // Mark the assistant message too (find the latest one)
    const assistantMsg = await prisma.chatMessage.findFirst({
      where: { conversationId, role: 'assistant' },
      orderBy: { createdAt: 'desc' }
    });
    if (assistantMsg) {
      await prisma.chatMessage.update({
        where: { id: assistantMsg.id },
        data: { wikiExtracted: true }
      });
    }
  }
}

module.exports = ChatService;
