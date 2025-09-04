const express = require('express');
const app = express();

app.use(express.json());

// Simple test endpoint
app.get('/api/test', (req, res) => {
  console.log('📱 Simple test endpoint called');
  res.json({ message: 'Test successful', timestamp: new Date().toISOString() });
});

const PORT = 3003;
app.listen(PORT, () => {
  console.log(`🧪 Simple test server running on port ${PORT}`);
  console.log(`Test the endpoint: http://localhost:${PORT}/api/test`);
});

process.on('SIGINT', () => {
  console.log('\n🔌 Simple test server shutting down...');
  process.exit(0);
});
