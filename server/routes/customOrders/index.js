/**
 * Custom Orders Router Factory
 * Modular router that combines all custom order domains
 * Phase 2 Modularization: Extracted from monolithic customOrders.js (1,355 lines → 5 modules)
 */

const express = require('express');
const { PrismaClient } = require('@prisma/client');

// Import modular route creators
const createOrderManagementRoutes = require('./orderManagement');
const createItemManagementRoutes = require('./itemManagement');
const createBulkOperationsRoutes = require('./bulkOperations');
const createStatsAndUtilsRoutes = require('./statsAndUtils');

/**
 * Create complete custom orders router with all modules
 * @param {object} options - Configuration options
 * @returns {express.Router} Complete custom orders router
 */
function createCustomOrdersRouter(options = {}) {
  const router = express.Router();
  
  // Use shared database client singleton
  const prisma = require('../../prismaClient');
  
  // Initialize optional services with graceful degradation
  let artworkCache = null;
  let watchLogService = null;
  let subOrderService = null;
  let bookService = null;
  
  try {
    const ArtworkCacheService = require('../../artworkCacheService');
    const WatchLogService = require('../../watchLogService');
    const subOrderServiceModule = require('../../subOrderService');
    const BookService = require('../../services/BookService');
    
    artworkCache = new ArtworkCacheService();
    watchLogService = new WatchLogService(prisma); // Reuse shared prisma instance
    subOrderService = subOrderServiceModule;
    bookService = new BookService(prisma);
    
    console.log('Custom orders: All services loaded successfully');
  } catch (error) {
    console.warn('Custom orders: Some services not available:', error.message);
  }
  
  // Prepare service dependencies
  const services = {
    artworkCache,
    watchLogService,
    subOrderService,
    bookService
  };
  
  // Mount modular routes with proper order (most specific first)
  
  // Stats and utilities (must come before parameterized routes)
  router.use('/', createStatsAndUtilsRoutes(prisma));
  
  // Item management (individual item operations)
  router.use('/', createItemManagementRoutes(prisma, services));
  
  // Bulk operations (item creation and import)
  router.use('/', createBulkOperationsRoutes(prisma, services));
  
  // Order management (core CRUD operations - comes last for /:id routes)
  router.use('/', createOrderManagementRoutes(prisma, services));
  
  console.log('Custom orders router: All modules mounted successfully');
  
  return router;
}

module.exports = createCustomOrdersRouter;
