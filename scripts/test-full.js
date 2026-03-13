#!/usr/bin/env node
/**
 * Test completo: build + tests unitarios + smoke (opcional).
 * Ejecutar con: node scripts/test-full.js
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
let failed = false;

function run(cmd, args, cwd = root) {
  console.log('\n📦', cmd, args.join(' '), '\n');
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
  });
  if (r.status !== 0) failed = true;
  return r.status;
}

// 1. Backend tests
run('npm', ['run', 'test'], path.join(root, 'backend'));

// 2. Frontend tests
run('npm', ['run', 'test'], path.join(root, 'frontend'));

// 3. Build
run('npm', ['run', 'backend:build']);
run('npm', ['run', 'frontend:build']);

if (failed) {
  console.log('\n❌ Algunos tests o builds fallaron.\n');
  process.exit(1);
}

console.log('\n✅ Todos los tests y builds pasaron.\n');
process.exit(0);
