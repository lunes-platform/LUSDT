#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const processes = [];

function startProcess(name, command, cwd) {
  console.log(`🚀 Starting ${name}...`);
  
  const proc = spawn('pnpm', ['run', command], {
    cwd: path.resolve(cwd),
    stdio: ['inherit', 'pipe', 'pipe']
  });
  
  proc.stdout.on('data', (data) => {
    console.log(`[${name}] ${data.toString().trim()}`);
  });
  
  proc.stderr.on('data', (data) => {
    console.error(`[${name}] ${data.toString().trim()}`);
  });
  
  proc.on('close', (code) => {
    console.log(`[${name}] Process exited with code ${code}`);
  });
  
  processes.push({ name, proc });
  return proc;
}

function cleanup() {
  console.log('\n🛑 Shutting down all processes...');
  processes.forEach(({ name, proc }) => {
    console.log(`Stopping ${name}...`);
    proc.kill('SIGTERM');
  });
  process.exit(0);
}

// Handle cleanup on exit
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start all development servers
console.log('🎯 Starting LUSDT development environment...\n');

startProcess('shared-components', 'dev', 'packages/shared-components');
startProcess('admin-panel', 'dev', 'apps/admin-panel');
startProcess('user-interface', 'dev', 'apps/user-interface');

console.log('\n✅ All development servers started!');
console.log('Press Ctrl+C to stop all servers.\n');