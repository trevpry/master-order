const express = require('express');
const router = express.Router();
const { validateRequiredFields } = require('../middleware/validation');
const { sendBadRequest, sendSuccess, sendServerError, asyncHandler } = require('../utils/responses');
const prisma = require('../prismaClient'); // Use shared singleton instance
const { getNextCustomOrder } = require('../getNextCustomOrder');

// POST /api/orders - Create a new order
router.post('/', asyncHandler(async (req, res) => {
  const { customerName, status } = req.body;
  const newOrder = await prisma.order.create({
    data: {
      customerName,
      status,
    }
  });
  res.status(201).json(newOrder);
}));

// GET /api/orders - Get all orders
router.get('/', asyncHandler(async (req, res) => {
  const orders = await prisma.order.findMany({
    orderBy: {
      createdAt: 'desc'
      }
    });
    res.json(orders);
}));

// GET /api/orders/:id - Get a specific order
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await prisma.order.findUnique({
    where: { id: parseInt(id) }
  });
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
}));

// PUT /api/orders/:id - Update a specific order
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
    const { customerName, status } = req.body;
    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(id) },
      data: {
        customerName,
        status,
      }
    });
    res.json(updatedOrder);
}));

// DELETE /api/orders/:id - Delete a specific order
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.order.delete({
    where: { id: parseInt(id) }
    });
    res.json({ message: 'Order deleted successfully' });
}));

// GET /api/orders/custom/next - Get next custom order item (for testing and direct access)
router.get('/custom/next', asyncHandler(async (req, res) => {
  const customOrderData = await getNextCustomOrder(req);
  res.json(customOrderData);
}));

module.exports = router;
