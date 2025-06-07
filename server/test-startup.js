// Test server startup
console.log('Starting server test...');

try {
  console.log('1. Loading dependencies...');
  const express = require('express');
  const cors = require('cors');
  console.log('✅ Express loaded');
  
  const prisma = require('./prismaClient');
  console.log('✅ Prisma client loaded');
  
  console.log('2. Testing database connection...');
  prisma.customOrder.count()
    .then(count => {
      console.log(`✅ Database connected! Found ${count} custom orders.`);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Database connection failed:', error);
      process.exit(1);
    });
    
} catch (error) {
  console.error('❌ Failed to load dependencies:', error);
  process.exit(1);
}
