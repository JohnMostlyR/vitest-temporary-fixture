# vitest-temporary-fixture

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Coverage Status](https://img.shields.io/badge/coverage-reports-green)](./reports/coverage/index.html)

Utilities for creating temporary directories and fixtures in [Vitest](https://vitest.dev/) tests that are exposed of after the test has finished.

Easily create, use, and clean up temporary files and directories during test runs. Supports both synchronous and asynchronous APIs for flexible test setups.

The temporary directories and fixtures are created in the user's TEMP folder.

## Features

- Create and manage temporary directories for tests
- Define fixtures for use in Vitest test suites
- Async and sync APIs for flexibility
- Simple integration with Vitest

## Getting Started

```typescript
import { FixtureAsync, testDirAsync } from 'vitest-temporary-fixture';

const dir = await testDirAsync({
  // Objects are subdirectories
  packages: {
    pkg: {
      'package.json': '{}',
    },
  },

  // Strings or Buffers are files
  'package-lock.json': '{}',
  'package.json': JSON.stringify({
    private: true,
    workspaces: ['packages/*'],
  }),

  // to create links or symlinks, use the `Fixture` class
  symlink: new FixtureAsync('symlink', 'packages'),
});
```

**NOTE:** Relative and Symbolic links are supported but one is not allowed to point to something _outside_ the created directory. This is a security consideration.

### Synchronous Example

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { testDir } from 'vitest-temporary-fixture';

describe('Vitest Temporary Fixture (sync)', () => {
  it('can create a directory with a text file', () => {
    /* ARRANGE */
    const dir = testDir({
      'regular-file.txt': '# content',
    });

    /* ASSERT */
    expect(fs.lstatSync(dir).isDirectory()).toBe(true);
    expect(fs.readFileSync(path.join(dir, 'regular-file.txt'), 'utf8')).toBe(
      '# content',
    );
  });

  it('can create a complete folder structure', () => {
    /*
     * For debugging, one can set 'keepFixture' to `true`.
     * The temporary folder is created in the user's `temp` folder starting with
     * `vitest_<random string>`.
     */
    // testFixtures.keepFixture = true;

    /* ARRANGE */
    const dir = testDir({
      src: {
        'index.ts', 'console.log("Hello World");'
      },
      'package.json': JSON.stringify({
        name: 'my-package',
        version: '0.1.0',
      })
    });

    // console.log(`temp dir path: ${dir}`);

    /* ASSERT */
    expect(fs.lstatSync(dir).isDirectory()).toBe(true);
    expect(fs.lstatSync(path.join(dir, 'src')).isDirectory()).toBe(true);
    expect(fs.readFileSync(path.join(dir, 'src', 'index.ts'), 'utf8')).toBe(
      'console.log("Hello World");',
    );
    expect(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).toBe(
      {
        name: 'my-package',
        version: '0.1.0',
      }
    );
  });
});
```

### Asynchronous Example

```typescript
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { testDirAsync, testFixturesAsync } from 'vitest-temporary-fixture';

describe('Vitest Temporary Fixture (async)', () => {
  it('can create a directory with a text file', async () => {
    /* ARRANGE */
    expect.assertions(2);

    /*
     * For debugging, one can set 'keepFixture' to `true`.
     * The temporary folder is created in the user's `temp` folder starting with
     * `vitest_<random string>`.
     */
    // testFixturesAsync.keepFixture = true;

    const dir = await testDirAsync({
      'regular-file.txt': '# content',
    });

    /* ASSERT */
    await expect(
      fsPromises.lstat(dir).then((result) => result.isDirectory()),
    ).resolves.toBe(true);

    await expect(
      fsPromises.readFile(path.join(dir, 'regular-file.txt'), 'utf8'),
    ).resolves.toBe('# content');
  });
});
```

## API Overview

- `Fixture` – Synchronous fixture helper
- `FixtureAsync` – Asynchronous fixture helper
- `testDir` – Synchronously create and use a temporary directory in a test
- `testDirAsync` – Asynchronously create and use a temporary directory in a test
- `testFixtures` – Synchronously manage multiple temporary fixtures
- `testFixturesAsync` – Asynchronously manage multiple temporary fixtures

See the source files in [`src/`](./src) for detailed API documentation and more examples.

## Compatibility

- **Vitest**: v1.x or later
- **Node.js**: v18 or later recommended

## License

MIT License © Johan Meester
