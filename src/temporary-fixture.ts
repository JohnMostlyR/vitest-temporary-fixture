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
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { onTestFailed, onTestFinished } from 'vitest';

import type {
  FixtureContent,
  FixtureDirContent,
  FixtureType,
} from './fixture.js';
import { Fixture } from './fixture.js';

interface TestFixturesOptions {
  testDir?: string;
  keepFixture?: boolean;
}

class TestFixtures {
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
   * @param {FixtureContent<T>} content
   */
  fixture<T extends FixtureType>(type: T, content: FixtureContent<T>) {
    return new Fixture(type, content);
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
   * Creates a test directory, optionally adding contents
   *
   * This directory will be automatically deleted at the end of the test.
   *
   * To _keep_ the directory after the test, set the
   * `testFixtures.keepFixture = true` *BEFORE* calling `testDir()`.
   *
   * @param {FixtureDirContent} [content]
   */
  createTestDir(content: FixtureDirContent) {
    try {
      this.#testDir = fs.mkdtempSync(join(tmpdir(), 'vitest_'));
      Fixture.make(this.#testDir, content || {});
      this.#createdTestDir = true;

      /* Register cleanup hooks - wrap in try-catch to handle cases where hooks are not available */
      try {
        onTestFailed(() => this.#handleTestEnd());
        onTestFinished(() => this.#handleTestEnd());
      } catch {
        /* Hooks not available in this context, cleanup will need to be manual */
      }

      return this.#testDir;
    } catch (err) {
      throw new Error(
        `[TestFixtures.createTestDir()] Failed to create test directory: ${err}`,
      );
    }
  }
}

const testFixtures = new TestFixtures();

/**
 * Creates a test directory, optionally adding contents.
 *
 * The directory will be automatically deleted at the end of the test.
 *
 * To _keep_ the directory after the test, set the
 * `testFixtures.keepFixture = true` *BEFORE* calling `testDir()`.
 *
 * @example
 * ```js
 * import { Fixture, testDir } from 'vitest-temporary-fixture';
 *
 * const dir = testDir({
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
 *   // to create links or symlinks, use the `FixtureSync` class
 *   symlink: new Fixture('symlink', 'packages'),
 * });
 * ```
 *
 * @param {FixtureDirContent} [content]
 */
const testDir = (content: FixtureDirContent) =>
  testFixtures.createTestDir(content);

export * from './fixture.js';
export type { TestFixturesOptions };
export { testFixtures, testDir };
