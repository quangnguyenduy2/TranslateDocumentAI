// CommonJS runner that registers ts-node and runs tests written in TypeScript
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } });

const mod = require('./tests/index.ts');
const allTests = mod.allTests;

(async () => {
  console.log(`Running ${allTests.length} tests (CJS runner)...`);
  let failed = 0;
  for (const t of allTests) {
    try {
      process.stdout.write(`${t.id} - ${t.name} ... `);
      const res = await t.run();
      if (res.success) {
        console.log('OK');
      } else {
        failed++;
        console.log('FAIL');
        console.error('  ', res.message, res.details || '');
      }
    } catch (e) {
      failed++;
      console.log('ERROR');
      console.error(e);
    }
  }

  console.log(`\nTests finished. ${allTests.length - failed}/${allTests.length} passed, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
})();