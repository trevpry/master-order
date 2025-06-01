const { spawn } = require('child_process');
const path = require('path');

// Define the paths
const serverPath = path.join(__dirname, 'server');
const clientPath = path.join(__dirname, 'client');

// Start the server
const server = spawn('npm', ['run', 'dev'], { cwd: serverPath, shell: true });

server.stdout.on('data', (data) => {
  console.log(`[SERVER]: ${data}`);
});

server.stderr.on('data', (data) => {
  console.error(`[SERVER ERROR]: ${data}`);
});

// Start the client
const client = spawn('npm', ['run', 'dev'], { cwd: clientPath, shell: true });

client.stdout.on('data', (data) => {
  console.log(`[CLIENT]: ${data}`);
});

client.stderr.on('data', (data) => {
  console.error(`[CLIENT ERROR]: ${data}`);
});

// Handle shutdown
process.on('SIGINT', () => {
  server.kill();
  client.kill();
  process.exit();
});
