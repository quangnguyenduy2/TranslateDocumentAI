Test Runner Tutorial

Purpose
- Quick guide to run the TypeScript test suite using Node + ts-node ESM loader in this repository.

Prerequisites
- Node >= 18 (Node v24 used during development).
- pnpm (or npm/yarn) available.
- Run from the `TranslateDocumentAI` workspace folder.

Install dependencies
```bash
cd "TranslateDocumentAI"
pnpm install
```

Run the full test suite
- Command used successfully in this repo:
```bash
node --loader ts-node/esm tests/run_all_tests.ts
```
- Explanation: uses `ts-node` as an ESM loader so TypeScript test files run directly without a build step.

Run a single test file
```bash
node --loader ts-node/esm tests/mock_gemini_test.ts
```

Add a convenience npm script
- Add to `package.json` under `scripts`:
```json
"test:tsnode": "node --loader ts-node/esm tests/run_all_tests.ts"
```
Then run:
```bash
pnpm run test:tsnode
```

Common errors & fixes
- ERR_MODULE_NOT_FOUND for local imports
  - Node ESM requires explicit file extensions for local imports. Ensure test files import local modules with `.ts` (e.g. `import x from '../services/foo.ts'`).
- TypeScript syntax errors (enums, types) when not using ts-node/esm
  - Use `node --loader ts-node/esm` so TypeScript syntax is handled by ts-node.
- `indexedDB is not defined`
  - Node doesn't provide browser IndexedDB. Options:
    - Use the in-repo Node fallback (already added in `services/storage.ts`) used only during tests.
    - Or install a polyfill: `pnpm add -D fake-indexeddb` and initialize it before tests:
      ```js
      globalThis.indexedDB = require('fake-indexeddb');
      ```
- `@jest/globals` import/type errors
  - Install types and add to tsconfig: `pnpm add -D @types/jest` and add `"jest"` to `compilerOptions.types`.
- Experimental loader warnings
  - The `--experimental-loader` warning is benign; it warns about future Node changes. Use `--trace-warnings` if you need details or switch to `ts-node`'s `register()` method if desired.

Debugging tips
- Show loader warnings and traces:
```bash
node --trace-warnings --loader ts-node/esm tests/run_all_tests.ts
```
- Run TypeScript type-check only:
```bash
pnpm exec tsc --noEmit
```

CI suggestion (GitHub Actions)
- Example job to run the tests (add to `.github/workflows/ci.yml`):
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install
        run: pnpm install
      - name: Run tests
        run: node --loader ts-node/esm tests/run_all_tests.ts
```

Notes & recommendations
- The repo includes an in-memory IndexedDB fallback used for Node tests only; if you prefer an external polyfill, install `fake-indexeddb` and remove the fallback.
- Keep local test imports explicit (`.ts`) while running under Node ESM or configure a build step that emits JS before testing.

If you want, I can:
- Add the `test:tsnode` script to `package.json`.
- Commit these changes and open a PR.
- Add a small wrapper that sets `globalThis.indexedDB = require('fake-indexeddb')` for CI instead of the in-repo fallback.

Created: `testTutorial.md` in project root.
