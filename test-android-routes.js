// Test script to debug Android routes import issue
console.log('🔍 Testing Android routes imports...');

try {
  console.log('1. Testing express...');
  const express = require('express');
  console.log('✅ Express loaded');

  console.log('2. Testing node-fetch...');
  const fetch = require('node-fetch');
  console.log('✅ node-fetch loaded');

  console.log('3. Testing prismaClient...');
  const prisma = require('./server/prismaClient');
  console.log('✅ PrismaClient loaded');

  console.log('4. Testing getNextEpisode...');
  const getNextEpisode = require('./server/getNextEpisode');
  console.log('✅ getNextEpisode loaded');

  console.log('5. Testing getNextMovie...');
  const getNextMovie = require('./server/getNextMovie');
  console.log('✅ getNextMovie loaded');

  console.log('6. Testing getNextCustomOrder...');
  const { getNextCustomOrder } = require('./server/getNextCustomOrder');
  console.log('✅ getNextCustomOrder loaded');

  console.log('7. Testing Android routes...');
  const androidRoutes = require('./server/routes/android');
  console.log('✅ Android routes loaded successfully!');

  console.log('🎉 All imports successful!');
  process.exit(0);
} catch (error) {
  console.error('❌ Import error:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}
