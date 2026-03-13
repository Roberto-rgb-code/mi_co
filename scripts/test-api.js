#!/usr/bin/env node
/**
 * Smoke test: verifica que la API responda correctamente.
 * Ejecutar con: node scripts/test-api.js [url]
 * Default: http://localhost:3000
 */
const baseUrl = process.argv[2] || 'http://localhost:3000';

async function test(endpoint, expectedStatus = 200) {
  try {
    const res = await fetch(`${baseUrl}${endpoint}`);
    const ok = res.status === expectedStatus;
    console.log(ok ? '✓' : '✗', endpoint, res.status, ok ? '' : `(esperaba ${expectedStatus})`);
    if (!ok) {
      const text = await res.text();
      console.log('  ', text.slice(0, 100));
    }
    return ok;
  } catch (e) {
    console.log('✗', endpoint, 'Error:', e.message);
    return false;
  }
}

async function main() {
  console.log('\n🧪 Smoke test API:', baseUrl, '\n');

  const results = [
    await test('/'),
    await test('/health'),
    await test('/api/modelos'),
  ];

  const passed = results.filter(Boolean).length;
  const total = results.length;

  console.log('\n' + (passed === total ? '✅ Todos los tests pasaron' : `❌ ${total - passed} fallaron`), `(${passed}/${total})\n`);
  process.exit(passed === total ? 0 : 1);
}

main();
