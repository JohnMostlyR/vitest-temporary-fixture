/**
 * @copyright Johan Meester <JohnMostlyR@gmail.com>
 * @license MIT
 */

import { access, lstat, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  FixtureAsync,
  testDirAsync,
  testFixturesAsync,
} from '../src/temporary-fixture-async.js';

describe('TestFixturesAsync', () => {
  afterEach(() => {
    // Reset keepFixture after each test
    testFixturesAsync.keepFixture = false;
  });

  describe('testDirAsync()', () => {
    it('should generate some fixtures', async () => {
      /* ARRANGE */
      expect.assertions(7);

      /* ACT */
      const dir = await testDirAsync({
        file: 'some contents',
        subDir: {
          link: new FixtureAsync('link', '../file'),
        },
      });

      /* ASSERT */
      await expect(
        lstat(dir).then((result) => result.isDirectory()),
      ).resolves.toBe(true);
      await expect(
        lstat(join(dir, 'file')).then((result) => result.isFile()),
      ).resolves.toBe(true);
      await expect(
        lstat(join(dir, 'subDir')).then((result) => result.isDirectory()),
      ).resolves.toBe(true);
      await expect(
        lstat(join(dir, 'subDir', 'link')).then((result) => result.isFile()),
      ).resolves.toBe(true);
      await expect(readFile(join(dir, 'file'), 'utf8')).resolves.toBe(
        'some contents',
      );
      await expect(readFile(join(dir, 'subDir', 'link'), 'utf8')).resolves.toBe(
        'some contents',
      );

      await writeFile(join(dir, 'file'), 'new contents');

      await expect(readFile(join(dir, 'file'), 'utf8')).resolves.toBe(
        'new contents',
      );
    });

    it('should provide access to testDir getter', async () => {
      /* ARRANGE & ACT */
      const dir = await testDirAsync({
        file: 'test content',
      });

      /* ASSERT */
      expect(testFixturesAsync.testDir).toBe(dir);
      expect(typeof testFixturesAsync.testDir).toBe('string');
    });

    it('should provide access to isTestDirCreated getter', async () => {
      /* ARRANGE & ACT */
      await testDirAsync({
        file: 'test content',
      });

      /* ASSERT */
      expect(testFixturesAsync.isTestDirCreated).toBe(true);
    });

    it('should support keepFixture setter and getter', () => {
      /* ARRANGE */
      expect(testFixturesAsync.keepFixture).toBe(false);

      /* ACT */
      testFixturesAsync.keepFixture = true;

      /* ASSERT */
      expect(testFixturesAsync.keepFixture).toBe(true);

      // Reset for other tests
      testFixturesAsync.keepFixture = false;
    });

    it('should use fixture() method to create fixtures', async () => {
      /* ARRANGE */
      const customFixture = testFixturesAsync.fixture('file', 'custom content');

      /* ACT */
      const dir = await testDirAsync({
        custom: customFixture,
      });

      /* ASSERT */
      await expect(readFile(join(dir, 'custom'), 'utf8')).resolves.toBe(
        'custom content',
      );
    });

    it('should create an empty test directory when no content provided', async () => {
      /* ARRANGE & ACT */
      const dir = await testDirAsync({});

      /* ASSERT */
      await expect(
        lstat(dir).then((result) => result.isDirectory()),
      ).resolves.toBe(true);
      await expect(access(dir)).resolves.toBeUndefined();
    });

    it('should throw error when fixture creation fails', async () => {
      /* ARRANGE */
      // Create a fixture with a cyclic reference to trigger an error
      const cyclicContent: any = {};
      cyclicContent.self = cyclicContent;

      /* ACT & ASSERT */
      await expect(testDirAsync(cyclicContent)).rejects.toThrow(
        '[TestFixtures.createTestDir()] Failed to create test directory:',
      );
    });
  });
});
