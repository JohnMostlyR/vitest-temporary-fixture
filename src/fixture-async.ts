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
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { inspect } from 'node:util';
import { mkdirp } from 'mkdirp';

type FixtureType = 'file' | 'dir' | 'link' | 'symlink';

interface FixtureDirAsync {
  [entry: string]: FixtureDirContentAsync;
}

type FixtureDirContentAsync =
  | string
  | Buffer
  | Uint8Array
  | FixtureDirAsync
  | FixtureAsync<'file'>
  | FixtureAsync<'dir'>
  | FixtureAsync<'link'>
  | FixtureAsync<'symlink'>;

type FixtureContentAsync<T> = T extends 'file'
  ? string | Buffer | Uint8Array
  : T extends 'link' | 'symlink'
    ? string
    : T extends 'dir'
      ? FixtureDirAsync
      : never;

type GetTypeAsync<T extends FixtureDirContentAsync> =
  T extends FixtureAsync<infer Type>
    ? Type
    : T extends string | Buffer | Uint8Array
      ? 'file'
      : T extends number | symbol | bigint
        ? never
        : T extends object
          ? 'dir'
          : never;

const allowedPaths: Set<string> = new Set([process.cwd(), os.tmpdir()]);

function resetAllowedPaths() {
  allowedPaths.clear();
  allowedPaths.add(process.cwd());
  allowedPaths.add(os.tmpdir());
}

/**
 * @async
 * @param {string} pathIn
 * @returns {Promise<fs.Stats>}
 */
async function checkIfPathExists(pathIn: string): Promise<fs.Stats> {
  let fileStatus: fs.Stats;

  try {
    fileStatus = await fsPromises.stat(pathIn);
  } catch (/** @type {*} */ error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(
        'A fixture needs to be created in a subdirectory of the root',
      );
    }

    throw error;
  }

  return fileStatus;
}

/**
 * @param {string} newPath
 * @returns {boolean}
 */
function checkIfPathIsAllowed(newPath: string): boolean {
  const dirname = path.dirname(newPath);

  if (allowedPaths.has(dirname)) {
    return true;
  }

  throw new Error(
    `Illegal path. Creating, or linking to, path [START]->${dirname}<-[END] is ` +
      `not allowed.\n` +
      `Allowed paths are:\n${inspect(allowedPaths)}`,
  );
}

/**
 * @param {FixtureDirContentAsync} content
 * @returns {FixtureType}
 */
function rawToType(content: FixtureDirContentAsync): FixtureType {
  if (content instanceof FixtureAsync) {
    return content.type;
  }

  const contentType = typeof content;
  if (
    contentType === 'string' ||
    Buffer.isBuffer(content) ||
    content instanceof Uint8Array
  ) {
    return 'file';
  }

  if (contentType === 'object') {
    return 'dir';
  }

  throw new Error(`Invalid fixture content:\n\t[START]->${content}<-[END]`);
}

/**
 * @param {Record<string, FixtureDirContentAsync>} content
 * @param {Set<Record<string, FixtureDirContentAsync>>} seen
 */
function validateDirContents(
  content: Record<string, FixtureDirContentAsync>,
  seen: Set<Record<string, FixtureDirContentAsync>>,
) {
  for (const [dirName, dirContent] of Object.entries(content)) {
    const contentType = rawToType(dirContent);

    if (
      contentType === 'dir' &&
      typeof dirContent === 'object' &&
      !(dirContent instanceof FixtureAsync)
    ) {
      const currentDirContent = dirContent as Record<
        string,
        FixtureDirContentAsync
      >;

      if (seen.has(currentDirContent)) {
        throw new Error(
          `Cycle detected in fixture contents at [START]->${dirName}<-[END]`,
        );
      }

      seen.add(currentDirContent);
      validateDirContents(currentDirContent, seen);
    }
  }
}

/**
 * @template {FixtureType} T
 * @param {FixtureType} type
 * @param {*} content
 */
function assertValidContent<T extends FixtureType>(
  type: T,
  content: any,
): asserts content is FixtureContentAsync<T> {
  switch (type) {
    case 'dir':
      if (typeof content !== 'object') {
        throw new TypeError("A 'dir' fixture must have an Object as content");
      }

      validateDirContents(content, new Set([content]));
      break;
    case 'file':
      if (
        typeof content !== 'string' &&
        !Buffer.isBuffer(content) &&
        !(content instanceof Uint8Array)
      ) {
        throw new TypeError(
          "A 'file' fixture must have a String, or Buffer as content",
        );
      }
      break;
    case 'link':
    case 'symlink':
      if (typeof content !== 'string') {
        throw new TypeError(
          `A '${type}' fixture must have a target of type String`,
        );
      }
      break;
    default:
      throw new Error(`Invalid fixture type: '${type}'`);
  }
}

/**
 * @param {FixtureDirContentAsync} content
 * @returns {FixtureAsync<GetTypeAsync<typeof content>>}
 */
function rawToFixture(
  content: FixtureDirContentAsync,
): FixtureAsync<GetTypeAsync<typeof content>> {
  if (content instanceof FixtureAsync) {
    return content;
  }

  return new FixtureAsync(rawToType(content), content);
}

/**
 * Get the symlink target type
 *
 * @param {string} targetPath
 * @returns {Promise<fs.symlink.Type>}
 */
async function getSymLinkTargetType(
  targetPath: string,
): Promise<fs.symlink.Type> {
  let out: fs.symlink.Type = 'file';

  const stats = await checkIfPathExists(targetPath);

  if (stats.isDirectory()) {
    out = 'junction';
  }

  return out;
}

/**
 * @template {FixtureType} T
 */
class FixtureAsync<T extends FixtureType> {
  type: T;

  content: FixtureContentAsync<T>;

  /**
   * @param {T} type
   * @param {FixtureContentAsync<T>} content
   */
  constructor(type: T, content: FixtureContentAsync<T>) {
    assertValidContent(type, content);

    this.type = type;
    this.content = content;
  }

  get [Symbol.toStringTag]() {
    return `Fixture<${this.type}>`;
  }

  /**
   * @static
   * @async
   * @param {string} pathIn
   * @param {FixtureDirContentAsync} content
   * @param {null | { [k: string]: string } } [symlinks = null]
   */
  static async make(
    pathIn: string,
    content: FixtureDirContentAsync,
    symlinks: null | { [k: string]: string } = null,
  ) {
    if (typeof pathIn !== 'string') {
      throw new TypeError("'path' should be a String");
    }

    const normalizedPath = path.normalize(pathIn);
    const fixture = rawToFixture(content);

    const isRoot = symlinks === null;
    symlinks = symlinks || {};

    if (isRoot) {
      resetAllowedPaths();
    }

    if (fixture.type === 'dir') {
      checkIfPathIsAllowed(normalizedPath);

      await mkdirp(normalizedPath);

      if (isRoot) {
        /*
         * The root directory is created.
         * Every item to be created is only allowed to be created within this
         * directory and may only link to items within this directory.
         */
        allowedPaths.clear();
      }

      allowedPaths.add(normalizedPath);

      const entries = Object.entries(fixture.content);
      for (const [name, nestedFixture] of entries) {
        await FixtureAsync.make(
          path.join(normalizedPath, name),
          nestedFixture,
          symlinks,
        );
      }
    } else if (fixture.type === 'file') {
      checkIfPathIsAllowed(normalizedPath);

      await fsPromises.writeFile(
        normalizedPath,
        fixture.content as string | Buffer | Uint8Array,
      );
    } else if (fixture.type === 'link') {
      const normalizedPathDirName = path.dirname(normalizedPath);
      const existingPath = path.resolve(
        normalizedPathDirName,
        fixture.content as string,
      );

      checkIfPathIsAllowed(existingPath);
      checkIfPathIsAllowed(normalizedPath);

      await fsPromises.link(existingPath, normalizedPath);
    } else if (fixture.type === 'symlink') {
      const targetPath = path.resolve(
        path.dirname(normalizedPath),
        fixture.content as string,
      );

      /*
       * On Windows it is not allowed to create a symLink to target something
       * that does not exist.
       * Therefore we gather up all symLinks and create these at the end.
       */
      symlinks[normalizedPath] = targetPath;
    } else {
      throw new Error(`[Fixture.make()] unknown fixture type: ${fixture.type}`);
    }

    /* Now it is time to create all symlinks we asked for */
    if (isRoot) {
      const symlinkEntries = Object.entries(symlinks);
      for (const [symlinkPath, target] of symlinkEntries) {
        checkIfPathIsAllowed(symlinkPath);
        checkIfPathIsAllowed(target);

        const symlinkType: fs.symlink.Type = await getSymLinkTargetType(target);

        await fsPromises.symlink(target, symlinkPath, symlinkType);
      }
    }
  }
}

export type {
  FixtureType,
  FixtureDirAsync,
  FixtureContentAsync,
  FixtureDirContentAsync,
};
export { FixtureAsync };
