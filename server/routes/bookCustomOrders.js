const express = require('express');
const { BookCustomOrderService } = require('../services/BookCustomOrderService');
const { asyncHandler, sendBadRequest, sendSuccess } = require('../utils/responses');

function createBookCustomOrdersRouter(prisma) {
  const router = express.Router();
  const service = new BookCustomOrderService(prisma);
  router.get('/custom-order-options', asyncHandler(async (req, res) => {
    sendSuccess(res, await prisma.customOrder.findMany({
      select: { id: true, name: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }]
    }));
  }));
  router.post('/:bookId/custom-orders/:orderId/parts', asyncHandler(async (req, res) => {
    const bookId = Number(req.params.bookId);
    const orderId = Number(req.params.orderId);
    const selections = req.body?.selections;
    if (![bookId, orderId].every(id => Number.isSafeInteger(id) && id > 0)) {
      return sendBadRequest(res, 'Valid book and custom order IDs are required');
    }
    if (!Array.isArray(selections) || selections.length === 0 ||
        selections.some(part => !part || !['chapter', 'section'].includes(part.type) ||
          !Number.isSafeInteger(part.id) || part.id <= 0)) {
      return sendBadRequest(res, 'Select at least one chapter or section with a valid ID');
    }
    const result = await service.addParts(bookId, orderId, selections);
    if (result.error) return res.status(result.status).json({ error: result.error });
    sendSuccess(res, result);
  }));
  return router;
}

module.exports = createBookCustomOrdersRouter;
