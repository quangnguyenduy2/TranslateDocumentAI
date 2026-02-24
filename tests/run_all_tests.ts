
(async () => {
  // Dynamic import with explicit .ts resolves loader differences in ts-node ESM
  const mod = await import(new URL('./index.ts', import.meta.url).href);
  const allTests = mod.allTests as any[];

  console.log(`Running ${allTests.length} tests...`);
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