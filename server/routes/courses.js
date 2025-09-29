const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { PrismaClient } = require('@prisma/client');
const CourseScrapingService = require('../services/CourseScrapingService');
const GeminiService = require('../services/GeminiService');
const { asyncHandler, sendSuccess, sendBadRequest, sendServerError } = require('../utils/responses');
const { validateRequiredFieldsDirect } = require('../middleware/validation');

const prisma = new PrismaClient();
const courseScrapingService = new CourseScrapingService();
const geminiService = new GeminiService();

// ==========================================
// COURSE CRUD OPERATIONS
// ==========================================

// GET /api/courses - Get all courses with optional filtering
router.get('/', asyncHandler(async (req, res) => {
  const { category, search, page = 1, limit = 12 } = req.query;
  
  const where = {};
  
  if (category && category !== 'all') {
    where.category = category;
  }
  
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { instructor: { contains: search, mode: 'insensitive' } }
    ];
  }
  
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  const [courses, total] = await Promise.all([
    prisma.historyCourse.findMany({
      where,
      include: {
        videos: {
          select: {
            id: true,
            title: true,
            watched: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: parseInt(limit)
    }),
    prisma.historyCourse.count({ where })
  ]);
  
  sendSuccess(res, {
    courses,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

// GET /api/courses/categories - Get distinct course categories
router.get('/categories', asyncHandler(async (req, res) => {
  const categories = await prisma.historyCourse.findMany({
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' }
  });
  
  sendSuccess(res, categories.map(c => c.category));
}));

// GET /api/courses/:id - Get a specific course with videos
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const course = await prisma.historyCourse.findUnique({
    where: { id: parseInt(id) },
    include: {
      videos: {
        orderBy: [
          { order: 'asc' },
          { createdAt: 'asc' }
        ]
      }
    }
  });
  
  if (!course) {
    return sendBadRequest(res, 'Course not found');
  }
  
  sendSuccess(res, course);
}));

// POST /api/courses - Create a new course
router.post('/', asyncHandler(async (req, res) => {
  validateRequiredFieldsDirect(req.body, ['title', 'category', 'url']);
  
  const { title, category, url, instructor, thumbnail, description } = req.body;
  
  // Check if course already exists
  const existingCourse = await prisma.historyCourse.findUnique({
    where: { url }
  });
  
  if (existingCourse) {
    return sendBadRequest(res, 'Course with this URL already exists');
  }
  
  const course = await prisma.historyCourse.create({
    data: {
      title,
      category,
      url,
      instructor,
      thumbnail,
      description,
      completed: false
    },
    include: {
      videos: true
    }
  });
  
  sendSuccess(res, course);
}));

// PUT /api/courses/:id - Update a course
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  
  // Remove fields that shouldn't be updated directly
  delete updateData.id;
  delete updateData.createdAt;
  delete updateData.updatedAt;
  delete updateData.videos;
  
  const course = await prisma.historyCourse.update({
    where: { id: parseInt(id) },
    data: updateData,
    include: {
      videos: {
        orderBy: [
          { order: 'asc' },
          { createdAt: 'asc' }
        ]
      }
    }
  });
  
  sendSuccess(res, course);
}));

// DELETE /api/courses/:id - Delete a course
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const courseId = parseInt(id);
  
  // Get the course first to get its title for cleanup
  const course = await prisma.historyCourse.findUnique({
    where: { id: courseId },
    include: { videos: true }
  });
  
  if (!course) {
    return sendBadRequest(res, 'Course not found');
  }
  
  // Delete associated historyVideo records that were created from this course's assignment
  // These are identified by courseTitle matching the course title and assignedByAI = true
  const deletedHistoryVideos = await prisma.historyVideo.deleteMany({
    where: {
      courseTitle: course.title,
      assignedByAI: true
    }
  });
  
  console.log(`🧹 Cleaned up ${deletedHistoryVideos.count} historyVideo records for course: ${course.title}`);
  
  // Delete the course (this will cascade delete historyCourseVideo records)
  await prisma.historyCourse.delete({
    where: { id: courseId }
  });
  
  sendSuccess(res, { 
    message: 'Course deleted successfully',
    cleanedUpVideos: deletedHistoryVideos.count
  });
}));

// ==========================================
// COURSE VIDEO OPERATIONS
// ==========================================

// GET /api/courses/:id/videos - Get all videos for a course
router.get('/:id/videos', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const videos = await prisma.historyCourseVideo.findMany({
    where: { courseId: parseInt(id) },
    orderBy: [
      { order: 'asc' },
      { createdAt: 'asc' }
    ]
  });
  
  sendSuccess(res, videos);
}));

// POST /api/courses/:id/videos - Add a video to a course
router.post('/:id/videos', asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateRequiredFieldsDirect(req.body, ['title', 'url']);
  
  const { title, url, description, order } = req.body;
  
  // Check if video already exists
  const existingVideo = await prisma.historyCourseVideo.findUnique({
    where: { url }
  });
  
  if (existingVideo) {
    return sendBadRequest(res, 'Video with this URL already exists');
  }
  
  const video = await prisma.historyCourseVideo.create({
    data: {
      title,
      url,
      description,
      order,
      courseId: parseInt(id),
      watched: false
    }
  });
  
  sendSuccess(res, video);
}));

// PUT /api/courses/videos/:videoId - Update a course video
router.put('/videos/:videoId', asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const updateData = req.body;
  
  // Remove fields that shouldn't be updated directly
  delete updateData.id;
  delete updateData.createdAt;
  delete updateData.updatedAt;
  delete updateData.courseId;
  
  const video = await prisma.historyCourseVideo.update({
    where: { id: parseInt(videoId) },
    data: updateData
  });
  
  sendSuccess(res, video);
}));

// DELETE /api/courses/videos/:videoId - Delete a course video
router.delete('/videos/:videoId', asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  
  // Get the video first to get its URL for cleanup
  const courseVideo = await prisma.historyCourseVideo.findUnique({
    where: { id: parseInt(videoId) }
  });
  
  if (!courseVideo) {
    return sendBadRequest(res, 'Course video not found');
  }
  
  // Delete associated historyVideo record if it exists (from AI assignment)
  const deletedHistoryVideo = await prisma.historyVideo.deleteMany({
    where: {
      url: courseVideo.url,
      assignedByAI: true
    }
  });
  
  if (deletedHistoryVideo.count > 0) {
    console.log(`🧹 Cleaned up historyVideo record for: ${courseVideo.title}`);
  }
  
  // Delete the course video
  await prisma.historyCourseVideo.delete({
    where: { id: parseInt(videoId) }
  });
  
  sendSuccess(res, { 
    message: 'Video deleted successfully',
    cleanedUpLinkedVideo: deletedHistoryVideo.count > 0
  });
}));

// ==========================================
// COURSE SCRAPING OPERATIONS
// ==========================================

// POST /api/courses/scrape-from-url - Scrape courses from Great Courses Plus URL
router.post('/scrape-from-url', asyncHandler(async (req, res) => {
  validateRequiredFieldsDirect(req.body, ['url']);
  
  const { url } = req.body;
  
  // Validate URL format
  if (!url.includes('thegreatcoursesplus.com') && !url.includes('wondrium.com')) {
    return sendBadRequest(res, 'Please provide a valid Great Courses Plus or Wondrium URL');
  }
  
  console.log(`🔍 Starting course scraping from: ${url}`);
  
  const result = await courseScrapingService.scrapeCourses(url);
  
  sendSuccess(res, result);
}));

// POST /api/courses/:id/scrape-videos - Scrape videos for a specific course
router.post('/:id/scrape-videos', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const course = await prisma.historyCourse.findUnique({
    where: { id: parseInt(id) }
  });
  
  if (!course) {
    return sendBadRequest(res, 'Course not found');
  }
  
  console.log(`🎥 Starting video scraping for course: ${course.title}`);
  
  const result = await courseScrapingService.scrapeVideosForCourse(course);
  
  sendSuccess(res, result);
}));

// ==========================================
// VIDEO LINKING OPERATIONS
// ==========================================

// GET /api/courses/:id/videos - Get videos for a course with linking status
router.get('/:id/videos', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const course = await prisma.historyCourse.findUnique({
    where: { id: parseInt(id) },
    include: {
      videos: {
        orderBy: { order: 'asc' }
      }
    }
  });
  
  if (!course) {
    return sendBadRequest(res, 'Course not found');
  }
  
  // Get HistoryVideos linked to this course by courseTitle
  const linkedHistoryVideos = await prisma.historyVideo.findMany({
    where: {
      courseTitle: course.title,
      deleted: false
    },
    orderBy: { lectureNumber: 'asc' }
  });
  
  // Also get all available HistoryVideos that could be linked
  const availableHistoryVideos = await prisma.historyVideo.findMany({
    where: {
      type: 'great-courses-plus',
      deleted: false,
      OR: [
        { courseTitle: null },
        { courseTitle: course.title }
      ]
    },
    orderBy: { title: 'asc' }
  });
  
  sendSuccess(res, {
    course: {
      ...course,
      historyVideos: linkedHistoryVideos
    },
    availableHistoryVideos
  });
}));

// POST /api/courses/:courseId/videos/:videoId/link - Link existing HistoryVideo to course lecture
router.post('/:courseId/videos/:videoId/link', asyncHandler(async (req, res) => {
  const { courseId, videoId } = req.params;
  const { historyVideoId } = req.body;
  
  validateRequiredFieldsDirect(req.body, ['historyVideoId']);
  
  const course = await prisma.historyCourse.findUnique({
    where: { id: parseInt(courseId) }
  });
  
  if (!course) {
    return sendBadRequest(res, 'Course not found');
  }
  
  const courseVideo = await prisma.historyCourseVideo.findUnique({
    where: { id: parseInt(videoId) }
  });
  
  if (!courseVideo) {
    return sendBadRequest(res, 'Course video not found');
  }
  
  const historyVideo = await prisma.historyVideo.findUnique({
    where: { id: parseInt(historyVideoId) }
  });
  
  if (!historyVideo) {
    return sendBadRequest(res, 'History video not found');
  }
  
  // Update the HistoryVideo to link it to this course
  await prisma.historyVideo.update({
    where: { id: parseInt(historyVideoId) },
    data: {
      courseTitle: course.title,
      lectureNumber: courseVideo.order
    }
  });
  
  sendSuccess(res, { message: 'Video linked successfully' });
}));

// POST /api/courses/:courseId/videos/:videoId/create - Create new HistoryVideo for course lecture
router.post('/:courseId/videos/:videoId/create', asyncHandler(async (req, res) => {
  const { courseId, videoId } = req.params;
  const { title, url, description } = req.body;
  
  validateRequiredFieldsDirect(req.body, ['title', 'url']);
  
  const course = await prisma.historyCourse.findUnique({
    where: { id: parseInt(courseId) }
  });
  
  if (!course) {
    return sendBadRequest(res, 'Course not found');
  }
  
  const courseVideo = await prisma.historyCourseVideo.findUnique({
    where: { id: parseInt(videoId) }
  });
  
  if (!courseVideo) {
    return sendBadRequest(res, 'Course video not found');
  }
  
  // Create new HistoryVideo
  const historyVideo = await prisma.historyVideo.create({
    data: {
      title: title || courseVideo.title,
      url,
      type: 'great-courses-plus',
      description: description || courseVideo.description,
      courseTitle: course.title,
      lectureNumber: courseVideo.order,
      assignedByAI: false
    }
  });
  
  sendSuccess(res, { 
    message: 'History video created successfully',
    historyVideo 
  });
}));

// DELETE /api/courses/:courseId/videos/:videoId/unlink - Unlink HistoryVideo from course
router.delete('/:courseId/videos/:videoId/unlink', asyncHandler(async (req, res) => {
  const { courseId, videoId } = req.params;
  
  const courseVideo = await prisma.historyCourseVideo.findUnique({
    where: { id: parseInt(videoId) }
  });
  
  if (!courseVideo) {
    return sendBadRequest(res, 'Course video not found');
  }
  
  // Find linked HistoryVideo by courseTitle and lecture number
  const course = await prisma.historyCourse.findUnique({
    where: { id: parseInt(courseId) }
  });
  
  if (!course) {
    return sendBadRequest(res, 'Course not found');
  }
  
  const historyVideo = await prisma.historyVideo.findFirst({
    where: {
      courseTitle: course.title,
      lectureNumber: courseVideo.order
    }
  });
  
  if (historyVideo) {
    await prisma.historyVideo.update({
      where: { id: historyVideo.id },
      data: {
        courseTitle: null,
        lectureNumber: null
      }
    });
  }
  
  sendSuccess(res, { message: 'Video unlinked successfully' });
}));

// ==========================================
// STATISTICS
// ==========================================

// GET /api/courses/statistics - Get course statistics
router.get('/statistics', asyncHandler(async (req, res) => {
  const [
    totalCourses,
    totalVideos,
    completedCourses,
    watchedVideos,
    categories
  ] = await Promise.all([
    prisma.historyCourse.count(),
    prisma.historyCourseVideo.count(),
    prisma.historyCourse.count({ where: { completed: true } }),
    prisma.historyCourseVideo.count({ where: { watched: true } }),
    prisma.historyCourse.groupBy({
      by: ['category'],
      _count: { category: true },
      orderBy: { _count: { category: 'desc' } }
    })
  ]);
  
  sendSuccess(res, {
    totalCourses,
    totalVideos,
    completedCourses,
    watchedVideos,
    categoriesStats: categories.map(cat => ({
      category: cat.category,
      count: cat._count.category
    }))
  });
}));

// ==========================================
// COURSE AI ANALYSIS
// ==========================================

// POST /api/courses/:id/ai-analyze - Generate AI prompt or process response for course analysis
router.post('/:id/ai-analyze', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { preview } = req.query;
  
  // Get course with videos
  const course = await prisma.historyCourse.findUnique({
    where: { id: parseInt(id) },
    include: {
      videos: {
        orderBy: [
          { order: 'asc' },
          { createdAt: 'asc' }
        ]
      }
    }
  });
  
  if (!course) {
    return sendBadRequest(res, 'Course not found');
  }
  
  // Get existing events and categories
  const [events, categories] = await Promise.all([
    prisma.historicalEvent.findMany({
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        category: true
      },
      orderBy: { startDate: 'asc' }
    }),
    prisma.historyCategory.findMany({
      select: {
        id: true,
        name: true,
        description: true
      },
      orderBy: { name: 'asc' }
    })
  ]);
  
  // Read guidebook content if available
  let guidebookContent = '';
  if (course.guidebook) {
    try {
      const guidebooksDir = path.join(__dirname, '..', 'guidebooks');
      const guidebookPath = path.join(guidebooksDir, path.basename(course.guidebook));
      
      // For now, we'll indicate guidebook is available but not parse PDF content
      // In a full implementation, you'd use a PDF parser here
      guidebookContent = `[Guidebook available: ${path.basename(course.guidebook)}]\nContent would be extracted from PDF for AI analysis.`;
    } catch (error) {
      console.warn('Could not read guidebook:', error.message);
      guidebookContent = '[Guidebook file not accessible]';
    }
  }
  
  if (preview === 'true') {
    // Generate prompt for manual use
    const fullPrompt = geminiService.buildCourseAssignmentPrompt(
      course,
      course.videos,
      guidebookContent,
      events,
      categories
    );
    
    sendSuccess(res, {
      course: {
        id: course.id,
        title: course.title,
        instructor: course.instructor,
        category: course.category
      },
      lectureCount: course.videos.length,
      hasGuidebook: !!course.guidebook,
      fullPrompt
    });
  } else {
    // This would be for processing a manual response
    // For now, return an error since this should be handled by the assignment endpoint
    return sendBadRequest(res, 'Direct AI processing not supported. Use preview mode to get prompt, then use assignment endpoint with response.');
  }
}));

// POST /api/courses/:id/ai-assign-lectures - Process Gemini response and assign lectures to events
router.post('/:id/ai-assign-lectures', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { suggestions } = req.body;
  
  if (!suggestions || !Array.isArray(suggestions)) {
    return sendBadRequest(res, 'Invalid suggestions data');
  }
  
  // Get course with videos
  const course = await prisma.historyCourse.findUnique({
    where: { id: parseInt(id) },
    include: {
      videos: {
        orderBy: [
          { order: 'asc' },
          { createdAt: 'asc' }
        ]
      }
    }
  });
  
  if (!course) {
    return sendBadRequest(res, 'Course not found');
  }
  
  // Get existing events and categories for validation
  const [events, categories] = await Promise.all([
    prisma.historicalEvent.findMany({
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        category: true
      }
    }),
    prisma.historyCategory.findMany({
      select: {
        id: true,
        name: true,
        description: true
      }
    })
  ]);
  
  // Parse and validate the suggestions
  const validatedResponse = geminiService.parseCourseAssignmentResponse(
    JSON.stringify({ suggestions }),
    course.videos,
    events,
    categories
  );
  
  if (!validatedResponse.success) {
    return sendServerError(res, `Failed to process suggestions: ${validatedResponse.error}`);
  }
  
  const results = {
    processedLectures: 0,
    createdEvents: 0,
    assignedToExisting: 0,
    skipped: 0,
    errors: []
  };
  
  // Process each suggestion
  for (const suggestion of validatedResponse.suggestions) {
    try {
      const lecture = course.videos.find(v => v.order === suggestion.lectureNumber);
      if (!lecture) {
        results.errors.push(`Lecture ${suggestion.lectureNumber} not found`);
        continue;
      }
      
      if (suggestion.action === 'SKIP') {
        results.skipped++;
        continue;
      }
      
      let eventId;
      
      if (suggestion.action === 'ASSIGN_TO_EXISTING' && suggestion.existingEvent) {
        // Assign to existing event
        eventId = suggestion.existingEvent.id;
        results.assignedToExisting++;
      } else if (suggestion.action === 'CREATE_NEW_EVENT' && suggestion.newEventSuggestion) {
        // Create new event
        const newEventData = suggestion.newEventSuggestion;
        
        // Note: Using category name directly since HistoricalEvent only has category field, not categoryId
        
        const newEvent = await prisma.historicalEvent.create({
          data: {
            title: newEventData.title,
            startDate: newEventData.startDate,
            endDate: newEventData.endDate,
            category: newEventData.category,
            details: newEventData.details
          }
        });
        
        eventId = newEvent.id;
        results.createdEvents++;
      }
      
      if (eventId) {
        // Create a corresponding HistoryVideo entry for the course video so it appears in the Videos page
        // This is how the existing system links videos to events
        try {
          await prisma.historyVideo.create({
            data: {
              title: lecture.title,
              url: lecture.url,
              type: 'great-courses-plus',
              eventId: eventId,
              courseTitle: course.title,
              lectureNumber: lecture.order,
              description: lecture.description || `Lecture ${lecture.order} from ${course.title}`,
              assignedByAI: true
            }
          });
          console.log(`✅ Created HistoryVideo link for lecture ${suggestion.lectureNumber}: ${lecture.title} -> Event ${eventId}`);
        } catch (error) {
          // If URL already exists, update the existing record
          if (error.code === 'P2002') {
            await prisma.historyVideo.update({
              where: { url: lecture.url },
              data: {
                eventId: eventId,
                assignedByAI: true,
                courseTitle: course.title,
                lectureNumber: lecture.order
              }
            });
            console.log(`✅ Updated existing HistoryVideo link for lecture ${suggestion.lectureNumber}: ${lecture.title} -> Event ${eventId}`);
          } else {
            throw error;
          }
        }
        
        results.processedLectures++;
      }
      
    } catch (error) {
      console.error(`Error processing lecture ${suggestion.lectureNumber}:`, error);
      results.errors.push(`Lecture ${suggestion.lectureNumber}: ${error.message}`);
    }
  }
  
  sendSuccess(res, {
    message: 'Course lectures processed for event assignment',
    results,
    courseId: course.id,
    courseTitle: course.title
  });
}));

// ==========================================
// GUIDEBOOK SERVING
// ==========================================

// GET /api/courses/guidebooks/:filename - Serve guidebook files
router.get('/guidebooks/:filename', asyncHandler(async (req, res) => {
  const { filename } = req.params;
  
  // Security check: prevent directory traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return sendBadRequest(res, 'Invalid filename');
  }
  
  // Ensure it's a PDF file
  if (!filename.endsWith('.pdf')) {
    return sendBadRequest(res, 'Only PDF files are allowed');
  }
  
  const guidebooksDir = path.join(__dirname, '..', 'guidebooks');
  const filepath = path.join(guidebooksDir, filename);
  
  // Check if file exists
  try {
    const fs = require('fs').promises;
    await fs.access(filepath);
  } catch (error) {
    return sendBadRequest(res, 'Guidebook not found');
  }
  
  // Set appropriate headers for PDF
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  
  // Send the file
  res.sendFile(filepath);
}));

module.exports = router;