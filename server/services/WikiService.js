const prisma = require('../prismaClient');

// Default Layer 3 Schema - instructs the AI on wiki maintenance
const DEFAULT_WIKI_SCHEMA = `
# Personal Wiki Schema (Layer 3)

## Purpose
You are maintaining a source-backed personal knowledge wiki about the user. Your job is to compile durable facts from raw inputs into structured, interlinked Markdown wiki pages that compound over time.

Treat the wiki as the maintained knowledge layer between raw sources and future questions. Do not rewrite or forget prior knowledge unless a newer source clearly contradicts it.

## Page Types
- **entity**: Wikipedia-style pages for people, places, tools, companies, media the user interacts with
- **concept**: Synthesized topic pages - habits, goals, interests, recurring themes, opinions
- **comparison**: Side-by-side analysis pages when the user evaluates options
- **source-summary**: One page per raw source, capturing what it said and how it changed the wiki
- **query**: Filed answers to useful questions worth preserving
- **overview**: High-level synthesis pages that summarize the current state of understanding
- **index**: Master catalog pages (auto-managed)

## Categories
Use these categories: personal, health, work, interests, relationships, goals, habits, media, technology, finance, travel, food, general

## Formatting Rules
1. Every page starts with a level-1 heading: # Title
2. Use [[slug]] wiki-links to reference other pages. Always use the slug, not the title.
3. Include a "## Sources" section at the bottom listing where information came from (note IDs, chat dates)
4. Include a "## Last Updated" line with the current date
5. Use bullet points for lists of facts, not paragraphs
6. Flag contradictions with "> ⚠️ CONTRADICTION:" blockquotes, noting the conflicting sources and dates
7. Keep pages focused — one entity or concept per page. Split if a page grows beyond one clear topic.

## Slug Convention
- Lowercase, hyphenated: "morning-routine", "favorite-movies", "john-smith"
- Entities use the name: "react", "plex-server", "angel-landing"
- Concepts use descriptive phrases: "sleep-habits", "career-goals", "cooking-preferences"

## Extraction Rules
When processing a source, extract:
- Personal facts (name, age, location, job, etc.)
- Preferences and opinions ("I love...", "I prefer...", "I hate...")
- Goals and aspirations
- Habits and routines (morning routine, exercise, diet)
- Relationships (people mentioned, their roles)
- Interests and hobbies
- Moods and emotional patterns (from daily notes)
- Tools, software, and technology used
- Media consumed (books, movies, shows, music)
- Health-related information
- Work and career details

When a query answer or chat exchange produces a durable synthesis, file it back into the wiki as a query or concept page instead of leaving the knowledge only in chat.

Prefer generic knowledge capture over hardcoded topical routing. Infer the right page type and category from the content itself and from existing wiki pages.

## What NOT to Extract
- Trivial small talk with no personal information
- Purely technical questions with no personal context (e.g., "How do I sort an array?")
- Information already captured in existing wiki pages (deduplication)

## Update Rules
- When new info CONFIRMS existing info, strengthen the claim (no change needed)
- When new info CONTRADICTS existing info, add a contradiction blockquote with dates
- When new info EXTENDS existing info, append to the relevant section
- Always update the "Sources" and "Last Updated" sections
- During lint or maintenance passes, check for contradictions, orphan pages, missing concepts, stale claims, and unanswered gaps that should become new wiki pages.
`;

class WikiService {
  // ==========================================
  // SETTINGS & SCHEMA
  // ==========================================

  async getWikiSettings() {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    return {
      wikiContextEnabled: settings?.wikiContextEnabled ?? true,
      wikiAutoIngestEnabled: settings?.wikiAutoIngestEnabled ?? true,
      wikiAutoIngestInterval: settings?.wikiAutoIngestInterval ?? 60,
      wikiChatExtractionEnabled: settings?.wikiChatExtractionEnabled ?? true,
      wikiSchema: settings?.wikiSchema || DEFAULT_WIKI_SCHEMA,
      lastWikiIngestAt: settings?.lastWikiIngestAt || null
    };
  }

  async updateWikiSettings(data) {
    return prisma.settings.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data }
    });
  }

  async getWikiSchema() {
    const settings = await this.getWikiSettings();
    return settings.wikiSchema;
  }

  async updateWikiSchema(schema) {
    return this.updateWikiSettings({ wikiSchema: schema });
  }

  // ==========================================
  // OLLAMA HELPERS
  // ==========================================

  async getOllamaSettings() {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    return {
      ollamaUrl: settings?.ollamaUrl || 'http://localhost:11434',
      ollamaDefaultModel: settings?.ollamaDefaultModel || 'llama3',
      ollamaEmbeddingModel: settings?.ollamaEmbeddingModel || 'nomic-embed-text'
    };
  }

  async callOllama(messages, model) {
    const { ollamaUrl, ollamaDefaultModel } = await this.getOllamaSettings();
    const activeModel = model || ollamaDefaultModel;

    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: activeModel,
        messages,
        stream: false,
        keep_alive: '10m'
      }),
      signal: AbortSignal.timeout(300000) // 5 min timeout for wiki operations (large prompts + cold model load)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.message?.content || '';
  }

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
      console.error('Wiki embedding generation failed:', err.message);
      return null;
    }
  }

  // ==========================================
  // PAGE CRUD
  // ==========================================

  async getAllPages(filters = {}) {
    const where = {};
    if (filters.type) where.type = filters.type;
    if (filters.category) where.category = filters.category;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search } },
        { content: { contains: filters.search } }
      ];
    }

    return prisma.wikiPage.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        type: true,
        category: true,
        updatedAt: true,
        createdAt: true
      }
    });
  }

  async getPage(slug) {
    return prisma.wikiPage.findUnique({ where: { slug } });
  }

  async getPageById(id) {
    return prisma.wikiPage.findUnique({ where: { id } });
  }

  async createPage(data) {
    const page = await prisma.wikiPage.create({ data });
    // Generate embedding in background
    this.generateEmbedding(data.title + '\n' + data.content).then(async (embedding) => {
      if (embedding) {
        await prisma.wikiPage.update({
          where: { id: page.id },
          data: { embedding: JSON.stringify(embedding) }
        });
      }
    }).catch(err => console.error('Wiki page embedding error:', err.message));
    return page;
  }

  async updatePage(slug, data) {
    const page = await prisma.wikiPage.update({
      where: { slug },
      data: { ...data, updatedAt: new Date() }
    });
    // Re-generate embedding in background
    const content = data.content || page.content;
    const title = data.title || page.title;
    this.generateEmbedding(title + '\n' + content).then(async (embedding) => {
      if (embedding) {
        await prisma.wikiPage.update({
          where: { id: page.id },
          data: { embedding: JSON.stringify(embedding) }
        });
      }
    }).catch(err => console.error('Wiki page embedding error:', err.message));
    return page;
  }

  async deletePage(slug) {
    return prisma.wikiPage.delete({ where: { slug } });
  }

  // ==========================================
  // WIKI LOG
  // ==========================================

  async addLog(action, description, sourceType = 'note', sourceId = null, affectedPages = []) {
    return prisma.wikiLog.create({
      data: {
        action,
        description,
        sourceType,
        sourceId,
        affectedPages: JSON.stringify(affectedPages)
      }
    });
  }

  async getLog(limit = 50) {
    const logs = await prisma.wikiLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    return logs.map(l => ({
      ...l,
      affectedPages: JSON.parse(l.affectedPages || '[]')
    }));
  }

  // ==========================================
  // STATS
  // ==========================================

  async getStats() {
    const totalPages = await prisma.wikiPage.count();
    const byType = await prisma.wikiPage.groupBy({
      by: ['type'],
      _count: true
    });
    const byCategory = await prisma.wikiPage.groupBy({
      by: ['category'],
      _count: true
    });
    const recentLogs = await prisma.wikiLog.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
    });
    const settings = await this.getWikiSettings();

    return {
      totalPages,
      byType: Object.fromEntries(byType.map(t => [t.type, t._count])),
      byCategory: Object.fromEntries(byCategory.map(c => [c.category, c._count])),
      recentActivity: recentLogs,
      lastIngestAt: settings.lastWikiIngestAt,
      autoIngestEnabled: settings.wikiAutoIngestEnabled,
      chatExtractionEnabled: settings.wikiChatExtractionEnabled
    };
  }

  // ==========================================
  // OPERATION A: INGEST (Notes → Wiki)
  // ==========================================

  async ingestNotes(noteIds) {
    const notes = await prisma.note.findMany({
      where: { id: { in: noteIds } },
      include: { dailyNote: true }
    });

    if (notes.length === 0) return { processed: 0, pages: [] };

    const schema = await this.getWikiSchema();
    const existingPages = await this.getAllPages();
    const existingIndex = existingPages.map(p => `- [[${p.slug}]]: ${p.title} (${p.type}/${p.category})`).join('\n');

    const affectedSlugs = [];

    for (const note of notes) {
      try {
        const isDailyNote = !!note.dailyNote;
        const sourceType = isDailyNote ? 'daily_note' : 'note';

        // Build context about existing relevant pages
        const relevantPages = await this.findRelevantPages(note.content || note.title, 5);
        const relevantContext = relevantPages.map(p => {
          return `### [[${p.slug}]] (${p.type}/${p.category})\n${p.content}`;
        }).join('\n\n');

        let noteContent = `# ${note.title}\n\n${note.content || ''}`;
        if (isDailyNote) {
          const dn = note.dailyNote;
          noteContent += `\n\nDate: ${dn.date}`;
          if (dn.mood) noteContent += `\nMood: ${dn.mood}`;
          if (dn.weather) noteContent += `\nWeather: ${dn.weather}`;
          const goals = JSON.parse(dn.goals || '[]');
          if (goals.length) noteContent += `\nGoals: ${goals.join(', ')}`;
          const habits = JSON.parse(dn.habits || '[]');
          if (habits.length) noteContent += `\nHabits: ${habits.join(', ')}`;
          const gratitude = JSON.parse(dn.gratitude || '[]');
          if (gratitude.length) noteContent += `\nGratitude: ${gratitude.join(', ')}`;
        }

        const prompt = this.buildIngestionPrompt(noteContent, existingIndex, relevantContext, note.id, sourceType);
        const aiResponse = await this.callOllama([
          { role: 'system', content: schema },
          { role: 'user', content: prompt }
        ]);

        const updates = this.parseWikiResponse(aiResponse);
        for (const update of updates) {
          const slugs = await this.applyWikiUpdate(update, note.id, sourceType);
          affectedSlugs.push(...slugs);
        }

        await this.addLog('ingest', `Ingested ${sourceType}: "${note.title}"`, sourceType, note.id, affectedSlugs);
      } catch (err) {
        console.error(`Wiki ingest failed for note ${note.id}:`, err.message);
        await this.addLog('ingest', `Failed to ingest note ${note.id}: ${err.message}`, 'note', note.id, []);
      }
    }

    // Update last ingest time
    await this.updateWikiSettings({ lastWikiIngestAt: new Date() });

    return { processed: notes.length, pages: [...new Set(affectedSlugs)] };
  }

  async ingestAllUningested() {
    // Find notes not referenced by any wiki page
    const allPages = await prisma.wikiPage.findMany({
      select: { sourceNoteIds: true }
    });

    const ingestedNoteIds = new Set();
    for (const page of allPages) {
      const ids = JSON.parse(page.sourceNoteIds || '[]');
      ids.forEach(id => ingestedNoteIds.add(id));
    }

    const allNotes = await prisma.note.findMany({
      select: { id: true },
      where: { content: { not: '' } }
    });

    const uningested = allNotes.filter(n => !ingestedNoteIds.has(n.id)).map(n => n.id);

    if (uningested.length === 0) {
      const datingResult = await this.ingestDatingData();
      return {
        processed: datingResult.processed,
        pages: datingResult.pages,
        notesProcessed: 0,
        datingProcessed: datingResult.processed
      };
    }

    // Process in batches of 5 to avoid overwhelming Ollama
    let totalProcessed = 0;
    const allAffectedPages = [];

    for (let i = 0; i < uningested.length; i += 5) {
      const batch = uningested.slice(i, i + 5);
      const result = await this.ingestNotes(batch);
      totalProcessed += result.processed;
      allAffectedPages.push(...result.pages);
    }

    const datingResult = await this.ingestDatingData();

    return {
      processed: totalProcessed + datingResult.processed,
      pages: [...new Set([...allAffectedPages, ...datingResult.pages])],
      notesProcessed: totalProcessed,
      datingProcessed: datingResult.processed
    };
  }

  // ==========================================
  // OPERATION A2: INGEST (Dating Section -> Wiki)
  // ==========================================

  async ingestDatingData(since = null) {
    const whereClause = since ? { updatedAt: { gt: since } } : {};

    const connections = await prisma.connection.findMany({
      where: whereClause,
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        app: true,
        dates: {
          orderBy: { dateTime: 'desc' }
        },
        encounters: {
          orderBy: { dateTime: 'desc' }
        },
        messages: {
          orderBy: { timestamp: 'desc' }
        },
        screenshots: {
          orderBy: { createdAt: 'desc' }
        },
        connectionPhotos: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (connections.length === 0) {
      return { processed: 0, pages: [] };
    }

    const schema = await this.getWikiSchema();
    const existingPages = await this.getAllPages();
    const existingIndex = existingPages.map(p => `- [[${p.slug}]]: ${p.title} (${p.type}/${p.category})`).join('\n');

    const affectedSlugs = [];
    let processed = 0;

    for (const connection of connections) {
      try {
        const datingPayload = this.serializeDatingConnection(connection);
        const prompt = this.buildDatingIngestionPrompt(datingPayload, existingIndex, connection.id);

        const aiResponse = await this.callOllama([
          { role: 'system', content: schema },
          { role: 'user', content: prompt }
        ]);

        let updates = this.parseWikiResponse(aiResponse);
        if (updates.length === 0 && this.hasMeaningfulDatingData(connection)) {
          const strictPrompt = this.buildStrictDatingIngestionPrompt(datingPayload, existingIndex, connection.id);
          const strictResponse = await this.callOllama([
            { role: 'system', content: schema },
            { role: 'user', content: strictPrompt }
          ]);
          updates = this.parseWikiResponse(strictResponse);
        }

        if (updates.length === 0 && this.hasMeaningfulDatingData(connection)) {
          updates = this.buildDatingFallbackUpdates(connection, existingPages);
        }

        for (const update of updates) {
          const slugs = await this.applyWikiUpdate(update, connection.id, 'dating');
          affectedSlugs.push(...slugs);
        }

        await this.addLog(
          'ingest-dating',
          `Ingested dating connection #${connection.id} (${connection.guyName})`,
          'dating',
          connection.id,
          affectedSlugs
        );

        processed++;
      } catch (err) {
        console.error(`Wiki ingest failed for dating connection ${connection.id}:`, err.message);
        await this.addLog('ingest-dating', `Failed to ingest dating connection ${connection.id}: ${err.message}`, 'dating', connection.id, []);
      }
    }

    return { processed, pages: [...new Set(affectedSlugs)] };
  }

  // ==========================================
  // OPERATION B: QUERY (Wiki → Chat Context)
  // ==========================================

  async getWikiContext(queryText, maxPages = 5) {
    const settings = await this.getWikiSettings();
    if (!settings.wikiContextEnabled) return null;

    const relevantPages = await this.findRelevantPages(queryText, maxPages);
    if (relevantPages.length === 0) return null;

    let context = '';
    for (const page of relevantPages) {
      // Truncate very long pages
      const content = page.content.length > 2000
        ? page.content.substring(0, 2000) + '\n...(truncated)'
        : page.content;
      context += `\n### [[${page.slug}]] — ${page.title}\n${content}\n`;
    }

    return `You have a personal wiki about the user with synthesized knowledge. Use these relevant wiki pages to answer accurately. The wiki represents compiled, verified knowledge — prioritize it over raw conversation memory.\n\n--- Personal Wiki Knowledge ---${context}--- End Wiki Knowledge ---`;
  }

  async findRelevantPages(queryText, topK = 5) {
    // Try semantic search first via embeddings
    const queryEmbedding = await this.generateEmbedding(queryText);

    if (queryEmbedding) {
      const embeddedPages = await prisma.wikiPage.findMany({
        where: { embedding: { not: null } }
      });

      if (embeddedPages.length > 0) {
        const scored = embeddedPages.map(page => ({
          ...page,
          score: this.cosineSimilarity(queryEmbedding, JSON.parse(page.embedding))
        }));

        scored.sort((a, b) => b.score - a.score);
        const results = scored.slice(0, topK).filter(p => p.score >= 0.3);
        if (results.length > 0) return results;
      }
    }

    // Fallback: keyword search
    const words = queryText.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (words.length === 0) return [];

    const allPages = await prisma.wikiPage.findMany();
    const scored = allPages.map(page => {
      const text = (page.title + ' ' + page.content).toLowerCase();
      const matchCount = words.filter(w => text.includes(w)).length;
      return { ...page, score: matchCount / words.length };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).filter(p => p.score > 0);
  }

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

  // ==========================================
  // CHAT → WIKI EXTRACTION
  // ==========================================

  async extractFromChat(userMessage, assistantResponse, conversationTitle, conversationId, options = {}) {
    const settings = await this.getWikiSettings();
    if (!settings.wikiChatExtractionEnabled) {
      return { processed: false, skipped: 'disabled' };
    }

    // Skip trivial messages
    if (!userMessage || userMessage.trim().length < 20) {
      return { processed: true, extracted: 0, pages: [], skipped: 'trivial' };
    }

    const schema = await this.getWikiSchema();
    const existingPages = await this.getAllPages();
    const existingIndex = existingPages.map(p => `- [[${p.slug}]]: ${p.title} (${p.type}/${p.category})`).join('\n');
    const recentMessages = Array.isArray(options.recentMessages) ? options.recentMessages : [];
    const userSnippet = this.buildChatLogSnippet(userMessage);
    const turnLabel = options.userMessageId
      ? `turn #${options.userMessageId}`
      : 'chat turn';
    const recentContext = recentMessages.length > 0
      ? recentMessages.map(msg => {
        const marker = msg.id === options.userMessageId
          ? ' (current user turn)'
          : msg.id === options.assistantMessageId
            ? ' (current assistant turn)'
            : '';
        return `- ${msg.role}${marker}: ${msg.content}`;
      }).join('\n')
      : '';

    // Find pages relevant to this conversation for dedup context
    const relevantPages = await this.findRelevantPages(userMessage, 5);
    const relevantContext = relevantPages.map(p => `### [[${p.slug}]]\n${p.content}`).join('\n\n');

    const prompt = `Analyze the following chat exchange and extract any NEW meaningful information suitable for the personal wiki, including:
  - facts/preferences/goals/habits/opinions about the user
  - durable information about other individuals/entities the conversation references
  - relationship context and recurring patterns

## Existing Wiki Pages
${existingIndex || '(No pages yet)'}

## Relevant Existing Page Content
${relevantContext || '(No relevant pages)'}

## Chat Exchange
**Conversation:** ${conversationTitle}
**User:** ${userMessage}
**Assistant:** ${assistantResponse}

## Nearby Conversation Context
${recentContext || '(No additional nearby context)'}

## Instructions
If the exchange revealed genuinely new wiki-worthy information not already captured in the existing wiki pages above, respond with wiki page updates in this exact JSON format:

\`\`\`json
{
  "updates": [
    {
      "action": "create" | "update",
      "slug": "page-slug",
      "title": "Page Title",
      "type": "entity" | "concept" | "comparison",
      "category": "personal" | "health" | "work" | "interests" | "relationships" | "goals" | "habits" | "media" | "technology" | "finance" | "travel" | "food" | "general",
      "content": "Markdown content to merge (full page or incremental additions)",
      "reason": "Brief explanation of what new information was extracted"
    }
  ]
}
\`\`\`

If NO new personal information was revealed (trivial chat, technical questions, already-known facts), respond with exactly:
\`\`\`json
{"updates": []}
\`\`\`

CRITICAL RULES:
- For "update" actions: provide AUGMENTING content that adds new facts without deleting existing verified information. You may return a full merged page, but it must preserve prior facts.
- NEVER create a page that already exists in the Existing Wiki Pages list. Use "update" instead.
- When an entity/person appears that is not yet represented, create a new entity page for them.
- When an entity/person already exists, update that existing page with new verified details.
- Explicit user preferences are wiki-worthy unless already captured (examples: "I enjoy fantasy", "I like Lord of the Rings", "I prefer...", "my favorite...").
- Use the Nearby Conversation Context to interpret follow-up turns in ongoing conversations, but only extract facts attributable to the user and supported by the current exchange/context.
- Only extract genuinely personal and meaningful information. Do NOT extract:
  - Information already in existing wiki pages
  - Generic knowledge or technical facts
  - Pleasantries or small talk`;

    try {
      const aiResponse = await this.callOllama([
        { role: 'system', content: schema },
        { role: 'user', content: prompt }
      ]);

      let updates = this.parseWikiResponse(aiResponse);
      const hasPreferenceSignal = this.hasStrongPreferenceSignal(userMessage);
      const updatesAreGrounded = this.hasGroundedChatUpdates(userMessage, updates);

      if (hasPreferenceSignal && (!updates.length || !updatesAreGrounded)) {
        const strictPrompt = this.buildStrictChatExtractionPrompt(
          userMessage,
          assistantResponse,
          conversationTitle,
          existingIndex,
          relevantContext
        );

        const strictResponse = await this.callOllama([
          { role: 'system', content: schema },
          { role: 'user', content: strictPrompt }
        ]);

        updates = this.parseWikiResponse(strictResponse);
      }

      if (updates.length === 0 || (hasPreferenceSignal && !this.hasGroundedChatUpdates(userMessage, updates))) {
        updates = this.extractPreferenceFallbackUpdates(userMessage, conversationTitle, existingPages, relevantPages);
      }

      if (updates.length === 0) {
        await this.addLog(
          'chat-extract',
          `No wiki-worthy info from ${turnLabel} in "${conversationTitle}": "${userSnippet}"`,
          'chat',
          conversationId,
          []
        );
        return { processed: true, extracted: 0, pages: [] };
      }

      const affectedSlugs = [];
      for (const update of updates) {
        const slugs = await this.applyWikiUpdate(update, conversationId, 'chat');
        affectedSlugs.push(...slugs);
      }

      if (affectedSlugs.length > 0) {
        await this.addLog(
          'chat-extract',
          `Extracted from ${turnLabel} in "${conversationTitle}": "${userSnippet}" — ${updates.map(u => u.reason || u.slug).join(', ')}`,
          'chat',
          conversationId,
          affectedSlugs
        );
      }

      return { processed: true, extracted: updates.length, pages: affectedSlugs };
    } catch (err) {
      console.error('Wiki chat extraction failed:', err.message);

      try {
        await this.addLog(
          'chat-extract',
          `Failed chat extraction for ${turnLabel} in "${conversationTitle}": "${userSnippet}" — ${err.message}`,
          'chat',
          conversationId,
          []
        );
      } catch (logErr) {
        console.error('Failed to write chat extraction failure log:', logErr.message);
      }

      return { processed: false, error: err.message };
    }
  }

  async backfillChatExtraction(batchSize = 0, options = {}) {
    const rawBatchSize = parseInt(batchSize, 10);
    const normalizedBatchSize = Number.isFinite(rawBatchSize) ? rawBatchSize : 0;
    const processAllUnextracted = normalizedBatchSize <= 0;
    const rawRecent = parseInt(options.reprocessRecent, 10);
    const reprocessRecent = Number.isFinite(rawRecent) ? Math.max(0, Math.min(rawRecent, 50)) : 1;

    // Find user messages not yet extracted
    const unextracted = await prisma.chatMessage.findMany({
      where: {
        wikiExtracted: false,
        role: 'user'
      },
      orderBy: { createdAt: 'asc' },
      take: processAllUnextracted ? undefined : normalizedBatchSize,
      include: {
        conversation: { select: { id: true, title: true } }
      }
    });

    // Optionally reprocess most recent already-extracted user turns.
    // This helps when extraction logic/schema changed, or latest chats were paired incorrectly before.
    let recentExtracted = [];
    if (reprocessRecent > 0) {
      recentExtracted = await prisma.chatMessage.findMany({
        where: {
          wikiExtracted: true,
          role: 'user'
        },
        orderBy: { id: 'desc' },
        take: reprocessRecent,
        include: {
          conversation: { select: { id: true, title: true } }
        }
      });
    }

    const candidateMap = new Map();
    for (const msg of unextracted) {
      candidateMap.set(msg.id, msg);
    }
    for (const msg of recentExtracted) {
      candidateMap.set(msg.id, msg);
    }
    const candidates = Array.from(candidateMap.values()).sort((a, b) => a.id - b.id);

    let processed = 0;
    let withUpdates = 0;
    let noUpdates = 0;
    let failed = 0;
    let skippedNoAssistant = 0;

    for (const msg of candidates) {
      // Find the next assistant response by message order
      const assistantMsg = await prisma.chatMessage.findFirst({
        where: {
          conversationId: msg.conversationId,
          role: 'assistant',
          id: { gt: msg.id }
        },
        orderBy: { id: 'asc' }
      });

      if (!assistantMsg) {
        // Keep for retry: do not mark as extracted without a matching assistant turn.
        skippedNoAssistant++;
        continue;
      }

      const result = await this.extractFromChat(
        msg.content,
        assistantMsg.content,
        msg.conversation.title,
        msg.conversation.id
      );

      // Preserve failed pairs for retry instead of permanently marking as extracted.
      if (result && result.processed === false) {
        failed++;
        continue;
      }

      // Mark both messages as extracted
      await prisma.chatMessage.updateMany({
        where: {
          id: { in: [msg.id, assistantMsg.id] },
          wikiExtracted: false
        },
        data: { wikiExtracted: true }
      });

      processed++;
      if (result?.extracted > 0) {
        withUpdates++;
      } else {
        noUpdates++;
      }
    }

    return {
      processed,
      total: candidates.length,
      processAllUnextracted,
      fromUnextracted: unextracted.length,
      reprocessedRecent: recentExtracted.length,
      withUpdates,
      noUpdates,
      failed,
      skippedNoAssistant
    };
  }

  async resetChatExtractionFlags(options = {}) {
    const {
      conversationId,
      startDate,
      endDate,
      roles = ['user', 'assistant'],
      limit,
      dryRun = true
    } = options;

    const where = {
      wikiExtracted: true,
      role: { in: roles }
    };

    if (conversationId !== undefined && conversationId !== null) {
      where.conversationId = conversationId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const matched = await prisma.chatMessage.count({ where });

    if (dryRun) {
      return {
        dryRun: true,
        matched,
        updated: 0,
        filters: {
          conversationId: conversationId ?? null,
          startDate: startDate || null,
          endDate: endDate || null,
          roles,
          limit: limit || null
        }
      };
    }

    if (limit && limit > 0) {
      const rows = await prisma.chatMessage.findMany({
        where,
        select: { id: true },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      const ids = rows.map(r => r.id);
      if (ids.length === 0) {
        return {
          dryRun: false,
          matched,
          updated: 0,
          filters: {
            conversationId: conversationId ?? null,
            startDate: startDate || null,
            endDate: endDate || null,
            roles,
            limit
          }
        };
      }

      const result = await prisma.chatMessage.updateMany({
        where: { id: { in: ids } },
        data: { wikiExtracted: false }
      });

      return {
        dryRun: false,
        matched,
        updated: result.count,
        filters: {
          conversationId: conversationId ?? null,
          startDate: startDate || null,
          endDate: endDate || null,
          roles,
          limit
        }
      };
    }

    const result = await prisma.chatMessage.updateMany({
      where,
      data: { wikiExtracted: false }
    });

    return {
      dryRun: false,
      matched,
      updated: result.count,
      filters: {
        conversationId: conversationId ?? null,
        startDate: startDate || null,
        endDate: endDate || null,
        roles,
        limit: limit || null
      }
    };
  }

  async getChatExtractionHealth(options = {}) {
    const rawHours = parseInt(options.hours, 10);
    const rawLimit = parseInt(options.limit, 10);
    const hours = Number.isFinite(rawHours) ? Math.min(Math.max(rawHours, 1), 24 * 30) : 24;
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 10), 1000) : 200;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [
      settings,
      recentUserMessages,
      recentAssistantMessages,
      processedUserMessages,
      pendingUserMessages,
      rawLogs
    ] = await Promise.all([
      this.getWikiSettings(),
      prisma.chatMessage.count({
        where: {
          role: 'user',
          createdAt: { gte: since }
        }
      }),
      prisma.chatMessage.count({
        where: {
          role: 'assistant',
          createdAt: { gte: since }
        }
      }),
      prisma.chatMessage.count({
        where: {
          role: 'user',
          wikiExtracted: true,
          createdAt: { gte: since }
        }
      }),
      prisma.chatMessage.count({
        where: {
          role: 'user',
          wikiExtracted: false,
          createdAt: { gte: since }
        }
      }),
      prisma.wikiLog.findMany({
        where: {
          action: 'chat-extract',
          createdAt: { gte: since }
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      })
    ]);

    const logs = rawLogs.map(log => ({
      ...log,
      affectedPages: JSON.parse(log.affectedPages || '[]')
    }));

    let successWithUpdates = 0;
    let successNoUpdates = 0;
    let failed = 0;

    for (const log of logs) {
      const description = (log.description || '').toLowerCase();
      if (description.startsWith('failed') || description.includes('failed chat extraction')) {
        failed++;
      } else if ((log.affectedPages || []).length > 0) {
        successWithUpdates++;
      } else {
        successNoUpdates++;
      }
    }

    return {
      windowHours: hours,
      extractionEnabled: settings.wikiChatExtractionEnabled,
      queue: {
        processedUserMessages,
        pendingUserMessages
      },
      recentMessages: {
        users: recentUserMessages,
        assistants: recentAssistantMessages
      },
      extractionRuns: {
        successWithUpdates,
        successNoUpdates,
        failed,
        totalLoggedRuns: logs.length
      },
      recentLogs: logs.slice(0, 25)
    };
  }

  // ==========================================
  // OPERATION C: LINT
  // ==========================================

  async lintWiki(options = {}) {
    const autoFix = options.autoFix !== false;
    const issues = [];
    const allPages = await prisma.wikiPage.findMany();
    const allSlugs = new Set(allPages.map(p => p.slug));
    const titleSlugMap = new Map();

    for (const page of allPages) {
      if (page?.title) {
        titleSlugMap.set(this.slugifyWikiTarget(page.title), page.slug);
      }
      titleSlugMap.set(this.slugifyWikiTarget(page.slug), page.slug);
    }

    let outboundRebuilt = 0;
    let inboundRebuilt = 0;
    let strippedBrokenLinks = 0;
    let contentPagesUpdated = 0;
    let contentLinksRetargeted = 0;
    let contentLinksUnlinked = 0;

    // Canonical outbound links for lint/fix checks.
    // When auto-fix is enabled, this rebuilds link metadata from page content.
    const canonicalOutboundBySlug = new Map();
    const contentBySlug = new Map();

    for (const page of allPages) {
      const originalContent = page.content || '';
      let workingContent = originalContent;
      if (autoFix) {
        const repaired = this.repairWikiLinksInContent(workingContent, allSlugs, titleSlugMap);
        workingContent = repaired.content;
        contentLinksRetargeted += repaired.retargeted;
        contentLinksUnlinked += repaired.unlinked;
      }
      contentBySlug.set(page.slug, workingContent);

      const storedOutbound = JSON.parse(page.outboundLinks || '[]');
      const extractedFromContent = this.extractWikiLinks(workingContent);
      const uniqueExtracted = [...new Set(extractedFromContent)];

      const validOutbound = uniqueExtracted.filter(slug => allSlugs.has(slug));
      const removedBroken = uniqueExtracted.length - validOutbound.length;
      if (removedBroken > 0) strippedBrokenLinks += removedBroken;

      const canonicalOutbound = autoFix ? validOutbound : storedOutbound;
      canonicalOutboundBySlug.set(page.slug, canonicalOutbound);

      const contentChanged = workingContent !== originalContent;
      const outboundChanged = !this.areStringArraysEqual(storedOutbound, canonicalOutbound);

      if (autoFix && (contentChanged || outboundChanged)) {
        const data = {};
        if (contentChanged) {
          data.content = workingContent;
          contentPagesUpdated++;
        }
        if (outboundChanged) {
          data.outboundLinks = JSON.stringify(canonicalOutbound);
          outboundRebuilt++;
        }

        await prisma.wikiPage.update({
          where: { id: page.id },
          data
        });
      }
    }

    if (autoFix) {
      const inboundBySlug = new Map();
      for (const slug of allSlugs) {
        inboundBySlug.set(slug, []);
      }

      for (const [fromSlug, outbound] of canonicalOutboundBySlug.entries()) {
        for (const targetSlug of outbound) {
          const inbound = inboundBySlug.get(targetSlug);
          if (inbound) inbound.push(fromSlug);
        }
      }

      for (const page of allPages) {
        const storedInbound = JSON.parse(page.inboundLinks || '[]');
        const computedInbound = [...new Set(inboundBySlug.get(page.slug) || [])].sort();

        if (!this.areStringArraysEqual(storedInbound, computedInbound)) {
          await prisma.wikiPage.update({
            where: { id: page.id },
            data: { inboundLinks: JSON.stringify(computedInbound) }
          });
          inboundRebuilt++;
        }
      }
    }

    for (const page of allPages) {
      const outbound = canonicalOutboundBySlug.get(page.slug) || JSON.parse(page.outboundLinks || '[]');
      const inbound = autoFix
        ? allPages
          .map(p => p.slug)
          .filter(slug => (canonicalOutboundBySlug.get(slug) || []).includes(page.slug))
        : JSON.parse(page.inboundLinks || '[]');

      // Check for broken outbound links
      for (const slug of outbound) {
        if (!allSlugs.has(slug)) {
          issues.push({
            type: 'broken-link',
            page: page.slug,
            detail: `Links to non-existent page: [[${slug}]]`
          });
        }
      }

      // Check for orphan pages (no inbound links, not index)
      if (inbound.length === 0 && page.type !== 'index') {
        issues.push({
          type: 'orphan',
          page: page.slug,
          detail: `No other pages link to [[${page.slug}]]`
        });
      }

      // Check for stale pages (not updated in 30+ days)
      const daysSinceUpdate = (Date.now() - new Date(page.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate > 30) {
        issues.push({
          type: 'stale',
          page: page.slug,
          detail: `Not updated in ${Math.floor(daysSinceUpdate)} days`
        });
      }

      // Check for empty content
      const effectiveContent = contentBySlug.get(page.slug) || page.content || '';
      if (!effectiveContent || effectiveContent.trim().length < 10) {
        issues.push({
          type: 'empty',
          page: page.slug,
          detail: 'Page has little or no content'
        });
      }
    }

    const fixes = {
      enabled: autoFix,
      outboundRebuilt,
      inboundRebuilt,
      contentPagesUpdated,
      contentLinksRetargeted,
      contentLinksUnlinked,
      strippedBrokenLinks,
      totalFixed: outboundRebuilt + inboundRebuilt + contentPagesUpdated
    };

    await this.addLog(
      'lint',
      `Lint found ${issues.length} issues across ${allPages.length} pages (fixes: ${fixes.totalFixed}, retargeted links: ${fixes.contentLinksRetargeted}, unlinked: ${fixes.contentLinksUnlinked}, broken links stripped: ${fixes.strippedBrokenLinks})`,
      'lint',
      null,
      []
    );

    return { totalPages: allPages.length, issues, fixes };
  }

  // ==========================================
  // INTERNAL HELPERS
  // ==========================================

  buildIngestionPrompt(noteContent, existingIndex, relevantContext, noteId, sourceType) {
    return `Ingest the following ${sourceType} into the personal wiki. Analyze it for meaningful durable information, including user facts and information about other people/entities mentioned.

## Existing Wiki Pages
${existingIndex || '(No pages yet — you are starting the wiki from scratch)'}

## Relevant Existing Page Content
${relevantContext || '(No relevant pages yet)'}

## Source Content (Note #${noteId})
${noteContent}

## Instructions
Based on this source, respond with wiki page creates/updates in this exact JSON format:

\`\`\`json
{
  "updates": [
    {
      "action": "create" | "update",
      "slug": "page-slug",
      "title": "Page Title",
      "type": "entity" | "concept" | "comparison",
      "category": "personal" | "health" | "work" | "interests" | "relationships" | "goals" | "habits" | "media" | "technology" | "finance" | "travel" | "food" | "general",
      "content": "Markdown content to merge (full page or incremental additions)",
      "reason": "Brief explanation of what was extracted or changed"
    }
  ]
}
\`\`\`

If no meaningful personal information can be extracted, respond with:
\`\`\`json
{"updates": []}
\`\`\`

CRITICAL RULES:
- For "create" actions: provide the FULL page content in Markdown.
- For "update" actions: provide AUGMENTING content that adds new facts without deleting existing verified information. You may return either a full merged page or incremental additions, but avoid duplicate bullets/sections.
- NEVER create a page that already exists in the Existing Wiki Pages list above. Use "update" instead.
- If the source introduces a new person/entity, create a new entity page.
- If the source adds facts about an existing person/entity, update the existing page rather than creating duplicates.
- Always include wiki-links using [[slug]] format when referencing other pages.`;
  }

  buildDatingIngestionPrompt(datingPayload, existingIndex, connectionId) {
    return `Ingest the following dating-section record into the personal wiki. Extract only meaningful, durable personal insights and relationship patterns.

## Existing Wiki Pages
${existingIndex || '(No pages yet — you are starting the wiki from scratch)'}

## Source Content (Dating Connection #${connectionId})
${datingPayload}

## Instructions
Respond with wiki page creates/updates in this exact JSON format:

\`\`\`json
{
  "updates": [
    {
      "action": "create" | "update",
      "slug": "page-slug",
      "title": "Page Title",
      "type": "entity" | "concept" | "comparison",
      "category": "personal" | "health" | "work" | "interests" | "relationships" | "goals" | "habits" | "media" | "technology" | "finance" | "travel" | "food" | "general",
      "content": "Markdown content to merge (full page or incremental additions)",
      "reason": "Brief explanation of what was extracted or changed"
    }
  ]
}
\`\`\`

If no meaningful wiki-worthy information should be added, respond with:
\`\`\`json
{"updates": []}
\`\`\`

CRITICAL RULES:
- Treat the Source Content as authoritative and complete for this connection. Do not ignore sections.
- Ensure extraction considers all available fields, including the About section (bio and notes), profile attributes, dates, encounters, messages, screenshots, and photos metadata.
- Create or update pages for relevant individuals/entities referenced in this record (not just abstract relationship pages).
- Focus on relationship patterns, preferences, boundaries, compatibility signals, communication habits, and recurring themes.
- Avoid explicit sexual detail; keep summaries high-level and respectful.
- For "update" actions: provide augmenting content that preserves existing page facts.
- NEVER create a page that already exists in the Existing Wiki Pages list above. Use "update" instead.
- Include source references in the page Sources section using dating IDs (e.g., connection #${connectionId}, date IDs, encounter IDs, message IDs).`;
  }

  buildStrictDatingIngestionPrompt(datingPayload, existingIndex, connectionId) {
    return `You must decide whether this dating record contains durable wiki-worthy information and respond with JSON only.

## Existing Wiki Pages
${existingIndex || '(No pages yet)'}

## Dating Record (Connection #${connectionId})
${datingPayload}

## Decision Rule
- If the record includes meaningful personal/relationship information (bio, notes, interests, communication patterns, date outcomes, boundaries, compatibility signals, recurring behavior), return at least one update.
- Return {"updates": []} only when the record is effectively empty/noisy and has no durable insight.
- Prefer updating existing relevant pages over creating duplicates.

## Response Format (JSON only)
{
  "updates": [
    {
      "action": "create" | "update",
      "slug": "page-slug",
      "title": "Page Title",
      "type": "entity" | "concept" | "comparison",
      "category": "personal" | "health" | "work" | "interests" | "relationships" | "goals" | "habits" | "media" | "technology" | "finance" | "travel" | "food" | "general",
      "content": "Markdown content to merge",
      "reason": "Brief explanation"
    }
  ]
}`;
  }

  serializeDatingConnection(connection) {
    const payload = {
      connection,
      summary: {
        about: {
          bio: connection.bio || null,
          notes: connection.notes || null
        },
        counts: {
          dates: (connection.dates || []).length,
          encounters: (connection.encounters || []).length,
          messages: (connection.messages || []).length,
          screenshots: (connection.screenshots || []).length,
          photos: (connection.connectionPhotos || []).length
        }
      }
    };

    return JSON.stringify(payload, null, 2);
  }

  hasMeaningfulDatingData(connection) {
    if (!connection) return false;

    const textFields = [
      connection.guyName,
      connection.bio,
      connection.notes,
      connection.interests,
      connection.lookingFor,
      connection.relationshipStatus,
      connection.location,
      connection.openTo,
      connection.theyAre,
      connection.theyAreInto
    ].filter(v => typeof v === 'string' && v.trim().length >= 3);

    const activityCount = (connection.dates || []).length +
      (connection.encounters || []).length +
      (connection.messages || []).length;

    return textFields.length > 0 || activityCount > 0;
  }

  buildDatingFallbackUpdates(connection, existingPages = []) {
    const name = (connection.guyName || `Connection ${connection.id}`).trim();
    const slugBase = this.slugifyWikiTarget(name) || `connection-${connection.id}`;
    const slug = `dating-connection-${connection.id}-${slugBase}`;
    const existingPage = (existingPages || []).find(p => p.slug === slug);

    const facts = [];
    if (connection.bio) facts.push(`- Bio: ${connection.bio}`);
    if (connection.notes) facts.push(`- Notes: ${connection.notes}`);
    if (connection.interests) facts.push(`- Interests: ${connection.interests}`);
    if (connection.lookingFor) facts.push(`- Looking for: ${connection.lookingFor}`);
    if (connection.relationshipStatus) facts.push(`- Relationship status: ${connection.relationshipStatus}`);
    if (connection.location) facts.push(`- Location: ${connection.location}`);

    facts.push(`- Dating app: ${connection.app?.name || `App #${connection.appId}`}`);
    facts.push(`- Messages exchanged: ${connection.messagesExchanged || 0}`);
    facts.push(`- Recorded dates: ${(connection.dates || []).length}`);
    facts.push(`- Recorded encounters: ${(connection.encounters || []).length}`);

    const content = [
      `# ${name}`,
      '',
      '## Dating Profile Summary',
      ...facts,
      '',
      '## Sources',
      `- Dating connection #${connection.id}`,
      '',
      '## Last Updated',
      `- ${new Date().toISOString().slice(0, 10)}`
    ].join('\n');

    return [{
      action: existingPage ? 'update' : 'create',
      slug,
      title: name,
      type: 'entity',
      category: 'relationships',
      content,
      reason: 'Fallback extraction from dating connection metadata'
    }];
  }

  parseWikiResponse(aiResponse) {
    const tryParse = (raw) => {
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.updates)) return parsed.updates;
        return null;
      } catch {
        return null;
      }
    };

    try {
      // Extract JSON from the response (may be wrapped in markdown code blocks)
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)```/) ||
                        aiResponse.match(/```\s*([\s\S]*?)```/) ||
                        [null, aiResponse];
      const jsonStr = jsonMatch[1].trim();
      const parsedUpdates = tryParse(jsonStr);
      if (parsedUpdates) return parsedUpdates;

      // Fallback: if model wrapped JSON with additional text, extract the first JSON object.
      const start = aiResponse.indexOf('{');
      const end = aiResponse.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        const objectStr = aiResponse.slice(start, end + 1).trim();
        const objectUpdates = tryParse(objectStr);
        if (objectUpdates) return objectUpdates;
      }

      return [];
    } catch (err) {
      // Try parsing the whole response as JSON
      try {
        const parsed = JSON.parse(aiResponse.trim());
        return parsed.updates || [];
      } catch {
        console.error('Failed to parse wiki AI response:', err.message);
        return [];
      }
    }
  }

  buildStrictChatExtractionPrompt(userMessage, assistantResponse, conversationTitle, existingIndex, relevantContext) {
    return `You must decide if this chat includes durable personal preferences/interests and return JSON only.

## Existing Wiki Pages
${existingIndex || '(No pages yet)'}

## Relevant Existing Page Content
${relevantContext || '(No relevant pages)'}

## Chat Exchange
**Conversation:** ${conversationTitle}
**User:** ${userMessage}
**Assistant:** ${assistantResponse}

## Decision Rule
- If the user states a durable preference or interest (examples: "I like...", "I enjoy...", "I love...", "I prefer...", "my favorite...", "I hate...", "I dislike..."), you MUST return at least one update unless that exact fact is already present in the relevant existing page content.
- Durable preference statements about activities, foods, media, people, tools, or habits are wiki-worthy and should produce updates when new.
- For user preference statements, do NOT create or update assistant-centric pages/slugs (e.g., assistant-interaction). Target user knowledge pages instead.

## Response Format (JSON only)
{
  "updates": [
    {
      "action": "create" | "update",
      "slug": "page-slug",
      "title": "Page Title",
      "type": "entity" | "concept" | "comparison",
      "category": "personal" | "health" | "work" | "interests" | "relationships" | "goals" | "habits" | "media" | "technology" | "finance" | "travel" | "food" | "general",
      "content": "Markdown content to merge",
      "reason": "Brief explanation"
    }
  ]
}

If and only if there is truly no durable personal information, return exactly:
{"updates": []}`;
  }

  hasStrongPreferenceSignal(userMessage) {
    const text = String(userMessage || '').trim();
    if (!text) return false;

    const preferenceCue = /(\bi\s+(also\s+)?(enjoy|like|love|prefer|hate|dislike)\b|\bmy\s+favorite\b|\bi\s+cant\s+stand\b|\bi\s+cannot\s+stand\b)/i;
    const tinyOrNonDurable = /^\s*(thanks|ok|okay|cool|nice|got it|hello|hi|hey)[.!?\s]*$/i;

    return preferenceCue.test(text) && !tinyOrNonDurable.test(text);
  }

  hasGroundedChatUpdates(userMessage, updates = []) {
    if (!Array.isArray(updates) || updates.length === 0) return false;

    const userTokens = this.extractGroundingTokens(userMessage);
    if (userTokens.length === 0) return true;

    const disallowedSlugs = new Set(['assistant-interaction', 'assistant-preferences', 'chat-assistant']);

    for (const update of updates) {
      const slug = String(update?.slug || '').toLowerCase();
      if (disallowedSlugs.has(slug)) {
        continue;
      }

      const haystack = [
        update?.slug || '',
        update?.title || '',
        update?.reason || '',
        update?.content || ''
      ].join(' ').toLowerCase();

      const tokenOverlap = userTokens.some(token => haystack.includes(token));
      const looksLikeUserPrefs = /(preference|favorite|likes|dislikes|interests|color|board\s+game|games?)/i.test(haystack);

      if (tokenOverlap || looksLikeUserPrefs) {
        return true;
      }
    }

    return false;
  }

  extractGroundingTokens(text) {
    return [...new Set(
      String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(token => token.length >= 4)
        .filter(token => ![
          'always', 'prefer', 'favorite', 'color', 'board', 'games', 'playing', 'with', 'that', 'this', 'from', 'have'
        ].includes(token))
    )];
  }

  buildChatLogSnippet(text, maxLen = 90) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '(empty message)';
    if (normalized.length <= maxLen) return normalized;
    return `${normalized.slice(0, maxLen - 3)}...`;
  }

  extractPreferenceFallbackUpdates(userMessage, conversationTitle, existingPages, relevantPages) {
    const text = (userMessage || '').trim();
    if (!text) return [];

    const preferenceCue = /(\bi\s+(also\s+)?(enjoy|like|love|prefer|hate|dislike)\b|\bmy\s+favorite\b|\bi\s+cant\s+stand\b|\bi\s+cannot\s+stand\b)/i.test(text);
    if (!preferenceCue) return [];
    const relevantCorpus = (relevantPages || []).map(p => `${p.title || ''}\n${p.content || ''}`).join('\n').toLowerCase();

    const newFacts = [];

    // Generic durable preference extraction from explicit like/love/enjoy/prefer/hate/dislike statements.
    const preferencePhrases = this.extractPreferencePhrases(text);
    for (const pref of preferencePhrases) {
      const normalized = this.normalizeForMerge(pref.fact.replace(/^-\s*/, ''));
      if (normalized && !this.normalizeForMerge(relevantCorpus).includes(normalized)) {
        newFacts.push(pref.fact);
      }
    }

    if (newFacts.length === 0) return [];

    const target = this.selectGenericPreferencePage(existingPages);

    const content = [
      '## Preferences',
      ...[...new Set(newFacts)],
      `- Source context: ${conversationTitle}`
    ].join('\n');

    return [{
      action: target.exists ? 'update' : 'create',
      slug: target.slug,
      title: target.title,
      type: 'concept',
      category: 'interests',
      content,
      reason: 'Extracted explicit user preferences/dislikes from chat message'
    }];
  }

  selectGenericPreferencePage(existingPages = []) {
    const pages = Array.isArray(existingPages) ? existingPages : [];

    const exactSlug = pages.find(p => p.slug === 'personal-preferences');
    if (exactSlug) {
      return { exists: true, slug: exactSlug.slug, title: exactSlug.title || 'Personal Preferences' };
    }

    const reusable = pages.find(p => /preference|taste|interests?/i.test(`${p.slug || ''} ${p.title || ''}`));
    if (reusable) {
      return { exists: true, slug: reusable.slug, title: reusable.title || 'Personal Preferences' };
    }

    return {
      exists: false,
      slug: 'personal-preferences',
      title: 'Personal Preferences'
    };
  }

  extractPreferencePhrases(text) {
    const phrases = [];
    const sentenceCandidates = String(text || '')
      .split(/[.!?\n]+/)
      .map(s => s.trim())
      .filter(Boolean);

    for (const sentence of sentenceCandidates) {
      let match = sentence.match(/^i\s+(?:(?:also|always|usually|generally|often)\s+)?(like|love|enjoy|prefer)\s+(?:to\s+)?(.+)$/i);
      if (match) {
        const item = this.cleanPreferenceTail(match[2]);
        if (item) {
          const gerund = this.gerundify(item);
          const fact = gerund
            ? `- Likes ${gerund}.`
            : `- Likes ${this.humanizePreference(item)}.`;
          phrases.push({ fact });
          continue;
        }
      }

      match = sentence.match(/^i\s+(?:really\s+)?(hate|dislike)\s+(.+)$/i);
      if (match) {
        const item = this.cleanPreferenceTail(match[2]);
        if (item) {
          phrases.push({ fact: `- Dislikes ${this.humanizePreference(item)}.` });
          continue;
        }
      }

      match = sentence.match(/^my\s+favorite\s+(.+)$/i);
      if (match) {
        const item = this.cleanPreferenceTail(match[1]);
        if (item) {
          const colorMatch = item.match(/^color\s+is\s+(.+)$/i);
          if (colorMatch) {
            phrases.push({ fact: `- Favorite color: ${this.humanizePreference(colorMatch[1])}.` });
          } else {
            phrases.push({ fact: `- Favorite: ${this.humanizePreference(item)}.` });
          }
        }
      }
    }

    return phrases;
  }

  cleanPreferenceTail(value) {
    return String(value || '')
      .replace(/^(the|a|an)\s+/i, '')
      .replace(/\s+/g, ' ')
      .replace(/[,:;]+$/g, '')
      .trim();
  }

  gerundify(value) {
    const cleaned = String(value || '').trim().toLowerCase();
    const word = cleaned.split(/\s+/)[0];
    const gerundMap = {
      cook: 'cooking',
      read: 'reading',
      run: 'running',
      swim: 'swimming',
      hike: 'hiking',
      write: 'writing'
    };

    if (gerundMap[word]) {
      const remainder = cleaned.split(/\s+/).slice(1).join(' ');
      return [gerundMap[word], remainder].filter(Boolean).join(' ').trim();
    }

    return null;
  }

  humanizePreference(value) {
    const cleaned = String(value || '').trim();
    if (!cleaned) return cleaned;
    return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
  }

  async applyWikiUpdate(update, sourceId, sourceType) {
    const affectedSlugs = [];

    if (!update.slug || !update.action) return affectedSlugs;

    const existing = await this.getPage(update.slug);

    const wantsCreate = update.action === 'create';
    const wantsUpdate = update.action === 'update';

    // Treat "update on missing page" as create to avoid dropping valid ingestion output.
    if ((wantsCreate && !existing) || (wantsUpdate && !existing)) {
      // Create new page
      const outboundLinks = this.extractWikiLinks(update.content || '');
      const noteIds = sourceType === 'note' || sourceType === 'daily_note' ? [sourceId] : [];
      const chatIds = sourceType === 'chat' ? [sourceId] : [];

      await this.createPage({
        slug: update.slug,
        title: update.title || update.slug,
        content: update.content || '',
        type: update.type || 'concept',
        category: update.category || 'general',
        outboundLinks: JSON.stringify(outboundLinks),
        sourceNoteIds: JSON.stringify(noteIds),
        sourceChatIds: JSON.stringify(chatIds)
      });
      affectedSlugs.push(update.slug);

      // Update inbound links on referenced pages
      await this.updateInboundLinks(update.slug, outboundLinks);
    } else if (existing) {
      // Update existing page (both "update" action and "create" on existing page)
      // Merge safely so partial AI updates augment instead of clobbering existing page content.
      const newContent = this.mergeWikiContent(existing.content, update.content, update.title || existing.title);

      // Safety: skip if the content is identical (no actual change)
      if (newContent.trim() === existing.content.trim()) {
        return affectedSlugs;
      }

      const outboundLinks = this.extractWikiLinks(newContent);

      // Update source tracking
      const existingNoteIds = JSON.parse(existing.sourceNoteIds || '[]');
      const existingChatIds = JSON.parse(existing.sourceChatIds || '[]');
      if ((sourceType === 'note' || sourceType === 'daily_note') && !existingNoteIds.includes(sourceId)) {
        existingNoteIds.push(sourceId);
      }
      if (sourceType === 'chat' && !existingChatIds.includes(sourceId)) {
        existingChatIds.push(sourceId);
      }

      await this.updatePage(update.slug, {
        content: newContent,
        type: update.type || existing.type,
        category: update.category || existing.category,
        outboundLinks: JSON.stringify(outboundLinks),
        sourceNoteIds: JSON.stringify(existingNoteIds),
        sourceChatIds: JSON.stringify(existingChatIds)
      });
      affectedSlugs.push(update.slug);

      await this.updateInboundLinks(update.slug, outboundLinks);
    }

    return affectedSlugs;
  }

  extractWikiLinks(content) {
    const matches = content.match(/\[\[([^\]]+)\]\]/g) || [];
    return [...new Set(matches
      .map(m => m.replace(/\[\[|\]\]/g, '').trim())
      .map(link => link.split('|')[0].trim())
      .filter(Boolean))];
  }

  repairWikiLinksInContent(content, allSlugs, titleSlugMap) {
    if (!content) {
      return { content: content || '', retargeted: 0, unlinked: 0 };
    }

    let retargeted = 0;
    let unlinked = 0;

    const repairedContent = content.replace(/\[\[([^\]]+)\]\]/g, (_full, rawTarget) => {
      const raw = String(rawTarget || '').trim();
      if (!raw) return _full;

      const parts = raw.split('|');
      const linkTarget = (parts[0] || '').trim();
      const alias = parts.length > 1 ? parts.slice(1).join('|').trim() : '';

      if (allSlugs.has(linkTarget)) {
        return alias ? `[[${linkTarget}|${alias}]]` : `[[${linkTarget}]]`;
      }

      const normalized = this.slugifyWikiTarget(linkTarget);
      const resolvedSlug = titleSlugMap.get(normalized);
      if (resolvedSlug && allSlugs.has(resolvedSlug)) {
        retargeted++;
        return alias ? `[[${resolvedSlug}|${alias}]]` : `[[${resolvedSlug}]]`;
      }

      unlinked++;
      return alias || linkTarget;
    });

    return {
      content: repairedContent,
      retargeted,
      unlinked
    };
  }

  mergeWikiContent(existingContent, incomingContent, title = 'Wiki Page') {
    const existing = (existingContent || '').trim();
    const incoming = (incomingContent || '').trim();

    if (!incoming) return existing;
    if (!existing) return incoming;

    const normalizedExisting = this.normalizeForMerge(existing);
    const normalizedIncoming = this.normalizeForMerge(incoming);

    if (normalizedExisting === normalizedIncoming) return existing;

    const incomingLooksFullPage = incoming.startsWith('# ');
    const incomingIsReasonablySized = incoming.length >= Math.floor(existing.length * 0.75);
    if (incomingLooksFullPage && incomingIsReasonablySized) {
      return incoming;
    }

    const resolvedSectionMerge = this.mergeResolvedSections(existing, incoming, title);
    if (resolvedSectionMerge) {
      return resolvedSectionMerge;
    }

    const existingLines = existing.split(/\r?\n/);
    const existingLineSet = new Set(
      existingLines
        .map(line => this.normalizeForMerge(line))
        .filter(Boolean)
    );

    const incomingLines = incoming
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    const uniqueIncomingLines = incomingLines.filter(line => {
      const normalized = this.normalizeForMerge(line);
      return normalized && !existingLineSet.has(normalized);
    });

    if (uniqueIncomingLines.length === 0) {
      return existing;
    }

    const insertionIndex = this.findMergeInsertionIndex(existingLines);
    const mergedLines = [...existingLines];
    const spacer = mergedLines[insertionIndex - 1]?.trim() === '' ? [] : [''];

    mergedLines.splice(
      insertionIndex,
      0,
      ...spacer,
      '## Chat Additions',
      ...uniqueIncomingLines,
      ''
    );

    if (!mergedLines[0]?.startsWith('# ')) {
      mergedLines.unshift(`# ${title}`, '');
    }

    return mergedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  mergeResolvedSections(existingContent, incomingContent, title = 'Wiki Page') {
    const existingLines = (existingContent || '').split(/\r?\n/);
    const incomingLines = (incomingContent || '').split(/\r?\n/).map(line => line.replace(/\s+$/g, ''));

    const incomingSections = this.extractMarkdownSections(incomingLines);
    if (incomingSections.length === 0) return null;

    let workingLines = [...existingLines];
    let changed = false;

    for (const incomingSection of incomingSections) {
      const resolved = this.findResolvableSectionMatch(workingLines, incomingSection);
      if (!resolved) continue;

      const replacementBlock = incomingSection.lines.length > 0
        ? [...incomingSection.lines]
        : [incomingSection.headingLine];

      workingLines.splice(
        resolved.startIndex,
        resolved.endIndex - resolved.startIndex,
        ...replacementBlock
      );
      changed = true;
    }

    if (!changed) return null;

    const merged = workingLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!merged.startsWith('# ')) {
      return `# ${title}\n\n${merged}`.trim();
    }
    return merged;
  }

  extractMarkdownSections(lines = []) {
    const sections = [];
    let current = null;

    for (const line of lines) {
      const heading = line.match(/^(#{2,6})\s+(.*)$/);
      if (heading) {
        if (current) sections.push(current);
        current = {
          headingLine: line,
          level: heading[1].length,
          title: heading[2].trim(),
          lines: [line]
        };
        continue;
      }

      if (current) {
        current.lines.push(line);
      }
    }

    if (current) sections.push(current);
    return sections;
  }

  findResolvableSectionMatch(lines, incomingSection) {
    const incomingBase = this.normalizeSectionTitle(incomingSection.title);
    if (!incomingBase) return null;

    const headings = [];
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(#{2,6})\s+(.*)$/);
      if (!match) continue;

      headings.push({
        index: i,
        level: match[1].length,
        title: match[2].trim(),
        base: this.normalizeSectionTitle(match[2].trim()),
        isPending: /\(pending\)/i.test(match[2]),
        isDefinitive: /\(definitive\)|\(resolved\)|\(final\)/i.test(match[2])
      });
    }

    const exactHeading = headings.find(h => h.base === incomingBase && h.isPending);
    if (exactHeading) {
      const endIndex = this.findSectionEndIndex(lines, exactHeading.index, exactHeading.level);
      return { startIndex: exactHeading.index, endIndex };
    }

    const relatedPending = headings.find(h => h.base === incomingBase && h.isPending);
    if (relatedPending) {
      const endIndex = this.findSectionEndIndex(lines, relatedPending.index, relatedPending.level);
      return { startIndex: relatedPending.index, endIndex };
    }

    const sameBase = headings.find(h => h.base === incomingBase);
    if (sameBase && incomingSection.title && /\b(definitive|resolved|final)\b/i.test(incomingSection.title)) {
      const endIndex = this.findSectionEndIndex(lines, sameBase.index, sameBase.level);
      return { startIndex: sameBase.index, endIndex };
    }

    return null;
  }

  findSectionEndIndex(lines, startIndex, level) {
    for (let i = startIndex + 1; i < lines.length; i++) {
      const match = lines[i].match(/^(#{2,6})\s+(.*)$/);
      if (match && match[1].length <= level) {
        return i;
      }
    }
    return lines.length;
  }

  normalizeSectionTitle(title) {
    return this.normalizeForMerge(String(title || '')
      .replace(/\((pending|definitive|resolved|final|updated|current)\)/ig, '')
      .replace(/[:\-–—]\s*(pending|definitive|resolved|final|updated|current)\b/ig, '')
      .replace(/\b(pending|definitive|resolved|final|updated|current)\b/ig, '')
      .replace(/\s+/g, ' ')
      .trim());
  }

  findMergeInsertionIndex(lines) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().toLowerCase();
      if (line === '## sources' || line === '## last updated') {
        return i;
      }
    }
    return lines.length;
  }

  normalizeForMerge(value) {
    return (value || '')
      .toLowerCase()
      .replace(/\r/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  areStringArraysEqual(a = [], b = []) {
    if (a.length !== b.length) return false;

    const left = [...a].map(String).sort();
    const right = [...b].map(String).sort();
    for (let i = 0; i < left.length; i++) {
      if (left[i] !== right[i]) return false;
    }

    return true;
  }

  slugifyWikiTarget(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async updateInboundLinks(fromSlug, targetSlugs) {
    for (const targetSlug of targetSlugs) {
      const targetPage = await this.getPage(targetSlug);
      if (targetPage) {
        const inbound = JSON.parse(targetPage.inboundLinks || '[]');
        if (!inbound.includes(fromSlug)) {
          inbound.push(fromSlug);
          await prisma.wikiPage.update({
            where: { slug: targetSlug },
            data: { inboundLinks: JSON.stringify(inbound) }
          });
        }
      }
    }
  }
}

module.exports = WikiService;
