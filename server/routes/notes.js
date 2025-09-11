const express = require('express');
const router = express.Router();
const NotesService = require('../services/notesService');
const { validateRequiredFields } = require('../middleware/validation');
const { sendBadRequest, sendSuccess, sendCreated, sendServerError, asyncHandler } = require('../utils/responses');

const notesService = new NotesService();

// GET /api/notes - Get all notes for a user
router.get('/', asyncHandler(async (req, res) => {
  const { userId = 1, folderId, tags, search, type, favorite } = req.query;
  const filters = { folderId, tags, search, type, favorite };
  
  const notes = await notesService.getNotes(userId, filters);
  sendSuccess(res, notes);
}));

// POST /api/notes - Create a new note
router.post('/', asyncHandler(async (req, res) => {
  const note = await notesService.createNote(req.body);
  sendCreated(res, note, 'Note created successfully');
}));

// PUT /api/notes/:id - Update a note
router.put('/:id', asyncHandler(async (req, res) => {
  const updatedNote = await notesService.updateNote(req.params.id, req.body);
  sendSuccess(res, updatedNote, 'Note updated successfully');
}));

// PUT /api/notes/:id/favorite - Toggle favorite status
router.put('/:id/favorite', asyncHandler(async (req, res) => {
  await notesService.toggleFavorite(req.params.id);
  sendSuccess(res, null, 'Favorite status updated');
}));

// DELETE /api/notes/:id - Delete a note
router.delete('/:id', asyncHandler(async (req, res) => {
  await notesService.deleteNote(req.params.id);
  sendSuccess(res, null, 'Note deleted successfully');
}));

// GET /api/notes/folders - Get all folders for a user
router.get('/folders', asyncHandler(async (req, res) => {
  const { userId = 1 } = req.query;
  const folders = await notesService.getFolders(userId);
  sendSuccess(res, folders);
}));

// POST /api/notes/folders - Create a new folder
router.post('/folders', asyncHandler(async (req, res) => {
  const folder = await notesService.createFolder(req.body);
  sendCreated(res, folder, 'Folder created successfully');
}));

// PUT /api/notes/folders/:id - Update a folder
router.put('/folders/:id', validateRequiredFields('name', 'Folder name is required'), asyncHandler(async (req, res) => {
  const { name } = req.body;
  
  await notesService.prisma.noteFolder.update({
    where: { id: parseInt(req.params.id) },
    data: { name: name.trim() }
  });
  
  sendSuccess(res, null, 'Folder updated successfully');
}));

// DELETE /api/notes/folders/:id - Delete a folder
router.delete('/folders/:id', asyncHandler(async (req, res) => {
  // Move notes from this folder to uncategorized (null folderId)
  await notesService.prisma.note.updateMany({
    where: { folderId: parseInt(req.params.id) },
    data: { folderId: null }
  });
  
  // Delete the folder
  await notesService.prisma.noteFolder.delete({
    where: { id: parseInt(req.params.id) }
  });
  
  sendSuccess(res, null, 'Folder deleted successfully');
}));

// GET /api/notes/tags - Get all tags for a user
router.get('/tags', asyncHandler(async (req, res) => {
  const { userId = 1 } = req.query;
  const tags = await notesService.getTags(userId);
  sendSuccess(res, tags);
}));

// GET /api/notes/stats - Get statistics for a user
router.get('/stats', asyncHandler(async (req, res) => {
  const { userId = 1 } = req.query;
  const stats = await notesService.getStats(userId);
  sendSuccess(res, stats);
}));

// Daily Notes Routes

// GET /api/notes/daily/:date - Get or create daily note for a specific date
router.get('/daily/:date', asyncHandler(async (req, res) => {
  const { date } = req.params;
  const { userId = 1 } = req.query;
  
  const dailyNote = await notesService.getDailyNote(date, userId);
  sendSuccess(res, dailyNote);
}));

// PUT /api/notes/daily/:date - Update daily note metadata
router.put('/daily/:date', asyncHandler(async (req, res) => {
  const { date } = req.params;
  const { userId = 1 } = req.query;
  
  await notesService.updateDailyNote(date, userId, req.body);
  sendSuccess(res, null, 'Daily note updated successfully');
}));

// GET /api/notes/daily-dates - Get dates with daily notes for calendar
router.get('/daily-dates', asyncHandler(async (req, res) => {
  const { userId = 1, month, year } = req.query;
  
  const dates = await notesService.getDailyNotesDates(userId, month, year);
  sendSuccess(res, dates);
}));

// Template Routes

// GET /api/notes/templates - Get all templates for a user
router.get('/templates', asyncHandler(async (req, res) => {
  const { userId = 1, type } = req.query;
  const templates = await notesService.getTemplates(userId, type);
  sendSuccess(res, templates);
}));

// POST /api/notes/templates - Create a new template
router.post('/templates', asyncHandler(async (req, res) => {
  const template = await notesService.createTemplate(req.body);
  sendCreated(res, template, 'Template created successfully');
}));

// Journal Route (legacy compatibility)
// GET /api/notes/journal/:date - Get or create journal entry for a specific date
router.get('/journal/:date', asyncHandler(async (req, res) => {
  const { date } = req.params;
  const { userId = 1 } = req.query;
  
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const note = await notesService.prisma.note.findFirst({
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
    const formattedNote = notesService.formatNote(note);
    sendSuccess(res, formattedNote);
  } else {
    sendSuccess(res, null);
  }
}));

// GET /api/notes/:id - Get a specific note (must be last to avoid conflicts)
router.get('/:id', asyncHandler(async (req, res) => {
  const note = await notesService.getNote(req.params.id);
  sendSuccess(res, note);
}));

module.exports = router;
