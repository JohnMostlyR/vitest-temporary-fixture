/**
 * @copyright Johan Meester <JohnMostlyR@gmail.com>
 * @license MIT
 */

/*
 * This is an adaptation of the @tapjs/fixture package.
 * see:https://github.com/tapjs/tapjs/blob/main/src/fixture/README.md
 * Published under the Blue Oak Model License
 * see: https://blueoakcouncil.org/license/1.0.0
 */

import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { onTestFailed, onTestFinished } from 'vitest';

import type {
  FixtureContentAsync,
  FixtureDirContentAsync,
  FixtureType,
} from './fixture-async.js';
import { FixtureAsync } from './fixture-async.js';

interface TestFixturesOptions {
  testDir?: string;
  keepFixture?: boolean;
}

class TestFixturesAsync {
  #testDir: string | undefined = undefined;

  #testFinished = false;
  #createdTestDir = false;
  #keepFixture = false;

  constructor() {
    /* empty */
  }

  /**
   * Set whether the fixture should be kept or not
   *
   * Must be set *BEFORE* calling `testDir()`, or it will not have any
   * effect.
   *
   * @param {boolean} keep
   */
  set keepFixture(keep: boolean) {
    this.#keepFixture = keep;
  }

  get keepFixture() {
    return this.#keepFixture;
  }

  /**
   * The name of the folder that this test will use.
   */
  get testDir() {
    return this.#testDir;
  }

  get isTestDirCreated() {
    return this.#createdTestDir;
  }

  /**
   * Create a fixture object for use in a TestFixtures#testDir method.
   *
   * @template {FixtureType} T
   * @param {T} type
   * @param {FixtureContentAsync<T>} content
   */
  fixture<T extends FixtureType>(type: T, content: FixtureContentAsync<T>) {
    return new FixtureAsync(type, content);
  }

  #handleTestEnd() {
    if (!this.#testFinished) {
      this.#testFinished = true;

      if (!this.#keepFixture && this.#testDir) {
        fs.rmSync(this.#testDir, { recursive: true, force: true });
      }
    }
  }

  /**
   * Creates a test directory, optionally adding contents.
   *
   * This directory will be automatically deleted at the end of the test.
   *
   * To _keep_ the directory after the test, set the
   * `testFixtures.keepFixture = true` *BEFORE* calling `testDir()`.
   *
   * @param {FixtureDirContentAsync} [content]
   */
  async createTestDir(content: FixtureDirContentAsync) {
    try {
      // Reset state for each test directory creation
      this.#testFinished = false;
      this.#createdTestDir = false;

      this.#testDir = await fsPromises.mkdtemp(join(tmpdir(), 'vitest_'));
      await FixtureAsync.make(this.#testDir, content || {});
      this.#createdTestDir = true;

      /* Register cleanup hooks */
      onTestFailed(() => this.#handleTestEnd());
      onTestFinished(() => this.#handleTestEnd());

      return this.#testDir;
    } catch (err) {
      throw new Error(
        `[TestFixtures.createTestDir()] Failed to create test directory: ${err}`,
      );
    }
  }
}

const testFixturesAsync = new TestFixturesAsync();

/**
 * Creates a test directory, optionally adding contents.
 *
 * The directory will be automatically deleted at the end of the test.
 *
 * To _keep_ the directory after the test, set the
 * `testFixturesAsync.keepFixture = true` *BEFORE* calling `testDirAsync()`.
 *
 * @example
 * ```js
 * import { FixtureAsync, testDirAsync } from 'vitest-temporary-fixture';
 *
 * const dir = await testDirAsync({
 *   // Objects are subdirectories
 *   packages: {
 *     pkg: {
 *       'package.json': '{}',
 *     },
 *   },
 *
 *   // Strings or Buffers are files
 *   'package-lock.json': '{}',
 *   'package.json': JSON.stringify({
 *     private: true,
 *     workspaces: ['packages/*'],
 *   }),
 *
 *   // to create links or symlinks, use the `Fixture` class
 *   symlink: new FixtureAsync('symlink', 'packages'),
 * });
 * ```
 *
 * @param {FixtureDirContentAsync} [content]
 */
const testDirAsync = (content: FixtureDirContentAsync) =>
  testFixturesAsync.createTestDir(content);

export * from './fixture-async.js';
export type { TestFixturesOptions };
export { testFixturesAsync, testDirAsync };
