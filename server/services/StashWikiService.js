const prisma = require('../prismaClient');

const STASH_WIKI_SCHEMA = `
# Stash Tag Wiki Schema

## Purpose
You are maintaining a wiki that documents tags used in a media tagging system. Each tag describes a category, action, attribute, position, or theme applied to adult media scenes. Your job is to produce clear, factual descriptions and map relationships between tags.

## Page Format
Every page represents one tag (or a group/index page). Pages use Markdown with wiki-links.

1. Start with: # Tag Name
2. A concise 1-3 sentence description of what this tag means in the context of media tagging
3. A "## Relationships" section listing related tags with [[slug]] links and brief explanations of how they relate (parent/child, similar, opposite, often co-occurs, subset-of, etc.)
4. A "## Usage Notes" section with guidance on when to apply this tag vs similar tags
5. Optionally a "## Aliases" section if the tag has known alternate names

## Slug Convention
- Lowercase, hyphenated version of the tag name: "oral-sex", "blonde-hair", "outdoor"
- Use the exact tag name as basis, replacing spaces and special characters with hyphens

## Relationship Types
- **parent**: This tag is a broader category (e.g., "oral" is parent of "blowjob")
- **child**: This tag is a more specific form
- **similar**: Closely related but distinct tags
- **opposite**: Contrasting tag
- **co-occurs**: Tags frequently used together
- **subset**: One tag implies the other

## Rules
- Be factual and clinical in descriptions — this is a reference document
- Describe what the tag represents, not opinions
- Use [[slug]] wiki-links when referencing other tags
- Keep descriptions concise but complete
- Flag ambiguous tags that might be confused with others
`;

class StashWikiService {
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
      signal: AbortSignal.timeout(300000)
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
        signal: AbortSignal.timeout(60000)
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.embeddings?.[0] || null;
    } catch (err) {
      console.error('Stash wiki embedding failed:', err.message);
      return null;
    }
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
  // PAGE CRUD
  // ==========================================

  async getAllPages(filters = {}) {
    const where = {};
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search } },
        { content: { contains: filters.search } }
      ];
    }
    if (filters.hasTag !== undefined) {
      if (filters.hasTag) {
        where.tagId = { not: null };
      } else {
        where.tagId = null;
      }
    }

    return prisma.stashWikiPage.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        tagId: true,
        updatedAt: true,
        createdAt: true
      }
    });
  }

  async getPage(slug) {
    return prisma.stashWikiPage.findUnique({ where: { slug } });
  }

  async getPageByTagId(tagId) {
    return prisma.stashWikiPage.findFirst({ where: { tagId } });
  }

  async createPage(data) {
    const page = await prisma.stashWikiPage.create({ data });
    this.generateEmbedding(data.title + '\n' + data.content).then(async (embedding) => {
      if (embedding) {
        await prisma.stashWikiPage.update({
          where: { id: page.id },
          data: { embedding: JSON.stringify(embedding) }
        });
      }
    }).catch(err => console.error('Stash wiki embedding error:', err.message));
    return page;
  }

  async updatePage(slug, data) {
    const page = await prisma.stashWikiPage.update({
      where: { slug },
      data: { ...data, updatedAt: new Date() }
    });
    const content = data.content || page.content;
    const title = data.title || page.title;
    this.generateEmbedding(title + '\n' + content).then(async (embedding) => {
      if (embedding) {
        await prisma.stashWikiPage.update({
          where: { id: page.id },
          data: { embedding: JSON.stringify(embedding) }
        });
      }
    }).catch(err => console.error('Stash wiki embedding error:', err.message));
    return page;
  }

  async deletePage(slug) {
    // Clean up inbound links on other pages
    const page = await this.getPage(slug);
    if (page) {
      const outbound = JSON.parse(page.outboundLinks || '[]');
      for (const targetSlug of outbound) {
        const target = await this.getPage(targetSlug);
        if (target) {
          const inbound = JSON.parse(target.inboundLinks || '[]').filter(s => s !== slug);
          await prisma.stashWikiPage.update({
            where: { slug: targetSlug },
            data: { inboundLinks: JSON.stringify(inbound) }
          });
        }
      }
    }
    return prisma.stashWikiPage.delete({ where: { slug } });
  }

  // ==========================================
  // LOGGING
  // ==========================================

  async addLog(action, description, sourceType = 'tag', sourceId = null, affectedPages = []) {
    return prisma.stashWikiLog.create({
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
    const logs = await prisma.stashWikiLog.findMany({
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
    const totalPages = await prisma.stashWikiPage.count();
    const totalTags = await prisma.stashTag.count();
    const pagesWithTags = await prisma.stashWikiPage.count({ where: { tagId: { not: null } } });
    const recentLogs = await prisma.stashWikiLog.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
    });

    return {
      totalPages,
      totalTags,
      pagesWithTags,
      tagsWithoutPages: totalTags - pagesWithTags,
      recentActivity: recentLogs
    };
  }

  // ==========================================
  // TAG INGESTION — Generate wiki from tags
  // ==========================================

  async generateFromTags(tagIds = null) {
    // Get tags to process
    let tags;
    if (tagIds && tagIds.length > 0) {
      tags = await prisma.stashTag.findMany({
        where: { id: { in: tagIds } },
        include: {
          parentTags: { include: { parentTag: true } },
          childTags: { include: { childTag: true } },
          aliases: true
        }
      });
    } else {
      // Get all tags that don't have wiki pages yet
      const existingPages = await prisma.stashWikiPage.findMany({
        where: { tagId: { not: null } },
        select: { tagId: true }
      });
      const existingTagIds = new Set(existingPages.map(p => p.tagId));

      tags = await prisma.stashTag.findMany({
        where: { id: { notIn: [...existingTagIds] } },
        include: {
          parentTags: { include: { parentTag: true } },
          childTags: { include: { childTag: true } },
          aliases: true
        }
      });
    }

    if (tags.length === 0) return { processed: 0, pages: [] };

    // Get existing wiki page index for context
    const existingPages = await this.getAllPages();
    const existingIndex = existingPages.map(p => `- [[${p.slug}]]: ${p.title}`).join('\n');

    const affectedSlugs = [];
    let processed = 0;

    // Process in batches of 10 to provide good context
    for (let i = 0; i < tags.length; i += 10) {
      const batch = tags.slice(i, i + 10);
      
      try {
        const batchContent = batch.map(tag => {
          const parents = tag.parentTags?.map(pt => pt.parentTag?.name).filter(Boolean) || [];
          const children = tag.childTags?.map(ct => ct.childTag?.name).filter(Boolean) || [];
          const aliases = tag.aliases?.map(a => a.alias).filter(Boolean) || [];

          let entry = `Tag: "${tag.name}"`;
          if (tag.description) entry += `\nExisting Description: ${tag.description}`;
          if (parents.length) entry += `\nParent Tags: ${parents.join(', ')}`;
          if (children.length) entry += `\nChild Tags: ${children.join(', ')}`;
          if (aliases.length) entry += `\nAliases: ${aliases.join(', ')}`;
          return entry;
        }).join('\n\n---\n\n');

        const prompt = `Generate wiki pages for the following tags. For each tag, create a structured wiki page with a description, relationships, and usage notes.

## Existing Wiki Pages
${existingIndex || '(No pages yet — you are starting the wiki from scratch)'}

## Tags to Process
${batchContent}

## Instructions
Respond with wiki page data in this exact JSON format:

\`\`\`json
{
  "updates": [
    {
      "action": "create",
      "slug": "tag-name-as-slug",
      "title": "Tag Name",
      "tagName": "exact tag name from input",
      "content": "Full markdown page content",
      "relatedSlugs": ["related-tag-1", "related-tag-2"]
    }
  ]
}
\`\`\`

CRITICAL RULES:
- Create one page per tag
- The slug must be a lowercase, hyphenated version of the tag name
- Include [[slug]] wiki-links in the content when referencing other tags
- The "relatedSlugs" array should list slugs of tags mentioned in the content
- Be clinical and factual — these are reference descriptions
- If a tag's meaning is ambiguous, describe the most likely interpretation and note alternatives`;

        const aiResponse = await this.callOllama([
          { role: 'system', content: STASH_WIKI_SCHEMA },
          { role: 'user', content: prompt }
        ]);

        const updates = this.parseWikiResponse(aiResponse);
        
        for (const update of updates) {
          // Find the matching tag by name
          const matchingTag = batch.find(t => 
            t.name.toLowerCase() === update.tagName?.toLowerCase() ||
            this.slugify(t.name) === update.slug
          );

          if (matchingTag) {
            const slug = update.slug || this.slugify(matchingTag.name);
            const existing = await this.getPage(slug);

            if (!existing) {
              const outboundLinks = this.extractWikiLinks(update.content || '');
              await this.createPage({
                slug,
                title: update.title || matchingTag.name,
                content: update.content || '',
                tagId: matchingTag.id,
                relatedTagIds: JSON.stringify(update.relatedSlugs || []),
                outboundLinks: JSON.stringify(outboundLinks)
              });
              affectedSlugs.push(slug);
              await this.updateInboundLinks(slug, outboundLinks);
            }
          }
        }

        processed += batch.length;
        console.log(`📚 Stash Wiki: Processed ${processed}/${tags.length} tags`);
      } catch (err) {
        console.error(`Stash wiki generation failed for batch starting at ${i}:`, err.message);
        await this.addLog('generate', `Failed batch at index ${i}: ${err.message}`, 'tag', null, []);
      }
    }

    if (affectedSlugs.length > 0) {
      await this.addLog(
        'generate',
        `Generated ${affectedSlugs.length} wiki pages from ${processed} tags`,
        'tag',
        null,
        affectedSlugs
      );
    }

    return { processed, pages: affectedSlugs };
  }

  // ==========================================
  // REGENERATE — Update existing page via LLM
  // ==========================================

  async regeneratePage(slug) {
    const page = await this.getPage(slug);
    if (!page) throw new Error(`Page not found: ${slug}`);

    let tagContext = '';
    if (page.tagId) {
      const tag = await prisma.stashTag.findUnique({
        where: { id: page.tagId },
        include: {
          parentTags: { include: { parentTag: true } },
          childTags: { include: { childTag: true } },
          aliases: true
        }
      });
      if (tag) {
        const parents = tag.parentTags?.map(pt => pt.parentTag?.name).filter(Boolean) || [];
        const children = tag.childTags?.map(ct => ct.childTag?.name).filter(Boolean) || [];
        const aliases = tag.aliases?.map(a => a.alias).filter(Boolean) || [];
        tagContext = `Tag: "${tag.name}"`;
        if (tag.description) tagContext += `\nStash Description: ${tag.description}`;
        if (parents.length) tagContext += `\nParent Tags: ${parents.join(', ')}`;
        if (children.length) tagContext += `\nChild Tags: ${children.join(', ')}`;
        if (aliases.length) tagContext += `\nAliases: ${aliases.join(', ')}`;
      }
    }

    const existingPages = await this.getAllPages();
    const existingIndex = existingPages
      .filter(p => p.slug !== slug)
      .map(p => `- [[${p.slug}]]: ${p.title}`)
      .join('\n');

    const prompt = `Regenerate the wiki page for this tag. Provide the COMPLETE updated content.

## Tag Information
${tagContext || `Title: ${page.title}`}

## Current Page Content
${page.content}

## Other Wiki Pages (for cross-referencing)
${existingIndex || '(No other pages)'}

## Instructions
Respond with the updated page in this exact JSON format:

\`\`\`json
{
  "updates": [
    {
      "action": "update",
      "slug": "${slug}",
      "title": "${page.title}",
      "content": "Full markdown page content (complete replacement)",
      "relatedSlugs": ["related-tag-1"]
    }
  ]
}
\`\`\`

Provide the COMPLETE page content — it will replace the existing content entirely.`;

    const aiResponse = await this.callOllama([
      { role: 'system', content: STASH_WIKI_SCHEMA },
      { role: 'user', content: prompt }
    ]);

    const updates = this.parseWikiResponse(aiResponse);
    if (updates.length === 0) return page;

    const update = updates[0];
    const outboundLinks = this.extractWikiLinks(update.content || '');
    
    const updated = await this.updatePage(slug, {
      content: update.content || page.content,
      outboundLinks: JSON.stringify(outboundLinks),
      relatedTagIds: JSON.stringify(update.relatedSlugs || [])
    });

    await this.updateInboundLinks(slug, outboundLinks);
    await this.addLog('update', `Regenerated page: ${slug}`, 'manual', null, [slug]);
    
    return updated;
  }

  // ==========================================
  // CORRECTIONS — User corrects a page
  // ==========================================

  async correctPage(slug, correction) {
    const page = await this.getPage(slug);
    if (!page) throw new Error(`Page not found: ${slug}`);

    const prompt = `A user has provided a correction for this wiki page. Apply the correction and return the COMPLETE updated page content.

## Current Page Content
${page.content}

## User Correction
${correction}

## Instructions
Apply the user's correction to the page. Respond in this exact JSON format:

\`\`\`json
{
  "updates": [
    {
      "action": "update",
      "slug": "${slug}",
      "title": "${page.title}",
      "content": "Full corrected markdown page content",
      "relatedSlugs": ["related-tag-1"]
    }
  ]
}
\`\`\`

CRITICAL: Return the COMPLETE page content with the correction applied. The content will REPLACE the entire page.`;

    const aiResponse = await this.callOllama([
      { role: 'system', content: STASH_WIKI_SCHEMA },
      { role: 'user', content: prompt }
    ]);

    const updates = this.parseWikiResponse(aiResponse);
    if (updates.length === 0) return page;

    const update = updates[0];
    const outboundLinks = this.extractWikiLinks(update.content || '');
    
    const updated = await this.updatePage(slug, {
      content: update.content || page.content,
      outboundLinks: JSON.stringify(outboundLinks),
      relatedTagIds: JSON.stringify(update.relatedSlugs || [])
    });

    await this.updateInboundLinks(slug, outboundLinks);
    await this.addLog('correct', `User correction on page: ${slug} — "${correction.substring(0, 100)}"`, 'manual', null, [slug]);
    
    return updated;
  }

  // ==========================================
  // TAG LIFECYCLE — Sync with Stash changes
  // ==========================================

  async onTagCreated(tagId) {
    const result = await this.generateFromTags([tagId]);
    return result;
  }

  async onTagDeleted(tagId, tagName) {
    const page = await this.getPageByTagId(tagId);
    if (page) {
      await this.deletePage(page.slug);
      await this.addLog('delete', `Deleted wiki page for removed tag: "${tagName}"`, 'sync', tagId, [page.slug]);
      return { deleted: page.slug };
    }
    return { deleted: null };
  }

  async onTagMerged(sourceTagIds, targetTagId) {
    // Get the target tag's wiki page (or create one)
    let targetPage = await this.getPageByTagId(targetTagId);
    const targetTag = await prisma.stashTag.findUnique({
      where: { id: targetTagId },
      include: {
        parentTags: { include: { parentTag: true } },
        childTags: { include: { childTag: true } },
        aliases: true
      }
    });

    if (!targetTag) return { merged: 0 };

    // Gather content from source tag pages before deleting them
    const sourcePages = [];
    for (const sourceId of sourceTagIds) {
      const page = await this.getPageByTagId(sourceId);
      if (page) sourcePages.push(page);
    }

    // If target has no page, create one via LLM
    if (!targetPage) {
      await this.generateFromTags([targetTagId]);
      targetPage = await this.getPageByTagId(targetTagId);
    }

    // If we have source pages to merge content from, use LLM to merge
    if (sourcePages.length > 0 && targetPage) {
      const sourceContent = sourcePages.map(p => 
        `### Previously: "${p.title}"\n${p.content}`
      ).join('\n\n---\n\n');

      const prompt = `Tags have been merged. Integrate the content from merged source tags into the target tag's wiki page.

## Target Tag Page (keep and update)
### ${targetPage.title}
${targetPage.content}

## Source Tag Pages (being merged into target)
${sourceContent}

## Instructions
Return the COMPLETE updated page content for the target tag, integrating any useful information from the source tags. Respond in JSON:

\`\`\`json
{
  "updates": [
    {
      "action": "update",
      "slug": "${targetPage.slug}",
      "title": "${targetPage.title}",
      "content": "Full merged markdown content",
      "relatedSlugs": ["related-tag-1"]
    }
  ]
}
\`\`\``;

      try {
        const aiResponse = await this.callOllama([
          { role: 'system', content: STASH_WIKI_SCHEMA },
          { role: 'user', content: prompt }
        ]);

        const updates = this.parseWikiResponse(aiResponse);
        if (updates.length > 0) {
          const update = updates[0];
          const outboundLinks = this.extractWikiLinks(update.content || '');
          await this.updatePage(targetPage.slug, {
            content: update.content || targetPage.content,
            outboundLinks: JSON.stringify(outboundLinks),
            relatedTagIds: JSON.stringify(update.relatedSlugs || [])
          });
          await this.updateInboundLinks(targetPage.slug, outboundLinks);
        }
      } catch (err) {
        console.error('Stash wiki merge failed:', err.message);
      }
    }

    // Delete source tag pages
    const deletedSlugs = [];
    for (const page of sourcePages) {
      try {
        await this.deletePage(page.slug);
        deletedSlugs.push(page.slug);
      } catch (err) {
        console.error(`Failed to delete source page ${page.slug}:`, err.message);
      }
    }

    await this.addLog(
      'merge',
      `Merged ${sourcePages.length} tag pages into "${targetTag.name}" (deleted: ${deletedSlugs.join(', ')})`,
      'merge',
      targetTagId,
      [targetPage?.slug, ...deletedSlugs].filter(Boolean)
    );

    return { merged: sourcePages.length, target: targetPage?.slug, deleted: deletedSlugs };
  }

  // ==========================================
  // SEMANTIC SEARCH
  // ==========================================

  async findRelevantPages(queryText, topK = 5) {
    const queryEmbedding = await this.generateEmbedding(queryText);

    if (queryEmbedding) {
      const embeddedPages = await prisma.stashWikiPage.findMany({
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

    const allPages = await prisma.stashWikiPage.findMany();
    const scored = allPages.map(page => {
      const text = (page.title + ' ' + page.content).toLowerCase();
      const matchCount = words.filter(w => text.includes(w)).length;
      return { ...page, score: matchCount / words.length };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).filter(p => p.score > 0);
  }

  /**
   * Given a scene description, find relevant tags from the wiki
   */
  async suggestTagsForDescription(description) {
    const relevantPages = await this.findRelevantPages(description, 15);
    
    // Filter to only pages with tagIds (actual tag pages)
    const tagPages = relevantPages.filter(p => p.tagId);
    
    // Get the actual tag names
    const tagIds = tagPages.map(p => p.tagId);
    const tags = await prisma.stashTag.findMany({
      where: { id: { in: tagIds } }
    });

    return tagPages.map(page => {
      const tag = tags.find(t => t.id === page.tagId);
      return {
        tagId: page.tagId,
        tagName: tag?.name || page.title,
        wikiSlug: page.slug,
        relevanceScore: page.score,
        excerpt: page.content.substring(0, 200)
      };
    });
  }

  // ==========================================
  // HELPERS
  // ==========================================

  slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  extractWikiLinks(content) {
    const matches = content.match(/\[\[([^\]]+)\]\]/g) || [];
    return [...new Set(matches.map(m => m.replace(/\[\[|\]\]/g, '')))];
  }

  async updateInboundLinks(fromSlug, targetSlugs) {
    for (const targetSlug of targetSlugs) {
      const targetPage = await this.getPage(targetSlug);
      if (targetPage) {
        const inbound = JSON.parse(targetPage.inboundLinks || '[]');
        if (!inbound.includes(fromSlug)) {
          inbound.push(fromSlug);
          await prisma.stashWikiPage.update({
            where: { slug: targetSlug },
            data: { inboundLinks: JSON.stringify(inbound) }
          });
        }
      }
    }
  }

  parseWikiResponse(aiResponse) {
    try {
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)```/) ||
                        aiResponse.match(/```\s*([\s\S]*?)```/) ||
                        [null, aiResponse];
      const jsonStr = jsonMatch[1].trim();
      const parsed = JSON.parse(jsonStr);
      return parsed.updates || [];
    } catch (err) {
      try {
        const parsed = JSON.parse(aiResponse.trim());
        return parsed.updates || [];
      } catch {
        console.error('Failed to parse stash wiki AI response:', err.message);
        return [];
      }
    }
  }
}

module.exports = StashWikiService;
