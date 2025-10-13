/**
 * @copyright Johan Meester <JohnMostlyR@gmail.com>
 * @license MIT
 */

import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { Fixture, testDir, testFixtures } from '../src/temporary-fixture.js';

describe('TestFixtures', () => {
  afterEach(() => {
    // Reset keepFixture after each test
    testFixtures.keepFixture = false;
  });

  describe('testDirSync()', () => {
    it('should generate some fixtures', () => {
      /* ARRANGE */

      /* ACT */
      const dir = testDir({
        file: 'some contents',
        subDir: {
          link: new Fixture('link', '../file'),
        },
      });

      /* ASSERT */
      expect(lstatSync(dir).isDirectory()).toBe(true);
      expect(lstatSync(join(dir, 'file')).isFile()).toBe(true);
      expect(lstatSync(join(dir, 'subDir')).isDirectory()).toBe(true);
      expect(lstatSync(join(dir, 'subDir', 'link')).isFile()).toBe(true);
      expect(readFileSync(join(dir, 'file'), 'utf8')).toBe('some contents');
      expect(readFileSync(join(dir, 'subDir', 'link'), 'utf8')).toBe(
        'some contents',
      );

      writeFileSync(join(dir, 'file'), 'new contents');

      expect(readFileSync(join(dir, 'file'), 'utf8')).toBe('new contents');
    });

    it('should provide access to testDir getter', () => {
      /* ARRANGE & ACT */
      const dir = testDir({
        file: 'test content',
      });

      /* ASSERT */
      expect(testFixtures.testDir).toBe(dir);
      expect(typeof testFixtures.testDir).toBe('string');
    });

    it('should provide access to isTestDirCreated getter', () => {
      /* ARRANGE & ACT */
      testDir({
        file: 'test content',
      });

      /* ASSERT */
      expect(testFixtures.isTestDirCreated).toBe(true);
    });

    it('should support keepFixture setter and getter', () => {
      /* ARRANGE */
      expect(testFixtures.keepFixture).toBe(false);

      /* ACT */
      testFixtures.keepFixture = true;

      /* ASSERT */
      expect(testFixtures.keepFixture).toBe(true);

      // Reset for other tests
      testFixtures.keepFixture = false;
    });

    it('should use fixture() method to create fixtures', () => {
      /* ARRANGE */
      const customFixture = testFixtures.fixture('file', 'custom content');

      /* ACT */
      const dir = testDir({
        custom: customFixture,
      });

      /* ASSERT */
      expect(readFileSync(join(dir, 'custom'), 'utf8')).toBe('custom content');
    });

    it('should create an empty test directory when no content provided', () => {
      /* ARRANGE & ACT */
      const dir = testDir({});

      /* ASSERT */
      expect(lstatSync(dir).isDirectory()).toBe(true);
      expect(existsSync(dir)).toBe(true);
    });

    it('should throw error when fixture creation fails', () => {
      /* ARRANGE */
      // Create a fixture with a cyclic reference to trigger an error
      const cyclicContent: any = {};
      cyclicContent.self = cyclicContent;

      /* ACT & ASSERT */
      expect(() => testDir(cyclicContent)).toThrow(
        '[TestFixtures.createTestDir()] Failed to create test directory:',
      );
    });
  });
});
