const express = require('express');
const path = require('path');
const app = express();
const port = 3001;

// Serve static files from the build directory
app.use(express.static(path.join(__dirname, 'build')));

// Handle SPA routing - serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(port, () => {
  console.log(`🚀 Local server running at http://localhost:${port}`);
  console.log(`📱 Test your SPA routing at http://localhost:${port}/aicoach`);
});
