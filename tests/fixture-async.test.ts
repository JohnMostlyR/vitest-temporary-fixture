/**
 * @copyright Johan Meester <JohnMostlyR@gmail.com>
 * @license MIT
 */

import { existsSync, lstatSync, unlinkSync, writeFileSync } from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { rimraf, rimrafSync } from 'rimraf';
import uniqueString from 'unique-string';
import { describe, expect, it } from 'vitest';

import { FixtureAsync } from '../src/fixture-async.js';

const TEMP = tmpdir();

describe('FixtureAsync', () => {
  describe('fixture type validation', () => {
    describe('valid fixture types', () => {
      it('should correctly determine the type to be "file"', () => {
        /* ARRANGE */
        const expected = 'file';

        /* ACT */
        let result = new FixtureAsync('file', 'hello');

        /* ASSERT */
        expect(result.type).toBe(expected);

        /* ACT */
        result = new FixtureAsync('file', Buffer.from('hello'));

        /* ASSERT */
        expect(result.type).toBe(expected);

        /* ACT */
        result = new FixtureAsync('file', new Uint8Array(Buffer.from('hello')));

        /* ASSERT */
        expect(result.type).toBe(expected);
      });

      it('should correctly determine the type to be "directory"', () => {
        /* ARRANGE */
        const expected = '[object Fixture<dir>]';

        /* ACT */
        const result = Object.prototype.toString.call(
          new FixtureAsync('dir', {}),
        );

        /* ASSERT */
        expect(result).toBe(expected);
      });

      it('should correctly determine the type to be "link"', () => {
        /* ARRANGE */
        const expected = 'link';

        /* ACT */
        const result = new FixtureAsync('link', 'target');

        /* ASSERT */
        expect(result.type).toBe(expected);
      });

      it('should correctly determine the type to be "symlink"', () => {
        /* ARRANGE */
        const expected = 'symlink';

        /* ACT */
        const result = new FixtureAsync('symlink', 'target');

        /* ASSERT */
        expect(result.type).toBe(expected);
      });
    });

    describe('invalid fixture types', () => {
      it('should throw an error in case of an invalid fixture type', () => {
        // @ts-expect-error - Testing
        expect(() => new FixtureAsync('asdf')).toThrow(
          "Invalid fixture type: 'asdf'",
        );

        // @ts-expect-error - Testing
        expect(() => new FixtureAsync('dir', 'string')).toThrow(
          "A 'dir' fixture must have an Object as content",
        );

        // @ts-expect-error - Testing
        expect(() => new FixtureAsync('file', {})).toThrow(
          "A 'file' fixture must have a String, or Buffer as content",
        );

        // @ts-expect-error - Testing
        expect(() => new FixtureAsync('symlink', {})).toThrow(
          "A 'symlink' fixture must have a target of type String",
        );

        // @ts-expect-error - Testing
        expect(() => new FixtureAsync('link', {})).toThrow(
          "A 'link' fixture must have a target of type String",
        );

        // @ts-expect-error - Testing
        expect(() => new FixtureAsync('dir', { a: 1 })).toThrow(
          'Invalid fixture content:\n\t[START]->1<-[END]',
        );

        const d = { a: { d: {} } };
        d.a.d = d;

        expect(() => new FixtureAsync('dir', d)).toThrow(
          'Cycle detected in fixture contents at [START]->d<-[END]',
        );

        d.a.d = 1;

        expect(() => new FixtureAsync('dir', d)).toThrow(
          'Invalid fixture content:\n\t[START]->1<-[END]',
        );

        const c = {
          f: 'content',
          d: {
            a: new FixtureAsync('symlink', 'x'),
            b: new FixtureAsync('link', 'x'),
          },
        };

        expect(new FixtureAsync('dir', c).content).toBe(c);
      });
    });
  });

  describe('make()', () => {
    describe('path traversal prevention', () => {
      it("should not allow to create a directory outside the current working directory of the Node.js process or the user's temp folder", async () => {
        /* ARRANGE */
        const rootPath = path.join(TEMP, uniqueString(), '..');
        const newDir = new FixtureAsync('dir', {
          'file.txt': new FixtureAsync('file', 'ehm'),
        });

        /* ACT */
        /* ASSERT */
        await expect(() => FixtureAsync.make(rootPath, newDir)).rejects.toThrow(
          /Illegal path/,
        );
      });

      it('should not allow to create a link to point to something outside the created temp folder', async () => {
        /* ARRANGE */
        expect.assertions(2);

        const targetFileName = 'do-not-point-at-me-async.txt';
        const targetPath = path.join(TEMP, targetFileName);
        writeFileSync(targetPath, 'Do not point at me', 'utf8');
        expect(lstatSync(targetPath).isFile()).toBe(true);

        const rootPath = path.join(TEMP, uniqueString());

        /* ACT */
        const dir = new FixtureAsync('dir', {
          link: new FixtureAsync('link', path.join('..', targetFileName)),
        });

        /* ASSERT */
        await expect(() => FixtureAsync.make(rootPath, dir)).rejects.toThrow(
          /Illegal path/,
        );

        /* cleanup */
        if (existsSync(targetPath)) {
          unlinkSync(targetPath);
        }

        if (existsSync(rootPath)) {
          rimrafSync(rootPath);
        }
      });

      it('should not allow to create a symlink to target to something outside the created temp folder', async () => {
        /* ARRANGE */
        expect.assertions(3);

        const targetDir = uniqueString();
        const targetPath = path.join(TEMP, targetDir);
        const fixtureDir = new FixtureAsync('dir', {
          'do-not-point-at-me-async.txt': new FixtureAsync(
            'file',
            'Do not point at me',
          ),
        });

        await FixtureAsync.make(targetPath, fixtureDir);

        const rootPath = path.join(TEMP, uniqueString());

        /* ACT */
        const dir = new FixtureAsync('dir', {
          sym: new FixtureAsync(
            'symlink',
            path.resolve(rootPath, '..', targetDir),
          ),
        });

        /* ASSERT */
        await expect(
          fsPromises.lstat(targetPath).then((result) => result.isDirectory()),
        ).resolves.toBe(true);
        await expect(
          fsPromises
            .lstat(path.join(targetPath, 'do-not-point-at-me-async.txt'))
            .then((result) => result.isFile()),
        ).resolves.toBe(true);

        await expect(() => FixtureAsync.make(rootPath, dir)).rejects.toThrow(
          /Illegal path/,
        );

        /* cleanup */
        await rimraf(targetPath);
        await rimraf(rootPath);
      });
    });

    describe('Creating a directory structure (The long way)', () => {
      it('should create the given directory structure', async () => {
        /* ARRANGE */
        expect.assertions(7);
        const rootPath = path.resolve(TEMP, uniqueString());

        /* ACT */
        const dir = new FixtureAsync('dir', {
          file: new FixtureAsync('file', 'hello'),
          subdir: new FixtureAsync('dir', {
            subf: new FixtureAsync('file', 'subs'),
          }),
          link: new FixtureAsync('link', 'file'),
          sym: new FixtureAsync('symlink', 'subdir'),
        });

        await FixtureAsync.make(rootPath, dir);

        /* ASSERT */
        await expect(
          fsPromises.lstat(rootPath).then((result) => result.isDirectory()),
        ).resolves.toBe(true);
        await expect(
          fsPromises
            .lstat(path.join(rootPath, 'file'))
            .then((result) => result.isFile()),
        ).resolves.toBe(true);
        await expect(
          fsPromises
            .lstat(path.join(rootPath, 'subdir'))
            .then((result) => result.isDirectory()),
        ).resolves.toBe(true);
        await expect(
          fsPromises
            .lstat(path.join(rootPath, 'subdir', 'subf'))
            .then((result) => result.isFile()),
        ).resolves.toBe(true);
        await expect(
          fsPromises
            .lstat(path.join(rootPath, 'link'))
            .then((result) => result.isFile()),
        ).resolves.toBe(true);
        await expect(
          fsPromises
            .lstat(path.join(rootPath, 'sym'))
            .then((result) => result.isSymbolicLink()),
        ).resolves.toBe(true);
        await expect(
          fsPromises
            .stat(path.join(rootPath, 'sym'))
            .then((result) => result.isDirectory()),
        ).resolves.toBe(true);

        /* cleanup */
        await rimraf(rootPath);
      });

      it('should throw an error for a symLink with a non existing target', async () => {
        /* ARRANGE */
        const rootPath = path.resolve(TEMP, uniqueString());

        /* ACT */
        const dir = new FixtureAsync('dir', {
          missing: new FixtureAsync('symlink', 'missing'),
        });

        /* ASSERT */
        await expect(() => FixtureAsync.make(rootPath, dir)).rejects.toThrow();

        /* cleanup */
        await rimraf(rootPath);
      });
    });

    describe('Creating a directory structure (The shorter way)', () => {
      it('should create the given directory structure', async () => {
        /* ARRANGE */
        expect.assertions(7);
        const rootPath = path.resolve(TEMP, uniqueString());

        /* ACT */
        const dir = new FixtureAsync('dir', {
          file: 'hello',
          subdir: { subf: 'subs' },
          link: new FixtureAsync('link', 'file'),
          sym: new FixtureAsync('symlink', 'subdir'),
        });

        await FixtureAsync.make(rootPath, dir);

        /* ASSERT */
        await expect(
          fsPromises.lstat(rootPath).then((result) => result.isDirectory()),
        ).resolves.toBe(true);
        await expect(
          fsPromises
            .lstat(path.join(rootPath, 'file'))
            .then((result) => result.isFile()),
        ).resolves.toBe(true);
        await expect(
          fsPromises
            .lstat(path.join(rootPath, 'subdir'))
            .then((result) => result.isDirectory()),
        ).resolves.toBe(true);
        await expect(
          fsPromises
            .lstat(path.join(rootPath, 'subdir', 'subf'))
            .then((result) => result.isFile()),
        ).resolves.toBe(true);
        await expect(
          fsPromises
            .lstat(path.join(rootPath, 'link'))
            .then((result) => result.isFile()),
        ).resolves.toBe(true);
        await expect(
          fsPromises
            .lstat(path.join(rootPath, 'sym'))
            .then((result) => result.isSymbolicLink()),
        ).resolves.toBe(true);
        await expect(
          fsPromises
            .stat(path.join(rootPath, 'sym'))
            .then((result) => result.isDirectory()),
        ).resolves.toBe(true);

        /* cleanup */
        await rimraf(rootPath);
      });
    });
  });
});
