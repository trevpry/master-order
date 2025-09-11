const { PrismaClient } = require('@prisma/client');

class NotesService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  // Helper function to parse JSON fields safely
  parseJsonField(field) {
    try {
      return typeof field === 'string' ? JSON.parse(field) : field || [];
    } catch (e) {
      return [];
    }
  }

  // Helper function to format note with parsed JSON fields
  formatNote(note) {
    return {
      ...note,
      tags: this.parseJsonField(note.tags),
      attachments: this.parseJsonField(note.attachments),
      links: this.parseJsonField(note.links)
    };
  }

  // Helper function to update tag counts
  async updateTagCounts(tags, userId, operation = 'increment') {
    if (!Array.isArray(tags)) return;
    
    for (const tag of tags) {
      if (!tag.trim()) continue;
      
      const tagName = tag.trim().toLowerCase();
      
      if (operation === 'increment') {
        try {
          await this.prisma.noteTag.upsert({
            where: { name: tagName },
            update: { count: { increment: 1 } },
            create: { name: tagName, userId, count: 1 }
          });
        } catch (error) {
          console.error('Error incrementing tag count:', error);
        }
      } else if (operation === 'decrement') {
        try {
          const tag = await this.prisma.noteTag.findUnique({
            where: { name: tagName }
          });
          
          if (tag) {
            if (tag.count <= 1) {
              await this.prisma.noteTag.delete({
                where: { name: tagName }
              });
            } else {
              await this.prisma.noteTag.update({
                where: { name: tagName },
                data: { count: { decrement: 1 } }
              });
            }
          }
        } catch (error) {
          console.error('Error decrementing tag count:', error);
        }
      }
    }
  }

  // Get all notes for a user with filtering
  async getNotes(userId = 1, filters = {}) {
    const { folderId, tags, search, type, favorite } = filters;
    
    const where = {
      userId: parseInt(userId)
    };
    
    if (folderId) where.folderId = parseInt(folderId);
    if (type) where.type = type;
    if (favorite === 'true') where.isFavorite = true;
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { tags: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    const notes = await this.prisma.note.findMany({
      where,
      include: {
        folder: true,
        dailyNote: true
      },
      orderBy: { updatedAt: 'desc' }
    });
    
    let filteredNotes = notes.map(note => this.formatNote(note));
    
    // Filter by tags if specified
    if (tags) {
      const tagList = Array.isArray(tags) ? tags : [tags];
      filteredNotes = filteredNotes.filter(note => 
        tagList.every(tag => note.tags.includes(tag))
      );
    }
    
    return filteredNotes;
  }

  // Create a new note
  async createNote(noteData) {
    const {
      title,
      content = '',
      type = 'note',
      tags = [],
      folderId,
      userId = 1,
      isFavorite = false,
      isPublic = false,
      attachments = [],
      links = []
    } = noteData;
    
    if (!title || !title.trim()) {
      throw new Error('Title is required');
    }
    
    const note = await this.prisma.note.create({
      data: {
        title: title.trim(),
        content,
        type,
        tags: JSON.stringify(tags),
        folderId: folderId || null,
        userId: parseInt(userId),
        isFavorite,
        isPublic,
        attachments: JSON.stringify(attachments),
        links: JSON.stringify(links)
      },
      include: {
        folder: true,
        dailyNote: true
      }
    });
    
    // Update tag counts
    await this.updateTagCounts(tags, userId, 'increment');
    
    return this.formatNote(note);
  }

  // Update a note
  async updateNote(id, updateData) {
    const {
      title,
      content,
      tags = [],
      folderId,
      isFavorite,
      isPublic,
      attachments = [],
      links = []
    } = updateData;
    
    // First get the current note to compare tags
    const currentNote = await this.prisma.note.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!currentNote) {
      throw new Error('Note not found');
    }
    
    const currentTags = this.parseJsonField(currentNote.tags);
    const newTags = Array.isArray(tags) ? tags : [];
    
    const updateFields = {};
    if (title !== undefined) updateFields.title = title;
    if (content !== undefined) updateFields.content = content;
    if (tags !== undefined) updateFields.tags = JSON.stringify(newTags);
    if (folderId !== undefined) updateFields.folderId = folderId;
    if (isFavorite !== undefined) updateFields.isFavorite = isFavorite;
    if (isPublic !== undefined) updateFields.isPublic = isPublic;
    if (attachments !== undefined) updateFields.attachments = JSON.stringify(attachments);
    if (links !== undefined) updateFields.links = JSON.stringify(links);
    
    const updatedNote = await this.prisma.note.update({
      where: { id: parseInt(id) },
      data: updateFields,
      include: {
        folder: true,
        dailyNote: true
      }
    });
    
    // Update tag counts (decrement old tags, increment new tags)
    await this.updateTagCounts(currentTags, currentNote.userId, 'decrement');
    await this.updateTagCounts(newTags, currentNote.userId, 'increment');
    
    return this.formatNote(updatedNote);
  }

  // Delete a note
  async deleteNote(id) {
    // First get the note to update tag counts
    const note = await this.prisma.note.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!note) {
      throw new Error('Note not found');
    }
    
    const tags = this.parseJsonField(note.tags);
    
    // Delete cross-links and the note (cascade will handle cross-links and daily note)
    await this.prisma.note.delete({
      where: { id: parseInt(id) }
    });
    
    // Update tag counts
    await this.updateTagCounts(tags, note.userId, 'decrement');
    
    return { success: true };
  }

  // Toggle favorite status
  async toggleFavorite(id) {
    const currentNote = await this.prisma.note.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!currentNote) {
      throw new Error('Note not found');
    }
    
    await this.prisma.note.update({
      where: { id: parseInt(id) },
      data: { isFavorite: !currentNote.isFavorite }
    });
    
    return { success: true };
  }

  // Get a specific note
  async getNote(id) {
    const note = await this.prisma.note.findUnique({
      where: { id: parseInt(id) },
      include: {
        folder: true,
        dailyNote: true
      }
    });
    
    if (!note) {
      throw new Error('Note not found');
    }
    
    return this.formatNote(note);
  }

  // Daily Note Functions

  // Get or create daily note for a specific date
  async getDailyNote(date, userId = 1) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    let dailyNote = await this.prisma.dailyNote.findFirst({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay
        },
        userId: parseInt(userId)
      },
      include: {
        note: {
          include: {
            folder: true
          }
        }
      }
    });
    
    if (!dailyNote) {
      // Create daily note from template
      const template = await this.getDefaultDailyTemplate(userId);
      const dateStr = startOfDay.toISOString().split('T')[0];
      
      const note = await this.createNote({
        title: `Daily Note - ${dateStr}`,
        content: template ? template.content : this.getDefaultDailyContent(startOfDay),
        type: 'journal',
        userId,
        tags: ['daily', 'journal']
      });
      
      dailyNote = await this.prisma.dailyNote.create({
        data: {
          date: startOfDay,
          noteId: note.id,
          userId: parseInt(userId),
          goals: JSON.stringify([]),
          habits: JSON.stringify([]),
          gratitude: JSON.stringify([])
        },
        include: {
          note: {
            include: {
              folder: true
            }
          }
        }
      });
    }
    
    return {
      ...dailyNote,
      note: this.formatNote(dailyNote.note),
      goals: this.parseJsonField(dailyNote.goals),
      habits: this.parseJsonField(dailyNote.habits),
      gratitude: this.parseJsonField(dailyNote.gratitude)
    };
  }

  // Update daily note metadata
  async updateDailyNote(date, userId = 1, data = {}) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const { mood, weather, goals, habits, gratitude } = data;
    
    const updateFields = {};
    if (mood !== undefined) updateFields.mood = mood;
    if (weather !== undefined) updateFields.weather = weather;
    if (goals !== undefined) updateFields.goals = JSON.stringify(goals);
    if (habits !== undefined) updateFields.habits = JSON.stringify(habits);
    if (gratitude !== undefined) updateFields.gratitude = JSON.stringify(gratitude);
    
    const dailyNote = await this.prisma.dailyNote.updateMany({
      where: {
        date: startOfDay,
        userId: parseInt(userId)
      },
      data: updateFields
    });
    
    return { success: true };
  }

  // Get default daily content template
  getDefaultDailyContent(date) {
    const dateStr = date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    return `# ${dateStr}

## Morning Reflection
- How am I feeling today?
- What are my priorities?

## Goals for Today
- [ ] 
- [ ] 
- [ ] 

## Notes
_Capture thoughts, ideas, and observations throughout the day..._

## Evening Reflection
- What went well today?
- What could I improve?
- What am I grateful for?

---
*Created on ${new Date().toLocaleString()}*`;
  }

  // Template Functions

  // Get all templates for a user
  async getTemplates(userId = 1, type = null) {
    const where = { userId: parseInt(userId) };
    if (type) where.type = type;
    
    return await this.prisma.noteTemplate.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' }
      ]
    });
  }

  // Get default daily template
  async getDefaultDailyTemplate(userId = 1) {
    return await this.prisma.noteTemplate.findFirst({
      where: {
        userId: parseInt(userId),
        type: 'daily',
        isDefault: true
      }
    });
  }

  // Create a new template
  async createTemplate(templateData) {
    const {
      name,
      description,
      content = '',
      type = 'daily',
      variables = [],
      userId = 1,
      isDefault = false
    } = templateData;
    
    if (!name || !name.trim()) {
      throw new Error('Template name is required');
    }
    
    // If setting as default, unset other defaults of same type
    if (isDefault) {
      await this.prisma.noteTemplate.updateMany({
        where: {
          userId: parseInt(userId),
          type,
          isDefault: true
        },
        data: { isDefault: false }
      });
    }
    
    return await this.prisma.noteTemplate.create({
      data: {
        name: name.trim(),
        description,
        content,
        type,
        variables: JSON.stringify(variables),
        userId: parseInt(userId),
        isDefault
      }
    });
  }

  // Get folder functions

  // Get all folders for a user
  async getFolders(userId = 1) {
    const folders = await this.prisma.noteFolder.findMany({
      where: { userId: parseInt(userId) },
      include: {
        notes: true,
        children: true,
        parent: true
      },
      orderBy: { name: 'asc' }
    });
    
    return folders.map(folder => ({
      ...folder,
      noteCount: folder.notes.length
    }));
  }

  // Create a new folder
  async createFolder(folderData) {
    const { name, parentId, userId = 1 } = folderData;
    
    if (!name || !name.trim()) {
      throw new Error('Folder name is required');
    }
    
    return await this.prisma.noteFolder.create({
      data: {
        name: name.trim(),
        parentId: parentId || null,
        userId: parseInt(userId)
      }
    });
  }

  // Tag functions

  // Get all tags for a user
  async getTags(userId = 1) {
    return await this.prisma.noteTag.findMany({
      where: { userId: parseInt(userId) },
      orderBy: [
        { count: 'desc' },
        { name: 'asc' }
      ]
    });
  }

  // Get statistics
  async getStats(userId = 1) {
    const userIdInt = parseInt(userId);
    
    const [totalNotes, totalTags, totalFolders, dailyNotesCount] = await Promise.all([
      this.prisma.note.count({ where: { userId: userIdInt } }),
      this.prisma.noteTag.count({ where: { userId: userIdInt } }),
      this.prisma.noteFolder.count({ where: { userId: userIdInt } }),
      this.prisma.dailyNote.count({ where: { userId: userIdInt } })
    ]);
    
    return {
      totalNotes,
      totalTags,
      totalFolders,
      dailyNotesCount
    };
  }

  // Get days with daily notes for calendar
  async getDailyNotesDates(userId = 1, month = null, year = null) {
    const where = { userId: parseInt(userId) };
    
    if (month !== null && year !== null) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);
      
      where.date = {
        gte: startDate,
        lte: endDate
      };
    }
    
    const dailyNotes = await this.prisma.dailyNote.findMany({
      where,
      select: {
        date: true,
        id: true
      },
      orderBy: { date: 'asc' }
    });
    
    return dailyNotes.map(dn => ({
      date: dn.date.toISOString().split('T')[0],
      id: dn.id
    }));
  }
}

module.exports = NotesService;
