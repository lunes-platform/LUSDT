#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const packages = [
  'packages/shared-utils',
  'packages/shared-components', 
  'packages/blockchain-services'
];

const apps = [
  'apps/admin-panel',
  'apps/user-interface'
];

function buildPackage(packagePath) {
  console.log(`Building ${packagePath}...`);
  
  const fullPath = path.resolve(packagePath);
  const packageJsonPath = path.join(fullPath, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.warn(`Skipping ${packagePath} - no package.json found`);
    return;
  }
  
  try {
    execSync('npm run build', { 
      cwd: fullPath, 
      stdio: 'inherit' 
    });
    console.log(`✅ Built ${packagePath}`);
  } catch (error) {
    console.error(`❌ Failed to build ${packagePath}:`, error.message);
    process.exit(1);
  }
}

function buildAll() {
  console.log('🚀 Building all packages and apps...\n');
  
  // Build packages first (dependencies)
  console.log('📦 Building packages...');
  packages.forEach(buildPackage);
  
  console.log('\n🎯 Building applications...');
  apps.forEach(buildPackage);
  
  console.log('\n✅ All builds completed successfully!');
}

if (require.main === module) {
  buildAll();
}

module.exports = { buildPackage, buildAll };