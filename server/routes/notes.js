const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Helper function to parse JSON fields safely
const parseJsonField = (field) => {
  try {
    return typeof field === 'string' ? JSON.parse(field) : field || [];
  } catch (e) {
    return [];
  }
};

// Helper function to update tag counts
const updateTagCounts = async (tags, userId, operation = 'increment') => {
  if (!Array.isArray(tags)) return;
  
  for (const tag of tags) {
    if (!tag.trim()) continue;
    
    const tagName = tag.trim().toLowerCase();
    
    if (operation === 'increment') {
      try {
        await prisma.noteTag.upsert({
          where: { name: tagName },
          update: { count: { increment: 1 } },
          create: { name: tagName, userId, count: 1 }
        });
      } catch (error) {
        console.error('Error incrementing tag count:', error);
      }
    } else if (operation === 'decrement') {
      try {
        const tag = await prisma.noteTag.findUnique({
          where: { name: tagName }
        });
        
        if (tag) {
          if (tag.count <= 1) {
            await prisma.noteTag.delete({
              where: { name: tagName }
            });
          } else {
            await prisma.noteTag.update({
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
};

// Helper function to update folder note counts
const updateFolderCounts = () => {
  db.run(`
    UPDATE note_folders 
    SET noteCount = (
      SELECT COUNT(*) 
      FROM notes 
      WHERE notes.folderId = note_folders.id
    )
  `);
};

// GET /api/notes - Get all notes for a user
router.get('/', async (req, res) => {
  try {
    const { userId = 1, folderId, tags, search, type, favorite } = req.query;
    
    const where = {
      userId: parseInt(userId)
    };
    
    if (folderId) {
      where.folderId = parseInt(folderId);
    }
    
    if (type) {
      where.type = type;
    }
    
    if (favorite === 'true') {
      where.isFavorite = true;
    }
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { tags: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    const notes = await prisma.note.findMany({
      where,
      include: {
        folder: true
      },
      orderBy: { updatedAt: 'desc' }
    });
    
    let filteredNotes = notes.map(note => ({
      ...note,
      tags: parseJsonField(note.tags),
      attachments: parseJsonField(note.attachments),
      links: parseJsonField(note.links)
    }));
    
    // Filter by tags if specified
    if (tags) {
      const tagList = Array.isArray(tags) ? tags : [tags];
      filteredNotes = filteredNotes.filter(note => 
        tagList.every(tag => note.tags.includes(tag))
      );
    }
    
    res.json(filteredNotes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// POST /api/notes - Create a new note
router.post('/', async (req, res) => {
  try {
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
    } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const note = await prisma.note.create({
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
        folder: true
      }
    });
    
    // Update tag counts
    await updateTagCounts(tags, userId, 'increment');
    
    const formattedNote = {
      ...note,
      tags: parseJsonField(note.tags),
      attachments: parseJsonField(note.attachments),
      links: parseJsonField(note.links)
    };
    
    res.status(201).json(formattedNote);
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// PUT /api/notes/:id - Update a note
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      content,
      tags = [],
      folderId,
      isFavorite,
      isPublic,
      attachments = [],
      links = []
    } = req.body;
    
    // First get the current note to compare tags
    const currentNote = await prisma.note.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!currentNote) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    const currentTags = parseJsonField(currentNote.tags);
    const newTags = Array.isArray(tags) ? tags : [];
    
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (tags !== undefined) updateData.tags = JSON.stringify(newTags);
    if (folderId !== undefined) updateData.folderId = folderId;
    if (isFavorite !== undefined) updateData.isFavorite = isFavorite;
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    if (attachments !== undefined) updateData.attachments = JSON.stringify(attachments);
    if (links !== undefined) updateData.links = JSON.stringify(links);
    
    const updatedNote = await prisma.note.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        folder: true
      }
    });
    
    // Update tag counts (decrement old tags, increment new tags)
    await updateTagCounts(currentTags, currentNote.userId, 'decrement');
    await updateTagCounts(newTags, currentNote.userId, 'increment');
    
    const formattedNote = {
      ...updatedNote,
      tags: parseJsonField(updatedNote.tags),
      attachments: parseJsonField(updatedNote.attachments),
      links: parseJsonField(updatedNote.links)
    };
    
    res.json(formattedNote);
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// PUT /api/notes/:id/favorite - Toggle favorite status
router.put('/:id/favorite', async (req, res) => {
  try {
    const { id } = req.params;
    
    const currentNote = await prisma.note.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!currentNote) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    await prisma.note.update({
      where: { id: parseInt(id) },
      data: { isFavorite: !currentNote.isFavorite }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

// DELETE /api/notes/:id - Delete a note
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // First get the note to update tag counts
    const note = await prisma.note.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    const tags = parseJsonField(note.tags);
    
    // Delete cross-links and the note (cascade will handle cross-links)
    await prisma.note.delete({
      where: { id: parseInt(id) }
    });
    
    // Update tag counts
    await updateTagCounts(tags, note.userId, 'decrement');
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// GET /api/notes/folders - Get all folders for a user
router.get('/folders', async (req, res) => {
  try {
    const { userId = 1 } = req.query;
    
    const folders = await prisma.noteFolder.findMany({
      where: { userId: parseInt(userId) },
      include: {
        notes: true,
        children: true,
        parent: true
      },
      orderBy: { name: 'asc' }
    });
    
    const foldersWithCounts = folders.map(folder => ({
      ...folder,
      noteCount: folder.notes.length
    }));
    
    res.json(foldersWithCounts);
  } catch (error) {
    console.error('Error fetching folders:', error);
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

// POST /api/notes/folders - Create a new folder
router.post('/folders', async (req, res) => {
  try {
    const { name, parentId, userId = 1 } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Folder name is required' });
    }
    
    const folder = await prisma.noteFolder.create({
      data: {
        name: name.trim(),
        parentId: parentId || null,
        userId: parseInt(userId)
      }
    });
    
    res.status(201).json(folder);
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// PUT /api/notes/folders/:id - Update a folder
router.put('/folders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Folder name is required' });
    }
    
    await prisma.noteFolder.update({
      where: { id: parseInt(id) },
      data: { name: name.trim() }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating folder:', error);
    res.status(500).json({ error: 'Failed to update folder' });
  }
});

// DELETE /api/notes/folders/:id - Delete a folder
router.delete('/folders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Move notes from this folder to uncategorized (null folderId)
    await prisma.note.updateMany({
      where: { folderId: parseInt(id) },
      data: { folderId: null }
    });
    
    // Delete the folder
    await prisma.noteFolder.delete({
      where: { id: parseInt(id) }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

// GET /api/notes/tags - Get all tags for a user
router.get('/tags', async (req, res) => {
  try {
    const { userId = 1 } = req.query;
    
    const tags = await prisma.noteTag.findMany({
      where: { userId: parseInt(userId) },
      orderBy: [
        { count: 'desc' },
        { name: 'asc' }
      ]
    });
    
    res.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// GET /api/notes/stats - Get statistics for a user
router.get('/stats', async (req, res) => {
  try {
    const { userId = 1 } = req.query;
    const userIdInt = parseInt(userId);
    
    const [totalNotes, totalTags, totalFolders] = await Promise.all([
      prisma.note.count({ where: { userId: userIdInt } }),
      prisma.noteTag.count({ where: { userId: userIdInt } }),
      prisma.noteFolder.count({ where: { userId: userIdInt } })
    ]);
    
    res.json({
      totalNotes,
      totalTags,
      totalFolders
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/notes/journal/:date - Get or create journal entry for a specific date
router.get('/journal/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const { userId = 1 } = req.query;
    
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const note = await prisma.note.findFirst({
      where: {
        userId: parseInt(userId),
        type: 'journal',
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    if (note) {
      const formattedNote = {
        ...note,
        tags: parseJsonField(note.tags),
        attachments: parseJsonField(note.attachments),
        links: parseJsonField(note.links)
      };
      res.json(formattedNote);
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error('Error fetching journal entry:', error);
    res.status(500).json({ error: 'Failed to fetch journal entry' });
  }
});

// GET /api/notes/:id - Get a specific note (must be last to avoid conflicts)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const note = await prisma.note.findUnique({
      where: { id: parseInt(id) },
      include: {
        folder: true
      }
    });
    
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    const formattedNote = {
      ...note,
      tags: parseJsonField(note.tags),
      attachments: parseJsonField(note.attachments),
      links: parseJsonField(note.links)
    };
    
    res.json(formattedNote);
  } catch (error) {
    console.error('Error fetching note:', error);
    res.status(500).json({ error: 'Failed to fetch note' });
  }
});

module.exports = router;
