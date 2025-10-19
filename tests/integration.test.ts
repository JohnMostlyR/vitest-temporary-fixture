import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { testDirAsync } from '../src/index.js';

describe('Vitest Temporary Fixture (async)', () => {
  it('can create a directory with a text file', async () => {
    /* ARRANGE */
    expect.assertions(2);

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
