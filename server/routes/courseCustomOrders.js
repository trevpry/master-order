const express = require('express');
const CourseCustomOrderService = require('../services/CourseCustomOrderService');
const { asyncHandler, sendBadRequest, sendSuccess } = require('../utils/responses');

function createCourseCustomOrdersRouter(prisma) {
  const router = express.Router();
  const service = new CourseCustomOrderService(prisma);

  router.get('/custom-order-options', asyncHandler(async (req, res) => {
    const orders = await prisma.customOrder.findMany({
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }]
    });
    sendSuccess(res, orders);
  }));

  router.post('/:courseId/custom-orders/:orderId', asyncHandler(async (req, res) => {
    const courseId = Number(req.params.courseId);
    const orderId = Number(req.params.orderId);
    if (!Number.isSafeInteger(courseId) || courseId <= 0 ||
        !Number.isSafeInteger(orderId) || orderId <= 0) {
      return sendBadRequest(res, 'Valid course and custom order IDs are required');
    }

    const videoIds = req.body?.videoIds;
    if (videoIds !== undefined && (!Array.isArray(videoIds) || videoIds.length === 0 ||
        videoIds.some(id => !Number.isSafeInteger(id) || id <= 0))) {
      return sendBadRequest(res, 'videoIds must be a non-empty array of positive integer IDs');
    }

    const result = await service.addVideos(courseId, orderId, videoIds);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    sendSuccess(res, result);
  }));

  return router;
}

module.exports = createCourseCustomOrdersRouter;
