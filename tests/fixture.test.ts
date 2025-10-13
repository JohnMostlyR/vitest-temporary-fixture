/**
 * @copyright Johan Meester <JohnMostlyR@gmail.com>
 * @license MIT
 */

import {
  existsSync,
  lstatSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { rimrafSync } from 'rimraf';
import uniqueString from 'unique-string';
import { describe, expect, it } from 'vitest';

import { Fixture } from '../src/fixture.js';

const TEMP = tmpdir();

describe('Fixture', () => {
  describe('fixture type validation', () => {
    describe('valid fixture types', () => {
      it('should correctly determine the type to be "file"', () => {
        /* ARRANGE */
        const expected = 'file';

        /* ACT */
        let result = new Fixture('file', 'hello');

        /* ASSERT */
        expect(result.type).toBe(expected);

        /* ACT */
        result = new Fixture('file', Buffer.from('hello'));

        /* ASSERT */
        expect(result.type).toBe(expected);

        /* ACT */
        result = new Fixture('file', new Uint8Array(Buffer.from('hello')));

        /* ASSERT */
        expect(result.type).toBe(expected);
      });

      it('should correctly determine the type to be "directory"', () => {
        /* ARRANGE */
        const expected = '[object Fixture<dir>]';

        /* ACT */
        const result = Object.prototype.toString.call(new Fixture('dir', {}));

        /* ASSERT */
        expect(result).toBe(expected);
      });

      it('should correctly determine the type to be "link"', () => {
        /* ARRANGE */
        const expected = 'link';

        /* ACT */
        const result = new Fixture('link', 'target');

        /* ASSERT */
        expect(result.type).toBe(expected);
      });

      it('should correctly determine the type to be "symlink"', () => {
        /* ARRANGE */
        const expected = 'symlink';

        /* ACT */
        const result = new Fixture('symlink', 'target');

        /* ASSERT */
        expect(result.type).toBe(expected);
      });
    });

    describe('invalid fixture types', () => {
      it('should throw an error in case of an invalid fixture type', () => {
        // @ts-expect-error - Testing
        expect(() => new Fixture('asdf')).toThrow(
          "Invalid fixture type: 'asdf'",
        );

        // @ts-expect-error - Testing
        expect(() => new Fixture('dir', 'string')).toThrow(
          "A 'dir' fixture must have an Object as content",
        );

        // @ts-expect-error - Testing
        expect(() => new Fixture('file', {})).toThrow(
          "A 'file' fixture must have a String, or Buffer as content",
        );

        // @ts-expect-error - Testing
        expect(() => new Fixture('symlink', {})).toThrow(
          "A 'symlink' fixture must have a target of type String",
        );

        // @ts-expect-error - Testing
        expect(() => new Fixture('link', {})).toThrow(
          "A 'link' fixture must have a target of type String",
        );

        // @ts-expect-error - Testing
        expect(() => new Fixture('dir', { a: 1 })).toThrow(
          'Invalid fixture content:\n\t[START]->1<-[END]',
        );

        const d = { a: { d: {} } };
        d.a.d = d;

        expect(() => new Fixture('dir', d)).toThrow(
          'Cycle detected in fixture contents at [START]->d<-[END]',
        );

        d.a.d = 1;

        expect(() => new Fixture('dir', d)).toThrow(
          'Invalid fixture content:\n\t[START]->1<-[END]',
        );

        const c = {
          f: 'content',
          d: {
            a: new Fixture('symlink', 'x'),
            b: new Fixture('link', 'x'),
          },
        };

        expect(new Fixture('dir', c).content).toBe(c);
      });
    });
  });

  describe('make()', () => {
    describe('path traversal prevention', () => {
      it("should not allow to create a directory outside the current working directory of the Node.js process or the user's temp folder", () => {
        /* ARRANGE */
        const rootPath = join(TEMP, uniqueString(), '..');
        const newDir = new Fixture('dir', {
          'file.txt': new Fixture('file', 'ehm'),
        });

        /* ACT */
        /* ASSERT */
        expect(() => Fixture.make(rootPath, newDir)).toThrow(/Illegal path/);
      });

      it('should not allow to create a link to point to something outside the created temp folder', () => {
        /* ARRANGE */
        const targetFileName = 'do-not-point-at-me.txt';
        const targetPath = join(TEMP, targetFileName);
        writeFileSync(targetPath, 'Do not point at me', 'utf8');
        expect(lstatSync(targetPath).isFile()).toBe(true);

        const rootPath = join(TEMP, uniqueString());

        /* ACT */
        const dir = new Fixture('dir', {
          link: new Fixture('link', join('..', targetFileName)),
        });

        /* ASSERT */
        expect(() => Fixture.make(rootPath, dir)).toThrow(/Illegal path/);

        /* cleanup */
        if (existsSync(targetPath)) {
          unlinkSync(targetPath);
        }

        if (existsSync(rootPath)) {
          rimrafSync(rootPath);
        }
      });

      it('should not allow to create a symlink to target to something outside the created temp folder', () => {
        /* ARRANGE */

        const targetFileName = 'do-not-point-at-me.txt';
        const targetPath = join(TEMP, targetFileName);

        writeFileSync(targetPath, 'Do not point at me', 'utf8');

        const rootPath = join(TEMP, uniqueString());

        /* ACT */
        const dir = new Fixture('dir', {
          link: new Fixture('link', join('..', targetFileName)),
        });

        /* ASSERT */
        expect(lstatSync(targetPath).isFile()).toBe(true);
        expect(() => Fixture.make(rootPath, dir)).toThrow(/Illegal path/);

        /* cleanup */
        if (existsSync(targetPath)) {
          unlinkSync(targetPath);
        }

        if (existsSync(rootPath)) {
          rimrafSync(rootPath);
        }
      });
    });

    describe('Creating a directory structure (The long way)', () => {
      it('should create the given directory structure', () => {
        /* ARRANGE */
        const rootPath = resolve(TEMP, uniqueString());

        /* ACT */
        const dir = new Fixture('dir', {
          file: new Fixture('file', 'hello'),
          subdir: new Fixture('dir', {
            subf: new Fixture('file', 'subs'),
          }),
          link: new Fixture('link', 'file'),
          sym: new Fixture('symlink', 'subdir'),
        });

        Fixture.make(rootPath, dir);

        /* ASSERT */
        expect(lstatSync(rootPath).isDirectory()).toBe(true);
        expect(lstatSync(join(rootPath, 'file')).isFile()).toBe(true);
        expect(lstatSync(join(rootPath, 'subdir')).isDirectory()).toBe(true);
        expect(lstatSync(join(rootPath, 'subdir', 'subf')).isFile()).toBe(true);
        expect(lstatSync(join(rootPath, 'link')).isFile()).toBe(true);
        expect(lstatSync(join(rootPath, 'sym')).isSymbolicLink()).toBe(true);
        expect(statSync(join(rootPath, 'sym')).isDirectory()).toBe(true);

        /* cleanup */
        if (existsSync(rootPath)) {
          rimrafSync(rootPath);
        }
      });

      it('should throw an error for a symLink with a non existing target', () => {
        /* ARRANGE */
        const rootPath = resolve(TEMP, uniqueString());

        /* ACT */
        const dir = new Fixture('dir', {
          missing: new Fixture('symlink', 'missing'),
        });

        /* ASSERT */
        expect(() => Fixture.make(rootPath, dir)).toThrow();

        /* cleanup */
        if (existsSync(rootPath)) {
          rimrafSync(rootPath);
        }
      });
    });

    describe('Creating a directory structure (The shorter way)', () => {
      it('should create the given directory structure', () => {
        /* ARRANGE */
        const rootPath = resolve(TEMP, uniqueString());

        /* ACT */
        const dir = new Fixture('dir', {
          file: 'hello',
          subdir: { subf: 'subs' },
          link: new Fixture('link', 'file'),
          sym: new Fixture('symlink', 'subdir'),
        });

        Fixture.make(rootPath, dir);

        /* ASSERT */
        expect(lstatSync(rootPath).isDirectory()).toBe(true);
        expect(lstatSync(join(rootPath, 'file')).isFile()).toBe(true);
        expect(lstatSync(join(rootPath, 'subdir')).isDirectory()).toBe(true);
        expect(lstatSync(join(rootPath, 'subdir', 'subf')).isFile()).toBe(true);
        expect(lstatSync(join(rootPath, 'link')).isFile()).toBe(true);
        expect(lstatSync(join(rootPath, 'sym')).isSymbolicLink()).toBe(true);
        expect(statSync(join(rootPath, 'sym')).isDirectory()).toBe(true);

        /* cleanup */
        if (existsSync(rootPath)) {
          rimrafSync(rootPath);
        }
      });
    });
  });
});
