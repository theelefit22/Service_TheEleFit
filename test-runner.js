#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure results directory exists
const resultsDir = path.join(__dirname, 'results');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

// Run tests with coverage, excluding App.test.js for now
const testProcess = spawn('npm', ['test', '--', '--testPathPattern="(promptParser|aicoachService|useAuth|AiCoach)\\.test\\.js"', '--coverage', '--watchAll=false', '--silent'], {
  stdio: 'inherit',
  shell: true
});

testProcess.on('close', (code) => {
  console.log(`Test process exited with code ${code}`);
  
  // Copy coverage reports to results directory
  const coverageDir = path.join(__dirname, 'coverage');
  if (fs.existsSync(coverageDir)) {
    // Copy lcov report
    const lcovReport = path.join(coverageDir, 'lcov.info');
    if (fs.existsSync(lcovReport)) {
      fs.copyFileSync(lcovReport, path.join(resultsDir, 'lcov.info'));
    }
    
    // Copy junit report
    const junitReport = path.join(__dirname, 'junit.xml');
    if (fs.existsSync(junitReport)) {
      fs.copyFileSync(junitReport, path.join(resultsDir, 'junit.xml'));
    }
    
    console.log('Coverage reports copied to results directory');
  }
  
  process.exit(code);
});