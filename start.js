#!/usr/bin/env node

/**
 * Production Startup Script for Eddie Life Management
 * 
 * This script handles the production startup of the application with:
 * - Environment detection
 * - Database schema configuration  
 * - Static file serving
 * - Proper error handling
 */

const express = require('express');
const path = require('path');
const { existsSync } = require('fs');

// Set production environment
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.PORT = process.env.PORT || 3001;

console.log('🚀 Starting Eddie Life Management in Production Mode');
console.log('====================================================');
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`PORT: ${process.env.PORT}`);
console.log(`Working Directory: ${process.cwd()}`);

// Ensure server directory exists
const serverPath = path.join(__dirname, 'server');
if (!existsSync(serverPath)) {
    console.error('❌ Server directory not found:', serverPath);
    process.exit(1);
}

// Change to server directory for proper module resolution
process.chdir(serverPath);
console.log(`Changed working directory to: ${process.cwd()}`);

// Setup database schema for production
console.log('🔧 Setting up database schema...');
try {
    const { setupSchema } = require('./setup-schema.js');
    const dbType = process.env.DATABASE_URL?.startsWith('postgresql') ? 'postgresql' : 'sqlite';
    console.log(`Detected database type: ${dbType}`);
    
    if (!setupSchema(dbType)) {
        console.error('❌ Failed to setup database schema');
        process.exit(1);
    }
    console.log('✅ Database schema configured successfully');
} catch (error) {
    console.error('❌ Error setting up database schema:', error.message);
    process.exit(1);
}

// Create Express app for serving client files
const app = express();

// Serve static files from client/dist
const clientDistPath = path.join(__dirname, 'client', 'dist');
console.log(`Looking for client files at: ${clientDistPath}`);

if (existsSync(clientDistPath)) {
    console.log('✅ Client build found - serving static files');
    app.use(express.static(clientDistPath));
    
    // Handle client-side routing (SPA)
    app.get('*', (req, res, next) => {
        // Skip API routes
        if (req.path.startsWith('/api/')) {
            return next();
        }
        
        // Serve index.html for all other routes
        const indexPath = path.join(clientDistPath, 'index.html');
        if (existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.status(404).send('Client build incomplete - index.html not found');
        }
    });
} else {
    console.warn('⚠️  Client build not found - API only mode');
    
    // Provide a basic landing page
    app.get('/', (req, res) => {
        res.json({
            message: 'Eddie Life Management API Server',
            version: '1.0.0',
            status: 'running',
            mode: 'api-only',
            timestamp: new Date().toISOString()
        });
    });
}

// Import and mount the server routes
console.log('🔌 Loading server application...');
try {
    const serverApp = require('./index.js');
    
    // If the server exports an app, mount it
    if (typeof serverApp === 'function') {
        app.use('/api', serverApp);
    } else {
        // If server is already running its own Express instance,
        // we just need to start our static file server on a different port
        console.log('📡 Server is running independently');
    }
} catch (error) {
    console.error('❌ Error loading server application:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// Graceful shutdown handling
process.on('SIGINT', () => {
    console.log('\n📴 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n📴 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

console.log('✅ Production startup script completed successfully');
console.log('🎯 Eddie Life Management is ready to serve requests');
