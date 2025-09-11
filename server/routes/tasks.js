const express = require('express');
const router = express.Router();
const TaskService = require('../services/taskService');
const { 
  asyncHandler, 
  sendSuccess, 
  sendCreated, 
  sendBadRequest, 
  sendNotFound, 
  sendServerError,
  logError 
} = require('../utils/responses');

const taskService = new TaskService();

// ========================================
// PROJECT ROUTES
// ========================================

// GET /api/tasks/projects - Get all projects
router.get('/projects', asyncHandler(async (req, res) => {
  const projects = await taskService.getAllProjects();
  sendSuccess(res, projects);
}));

// GET /api/tasks/projects/:id - Get project by ID
router.get('/projects/:id', asyncHandler(async (req, res) => {
  const project = await taskService.getProjectById(req.params.id);
  if (!project) {
    return sendNotFound(res, 'Project not found');
  }
  sendSuccess(res, project);
}));

// POST /api/tasks/projects - Create new project
router.post('/projects', asyncHandler(async (req, res) => {
  const { name } = req.body;
  
  if (!name) {
    return sendBadRequest(res, 'Project name is required');
  }
  
  const project = await taskService.createProject(req.body);
  sendCreated(res, project, 'Project created successfully');
}));

// PUT /api/tasks/projects/:id - Update project
router.put('/projects/:id', asyncHandler(async (req, res) => {
  const project = await taskService.updateProject(req.params.id, req.body);
  sendSuccess(res, project, 'Project updated successfully');
}));

// DELETE /api/tasks/projects/:id - Delete project
router.delete('/projects/:id', asyncHandler(async (req, res) => {
  await taskService.deleteProject(req.params.id);
  sendSuccess(res, null, 'Project deleted successfully');
}));

// ========================================
// TASK ROUTES
// ========================================

// GET /api/tasks - Get all tasks with optional filters
router.get('/', asyncHandler(async (req, res) => {
  const tasks = await taskService.getAllTasks(req.query);
  sendSuccess(res, tasks);
}));

// POST /api/tasks - Create new task
router.post('/', asyncHandler(async (req, res) => {
  const { title } = req.body;
  
  if (!title) {
    return sendBadRequest(res, 'Task title is required');
  }
  
  const task = await taskService.createTask(req.body);
  sendCreated(res, task, 'Task created successfully');
}));

// PUT /api/tasks/:id - Update task
router.put('/:id', asyncHandler(async (req, res) => {
  const task = await taskService.updateTask(req.params.id, req.body);
  sendSuccess(res, task, 'Task updated successfully');
}));

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', asyncHandler(async (req, res) => {
  await taskService.deleteTask(req.params.id);
  sendSuccess(res, null, 'Task deleted successfully');
}));

// ========================================
// CATEGORY ROUTES
// ========================================

// GET /api/tasks/categories - Get all categories
router.get('/categories', asyncHandler(async (req, res) => {
  const categories = await taskService.getAllCategories();
  sendSuccess(res, categories);
}));

// POST /api/tasks/categories - Create new category
router.post('/categories', asyncHandler(async (req, res) => {
  const { name } = req.body;
  
  if (!name) {
    return sendBadRequest(res, 'Category name is required');
  }
  
  const category = await taskService.createCategory(req.body);
  sendCreated(res, category, 'Category created successfully');
}));

// PUT /api/tasks/categories/:id - Update category
router.put('/categories/:id', asyncHandler(async (req, res) => {
  const category = await taskService.updateCategory(req.params.id, req.body);
  sendSuccess(res, category, 'Category updated successfully');
}));

// DELETE /api/tasks/categories/:id - Delete category
router.delete('/categories/:id', asyncHandler(async (req, res) => {
  await taskService.deleteCategory(req.params.id);
  sendSuccess(res, null, 'Category deleted successfully');
}));

// ========================================
// TIME TRACKING ROUTES
// ========================================

// GET /api/tasks/time-entries - Get all time entries with optional filters
router.get('/time-entries', asyncHandler(async (req, res) => {
  const timeEntries = await taskService.getAllTimeEntries(req.query);
  sendSuccess(res, timeEntries);
}));

// GET /api/tasks/time-entries/active - Get active time entry
router.get('/time-entries/active', asyncHandler(async (req, res) => {
  const activeEntry = await taskService.getActiveTimeEntry();
  sendSuccess(res, activeEntry);
}));

// POST /api/tasks/time-entries/start - Start new time entry
router.post('/time-entries/start', asyncHandler(async (req, res) => {
  const timeEntry = await taskService.startTimeEntry(req.body);
  sendCreated(res, timeEntry, 'Time tracking started');
}));

// PUT /api/tasks/time-entries/:id/end - End time entry
router.put('/time-entries/:id/end', asyncHandler(async (req, res) => {
  const timeEntry = await taskService.endTimeEntry(req.params.id, req.body.endTime);
  sendSuccess(res, timeEntry, 'Time tracking ended');
}));

// POST /api/tasks/time-entries/end-all - End all active time entries
router.post('/time-entries/end-all', asyncHandler(async (req, res) => {
  const count = await taskService.endActiveTimeEntries();
  sendSuccess(res, { count }, `${count} active time entries ended`);
}));

// DELETE /api/tasks/time-entries/:id - Delete time entry
router.delete('/time-entries/:id', asyncHandler(async (req, res) => {
  await taskService.deleteTimeEntry(req.params.id);
  sendSuccess(res, null, 'Time entry deleted successfully');
}));

// ========================================
// GOALS ROUTES
// ========================================

// GET /api/tasks/goals - Get all goals with optional filters
router.get('/goals', asyncHandler(async (req, res) => {
  const goals = await taskService.getAllGoals(req.query);
  sendSuccess(res, goals);
}));

// POST /api/tasks/goals - Create new goal
router.post('/goals', asyncHandler(async (req, res) => {
  const { title } = req.body;
  
  if (!title) {
    return sendBadRequest(res, 'Goal title is required');
  }
  
  const goal = await taskService.createGoal(req.body);
  sendCreated(res, goal, 'Goal created successfully');
}));

// PUT /api/tasks/goals/:id - Update goal
router.put('/goals/:id', asyncHandler(async (req, res) => {
  const goal = await taskService.updateGoal(req.params.id, req.body);
  sendSuccess(res, goal, 'Goal updated successfully');
}));

// DELETE /api/tasks/goals/:id - Delete goal
router.delete('/goals/:id', asyncHandler(async (req, res) => {
  await taskService.deleteGoal(req.params.id);
  sendSuccess(res, null, 'Goal deleted successfully');
}));

// ========================================
// DASHBOARD & ANALYTICS ROUTES
// ========================================

// GET /api/tasks/dashboard - Get dashboard statistics
router.get('/dashboard', asyncHandler(async (req, res) => {
  const stats = await taskService.getDashboardStats();
  sendSuccess(res, stats);
}));

// GET /api/tasks/analytics/productivity - Get productivity statistics
router.get('/analytics/productivity', asyncHandler(async (req, res) => {
  const period = req.query.period || 'week';
  const stats = await taskService.getProductivityStats(period);
  sendSuccess(res, stats);
}));

// ========================================
// TASK COMMENTS ROUTES
// ========================================

// GET /api/tasks/:id/comments - Get comments for a task
router.get('/:id/comments', asyncHandler(async (req, res) => {
  const comments = await taskService.getTaskComments(req.params.id);
  sendSuccess(res, comments);
}));

// POST /api/tasks/:id/comments - Add comment to task
router.post('/:id/comments', asyncHandler(async (req, res) => {
  const { content } = req.body;
  
  if (!content) {
    return sendBadRequest(res, 'Comment content is required');
  }
  
  const comment = await taskService.createTaskComment(req.params.id, req.body);
  sendCreated(res, comment, 'Comment added successfully');
}));

// DELETE /api/tasks/comments/:id - Delete comment
router.delete('/comments/:id', asyncHandler(async (req, res) => {
  await taskService.deleteTaskComment(req.params.id);
  sendSuccess(res, null, 'Comment deleted successfully');
}));

// ========================================
// TASK DEPENDENCIES ROUTES
// ========================================

// GET /api/tasks/:id/dependencies - Get task dependencies
router.get('/:id/dependencies', asyncHandler(async (req, res) => {
  const dependencies = await taskService.getTaskDependencies(req.params.id);
  sendSuccess(res, dependencies);
}));

// POST /api/tasks/:id/dependencies - Add task dependency
router.post('/:id/dependencies', asyncHandler(async (req, res) => {
  const { dependsOnTaskId, type } = req.body;
  
  if (!dependsOnTaskId) {
    return sendBadRequest(res, 'dependsOnTaskId is required');
  }
  
  const dependency = await taskService.addTaskDependency(req.params.id, dependsOnTaskId, type);
  sendCreated(res, dependency, 'Task dependency added successfully');
}));

// DELETE /api/tasks/dependencies/:id - Remove task dependency
router.delete('/dependencies/:id', asyncHandler(async (req, res) => {
  await taskService.removeTaskDependency(req.params.id);
  sendSuccess(res, null, 'Task dependency removed successfully');
}));

// ========================================
// BULK OPERATIONS ROUTES
// ========================================

// PUT /api/tasks/bulk-update - Bulk update tasks
router.put('/bulk-update', asyncHandler(async (req, res) => {
  const { taskIds, updateData } = req.body;
  
  if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
    return sendBadRequest(res, 'taskIds array is required');
  }
  
  if (!updateData || Object.keys(updateData).length === 0) {
    return sendBadRequest(res, 'updateData is required');
  }
  
  const results = await taskService.bulkUpdateTasks(taskIds, updateData);
  sendSuccess(res, results, `${results.length} tasks updated successfully`);
}));

// DELETE /api/tasks/bulk-delete - Bulk delete tasks
router.delete('/bulk-delete', asyncHandler(async (req, res) => {
  const { taskIds } = req.body;
  
  if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
    return sendBadRequest(res, 'taskIds array is required');
  }
  
  const result = await taskService.bulkDeleteTasks(taskIds);
  sendSuccess(res, result, `${result.count} tasks deleted successfully`);
}));

// POST /api/tasks/bulk-create - Bulk create tasks
router.post('/bulk-create', asyncHandler(async (req, res) => {
  const { tasks } = req.body;
  
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return sendBadRequest(res, 'tasks array is required');
  }
  
  const results = await taskService.bulkCreateTasks(tasks);
  sendCreated(res, results, `${results.length} tasks created successfully`);
}));

// GET /api/tasks/:id - Get task by ID (MUST be last specific route)
router.get('/:id', asyncHandler(async (req, res) => {
  const task = await taskService.getTaskById(req.params.id);
  if (!task) {
    return sendNotFound(res, 'Task not found');
  }
  sendSuccess(res, task);
}));

// Error handling middleware for this router
router.use((error, req, res, next) => {
  logError(error, 'Tasks API');
  
  if (error.code === 'P2002') {
    return sendBadRequest(res, 'A record with this information already exists');
  }
  
  if (error.code === 'P2025') {
    return sendNotFound(res, 'Record not found');
  }
  
  sendServerError(res, 'An error occurred while processing your request');
});

module.exports = router;
