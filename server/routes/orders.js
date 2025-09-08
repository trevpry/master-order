const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { getNextCustomOrder } = require('../getNextCustomOrder');

const prisma = new PrismaClient();

// POST /api/orders - Create a new order
router.post('/', async (req, res) => {
  try {
    const { customerName, status } = req.body;
    const newOrder = await prisma.order.create({
      data: {
        customerName,
        status,
      }
    });
    res.status(201).json(newOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// GET /api/orders - Get all orders
router.get('/', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/orders/:id - Get a specific order
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) }
    });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// PUT /api/orders/:id - Update a specific order
router.put('/:id', async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// DELETE /api/orders/:id - Delete a specific order
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.order.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// GET /api/orders/custom/next - Get next custom order item (for testing and direct access)
router.get('/custom/next', async (req, res) => {
  try {
    const customOrderData = await getNextCustomOrder(req);
    res.json(customOrderData);
  } catch (error) {
    console.error('Failed to get next custom order item:', error.message);
    res.status(500).json({ 
      error: 'Failed to get next custom order item',
      details: error.message 
    });
  }
});

module.exports = router;
