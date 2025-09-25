const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const CourseScrapingService = require('../services/CourseScrapingService');
const { asyncHandler, sendSuccess, sendBadRequest, sendServerError } = require('../utils/responses');
const { validateRequiredFieldsDirect } = require('../middleware/validation');

const prisma = new PrismaClient();
const courseScrapingService = new CourseScrapingService();

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
  
  await prisma.historyCourse.delete({
    where: { id: parseInt(id) }
  });
  
  sendSuccess(res, { message: 'Course deleted successfully' });
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
  
  await prisma.historyCourseVideo.delete({
    where: { id: parseInt(videoId) }
  });
  
  sendSuccess(res, { message: 'Video deleted successfully' });
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

module.exports = router;