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
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { inspect } from 'node:util';
import { mkdirp } from 'mkdirp';

type FixtureType = 'file' | 'dir' | 'link' | 'symlink';

interface FixtureDir {
  [entry: string]: FixtureDirContent;
}

type FixtureDirContent =
  | string
  | Buffer
  | Uint8Array
  | FixtureDir
  | Fixture<'file'>
  | Fixture<'dir'>
  | Fixture<'link'>
  | Fixture<'symlink'>;

type FixtureContent<T> = T extends 'file'
  ? string | Buffer | Uint8Array
  : T extends 'link' | 'symlink'
    ? string
    : T extends 'dir'
      ? FixtureDir
      : never;

type GetType<T extends FixtureDirContent> =
  T extends Fixture<infer Type>
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
 * @param {string} pathIn
 * @returns {fs.Stats}
 */
function checkIfPathExists(pathIn: string): fs.Stats {
  let fileStatus: fs.Stats;

  try {
    fileStatus = fs.statSync(pathIn);
  } catch (error: any) {
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
 * @param {FixtureDirContent} content
 * @returns {FixtureType}
 */
function rawToType(content: FixtureDirContent): FixtureType {
  if (content instanceof Fixture) {
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
 * @param {Record<string, FixtureDirContent>} content
 * @param {Set<Record<string, FixtureDirContent>>} seen
 */
function validateDirContents(
  content: Record<string, FixtureDirContent>,
  seen: Set<Record<string, FixtureDirContent>>,
) {
  for (const [dirName, dirContent] of Object.entries(content)) {
    const contentType = rawToType(dirContent);

    if (
      contentType === 'dir' &&
      typeof dirContent === 'object' &&
      !(dirContent instanceof Fixture)
    ) {
      const currentDirContent = dirContent as Record<string, FixtureDirContent>;

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
): asserts content is FixtureContent<T> {
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
 * @param {FixtureDirContent} content
 * @returns {Fixture<GetType<typeof content>>}
 */
function rawToFixture(
  content: FixtureDirContent,
): Fixture<GetType<typeof content>> {
  if (content instanceof Fixture) {
    return content;
  }

  return new Fixture(rawToType(content), content);
}

/**
 * Get the symlink target type
 *
 * @param {string} targetPath
 * @returns {fs.symlink.Type}
 */
function getSymLinkTargetType(targetPath: string): fs.symlink.Type {
  let out: fs.symlink.Type = 'file';

  const stats = checkIfPathExists(targetPath);

  if (stats.isDirectory()) {
    out = 'junction';
  }

  return out;
}

class Fixture<T extends FixtureType> {
  type: T;

  content: FixtureContent<T>;

  /**
   * @param {T} type
   * @param {FixtureContent<T>} content
   */
  constructor(type: T, content: FixtureContent<T>) {
    assertValidContent(type, content);

    this.type = type;
    this.content = content;
  }

  get [Symbol.toStringTag]() {
    return `Fixture<${this.type}>`;
  }

  /**
   * @param {string} pathIn
   * @param {FixtureDirContent} content
   * @param {null | { [k: string]: string } } [symlinks = null]
   */
  static make(
    pathIn: string,
    content: FixtureDirContent,
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

      mkdirp.sync(normalizedPath);

      if (isRoot) {
        /*
         * The root directory is created.
         * Every item to be created is only allowed to be created within this
         * directory and may only link to items within this directory.
         */
        allowedPaths.clear();
      }

      allowedPaths.add(normalizedPath);

      for (const [name, nestedFixture] of Object.entries(fixture.content)) {
        Fixture.make(path.join(normalizedPath, name), nestedFixture, symlinks);
      }
    } else if (fixture.type === 'file') {
      checkIfPathIsAllowed(normalizedPath);
      fs.writeFileSync(
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

      fs.linkSync(existingPath, normalizedPath);
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
      for (const [symlinkPath, target] of Object.entries(symlinks)) {
        checkIfPathIsAllowed(symlinkPath);
        checkIfPathIsAllowed(target);

        const symlinkType: fs.symlink.Type = getSymLinkTargetType(target);

        fs.symlinkSync(target, symlinkPath, symlinkType);
      }
    }
  }
}

export type { FixtureType, FixtureDir, FixtureContent, FixtureDirContent };

export { Fixture };
