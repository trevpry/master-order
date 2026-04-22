const prisma = require('../prismaClient');

// Default Layer 3 Schema - instructs the AI on wiki maintenance
const DEFAULT_WIKI_SCHEMA = `
# Personal Wiki Schema (Layer 3)

## Purpose
You are maintaining a personal knowledge wiki about the user. Your job is to synthesize raw information from notes, daily journals, chat conversations, and dating-section data into structured, interlinked Markdown wiki pages.

## Page Types
- **entity**: Wikipedia-style pages for people, places, tools, companies, media the user interacts with
- **concept**: Synthesized topic pages — habits, goals, interests, recurring themes, opinions
- **comparison**: Side-by-side analysis pages when the user evaluates options
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

## What NOT to Extract
- Trivial small talk with no personal information
- Purely technical questions with no personal context (e.g., "How do I sort an array?")
- Information already captured in existing wiki pages (deduplication)

## Update Rules
- When new info CONFIRMS existing info, strengthen the claim (no change needed)
- When new info CONTRADICTS existing info, add a contradiction blockquote with dates
- When new info EXTENDS existing info, append to the relevant section
- Always update the "Sources" and "Last Updated" sections
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
        app: { select: { name: true } },
        dates: {
          orderBy: { dateTime: 'desc' },
          take: 5,
          select: {
            id: true,
            dateTime: true,
            location: true,
            activity: true,
            rating: true,
            chemistry: true,
            attraction: true,
            outcome: true,
            secondDate: true,
            notes: true
          }
        },
        encounters: {
          orderBy: { dateTime: 'desc' },
          take: 5,
          select: {
            id: true,
            dateTime: true,
            type: true,
            location: true,
            satisfaction: true,
            chemistry: true,
            protection: true,
            tested: true,
            notes: true
          }
        },
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 15,
          select: {
            id: true,
            timestamp: true,
            sender: true,
            content: true,
            platform: true
          }
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

        const updates = this.parseWikiResponse(aiResponse);
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

  async extractFromChat(userMessage, assistantResponse, conversationTitle, conversationId) {
    const settings = await this.getWikiSettings();
    if (!settings.wikiChatExtractionEnabled) return null;

    // Skip trivial messages
    if (!userMessage || userMessage.trim().length < 20) return null;

    const schema = await this.getWikiSchema();
    const existingPages = await this.getAllPages();
    const existingIndex = existingPages.map(p => `- [[${p.slug}]]: ${p.title} (${p.type}/${p.category})`).join('\n');

    // Find pages relevant to this conversation for dedup context
    const relevantPages = await this.findRelevantPages(userMessage, 5);
    const relevantContext = relevantPages.map(p => `### [[${p.slug}]]\n${p.content}`).join('\n\n');

    const prompt = `Analyze the following chat exchange and extract any NEW personal facts, preferences, goals, habits, opinions, biographical details, or other meaningful personal information the user revealed.

## Existing Wiki Pages
${existingIndex || '(No pages yet)'}

## Relevant Existing Page Content
${relevantContext || '(No relevant pages)'}

## Chat Exchange
**Conversation:** ${conversationTitle}
**User:** ${userMessage}
**Assistant:** ${assistantResponse}

## Instructions
If the user revealed genuinely new personal information not already captured in the existing wiki pages above, respond with wiki page updates in this exact JSON format:

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
- Only extract genuinely personal and meaningful information. Do NOT extract:
  - Information already in existing wiki pages
  - Generic knowledge or technical facts
  - Pleasantries or small talk`;

    try {
      const aiResponse = await this.callOllama([
        { role: 'system', content: schema },
        { role: 'user', content: prompt }
      ]);

      const updates = this.parseWikiResponse(aiResponse);
      if (updates.length === 0) return null;

      const affectedSlugs = [];
      for (const update of updates) {
        const slugs = await this.applyWikiUpdate(update, conversationId, 'chat');
        affectedSlugs.push(...slugs);
      }

      if (affectedSlugs.length > 0) {
        await this.addLog(
          'chat-extract',
          `Extracted from chat: "${conversationTitle}" — ${updates.map(u => u.reason || u.slug).join(', ')}`,
          'chat',
          conversationId,
          affectedSlugs
        );
      }

      return { extracted: updates.length, pages: affectedSlugs };
    } catch (err) {
      console.error('Wiki chat extraction failed:', err.message);
      return null;
    }
  }

  async backfillChatExtraction(batchSize = 20) {
    // Find user messages not yet extracted
    const unextracted = await prisma.chatMessage.findMany({
      where: {
        wikiExtracted: false,
        role: 'user'
      },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
      include: {
        conversation: { select: { id: true, title: true } }
      }
    });

    let processed = 0;
    for (const msg of unextracted) {
      // Find the next assistant response
      const assistantMsg = await prisma.chatMessage.findFirst({
        where: {
          conversationId: msg.conversationId,
          role: 'assistant',
          createdAt: { gt: msg.createdAt }
        },
        orderBy: { createdAt: 'asc' }
      });

      if (assistantMsg) {
        await this.extractFromChat(
          msg.content,
          assistantMsg.content,
          msg.conversation.title,
          msg.conversation.id
        );
      }

      // Mark both messages as extracted
      await prisma.chatMessage.update({
        where: { id: msg.id },
        data: { wikiExtracted: true }
      });
      if (assistantMsg) {
        await prisma.chatMessage.update({
          where: { id: assistantMsg.id },
          data: { wikiExtracted: true }
        });
      }

      processed++;
    }

    return { processed, total: unextracted.length };
  }

  // ==========================================
  // OPERATION C: LINT
  // ==========================================

  async lintWiki() {
    const issues = [];
    const allPages = await prisma.wikiPage.findMany();
    const allSlugs = new Set(allPages.map(p => p.slug));

    for (const page of allPages) {
      const outbound = JSON.parse(page.outboundLinks || '[]');
      const inbound = JSON.parse(page.inboundLinks || '[]');

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
      if (!page.content || page.content.trim().length < 10) {
        issues.push({
          type: 'empty',
          page: page.slug,
          detail: 'Page has little or no content'
        });
      }
    }

    await this.addLog('lint', `Lint found ${issues.length} issues across ${allPages.length} pages`, 'lint', null, []);

    return { totalPages: allPages.length, issues };
  }

  // ==========================================
  // INTERNAL HELPERS
  // ==========================================

  buildIngestionPrompt(noteContent, existingIndex, relevantContext, noteId, sourceType) {
    return `Ingest the following ${sourceType} into the personal wiki. Analyze it for personal facts, preferences, goals, habits, opinions, and any other meaningful personal information.

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
- Focus on relationship patterns, preferences, boundaries, compatibility signals, communication habits, and recurring themes.
- Avoid explicit sexual detail; keep summaries high-level and respectful.
- For "update" actions: provide augmenting content that preserves existing page facts.
- NEVER create a page that already exists in the Existing Wiki Pages list above. Use "update" instead.
- Include source references in the page Sources section using dating IDs (e.g., connection #${connectionId}, date IDs, encounter IDs, message IDs).`;
  }

  serializeDatingConnection(connection) {
    const safeMessages = (connection.messages || []).map(m => ({
      id: m.id,
      timestamp: m.timestamp,
      sender: m.sender,
      platform: m.platform,
      content: (m.content || '').substring(0, 400)
    }));

    const payload = {
      connection: {
        id: connection.id,
        app: connection.app?.name,
        guyName: connection.guyName,
        age: connection.age,
        location: connection.location,
        status: connection.status,
        firstContact: connection.firstContact,
        lastContact: connection.lastContact,
        responseRate: connection.responseRate,
        avgResponseTime: connection.avgResponseTime,
        relationshipStatus: connection.relationshipStatus,
        lookingFor: connection.lookingFor,
        openTo: connection.openTo,
        interests: connection.interests,
        notes: connection.notes,
        messagesExchanged: connection.messagesExchanged,
        updatedAt: connection.updatedAt
      },
      recentDates: connection.dates || [],
      recentEncounters: connection.encounters || [],
      recentMessages: safeMessages
    };

    return JSON.stringify(payload, null, 2);
  }

  parseWikiResponse(aiResponse) {
    try {
      // Extract JSON from the response (may be wrapped in markdown code blocks)
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)```/) ||
                        aiResponse.match(/```\s*([\s\S]*?)```/) ||
                        [null, aiResponse];
      const jsonStr = jsonMatch[1].trim();
      const parsed = JSON.parse(jsonStr);
      return parsed.updates || [];
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

  async applyWikiUpdate(update, sourceId, sourceType) {
    const affectedSlugs = [];

    if (!update.slug || !update.action) return affectedSlugs;

    const existing = await this.getPage(update.slug);

    if (update.action === 'create' && !existing) {
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
    return [...new Set(matches.map(m => m.replace(/\[\[|\]\]/g, '')))];
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
