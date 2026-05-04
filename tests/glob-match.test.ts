import { describe, expect, it } from 'vitest';
import GlobMatch from '~/composable/glob-match';
import { needIncludeFromGlobRules } from '~/utils/glob-match';

const options = { caseSensitive: false };

const makeRules = (patterns: Array<string>) =>
	patterns.map((pattern) => new GlobMatch(pattern, options));

describe('needIncludeFromGlobRules', () => {
	it('includes every file when no rules are defined', () => {
		expect(needIncludeFromGlobRules('some/file.txt', [], [])).toBe(true);
		expect(needIncludeFromGlobRules('some/../file.txt', [], [])).toBe(true);
		expect(needIncludeFromGlobRules('./some/file.txt', [], [])).toBe(true);
		expect(needIncludeFromGlobRules('some//file.txt', [], [])).toBe(true);
		expect(needIncludeFromGlobRules('/some/file.txt', [], [])).toBe(true);
		expect(needIncludeFromGlobRules('some/folder/..', [], [])).toBe(true);
		expect(needIncludeFromGlobRules('some/folder/../', [], [])).toBe(true);
		expect(needIncludeFromGlobRules('some/././file.txt', [], [])).toBe(true);
	});

	it('includes files matched by include rules', () => {
		const inclusion = makeRules(['*.txt']);
		const exclusion: Array<GlobMatch> = [];

		expect(needIncludeFromGlobRules('document.txt', inclusion, exclusion)).toBe(true);
	});

	it('excludes files matched by exclude rules', () => {
		const inclusion: Array<GlobMatch> = [];
		const exclusion = makeRules(['*.log']);

		expect(needIncludeFromGlobRules('debug.log', inclusion, exclusion)).toBe(false);
	});

	it('prefers include rules over exclude rules', () => {
		const inclusion = makeRules(['important.log']);
		const exclusion = makeRules(['*.log']);

		expect(needIncludeFromGlobRules('important.log', inclusion, exclusion)).toBe(true);
	});

	describe('standard wildcards', () => {
		it('* matches zero or more characters within a path segment', () => {
			const exclusion = makeRules(['*.txt']);

			expect(needIncludeFromGlobRules('readme.txt', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('readme.txt/', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('notes/readme.txt', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('notes/archive/readme.txt', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('notes/readme.txt.bak', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('readme.md', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('readme', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('dir.with.dot/readme.txt', [], exclusion)).toBe(false);
		});

		it('? matches any single character', () => {
			const exclusion = makeRules(['debug?.log']);

			expect(needIncludeFromGlobRules('debug1.log', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('debugA.log', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('debug12.log', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('debug.log', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('debug/.log', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('debugä.log', [], exclusion)).toBe(false);
		});

		it('[] matches a character set or range', () => {
			const exclusion = makeRules(['backup[0-9].sql']);

			expect(needIncludeFromGlobRules('backup0.sql', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('backup9.sql', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('backupA.sql', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('backup10.sql', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('backup-.sql', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('backup5.SQL', [], exclusion)).toBe(false);
		});
	});

	describe('path separator rules', () => {
		it('patterns without / match recursively in any directory', () => {
			const exclusion = makeRules(['*.log', 'temp']);

			expect(needIncludeFromGlobRules('app.log', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('logs/app.log', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('logs/app.log/', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('temp', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('src/temp', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('src/temp/file.txt', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('src/temp/../temp/file.txt', [], exclusion)).toBe(
				false,
			);
			expect(needIncludeFromGlobRules('src/./temp/file.txt', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('TEMP', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('temporary/file.txt', [], exclusion)).toBe(true);
		});

		it('patterns starting with / match only the root directory', () => {
			const exclusion = makeRules(['/TODO']);

			expect(needIncludeFromGlobRules('TODO', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('src/TODO', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('TODO/readme.md', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('todo', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('src/../TODO', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('/TODO', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('nested/TODO', [], exclusion)).toBe(true);
		});

		it('patterns ending with / match directories and their contents', () => {
			const exclusion = makeRules(['build/']);

			expect(needIncludeFromGlobRules('build/', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('build/app.js', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('src/build/', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('src/build/app.js', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('build', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('buildfile/', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('build/../build/app.js', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('./build/app.js', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('build/.hidden', [], exclusion)).toBe(false);
		});

		it('ignored parent directories stay ignored', () => {
			const exclusion = makeRules(['build/']);

			expect(needIncludeFromGlobRules('build/', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('build/app.js', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('build/sub/app.js', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('build/sub/', [], exclusion)).toBe(false);
		});

		it('a child include does not unignore an ignored parent directory', () => {
			const inclusion = makeRules(['build/keep.txt']);
			const exclusion = makeRules(['build/']);

			expect(needIncludeFromGlobRules('build/keep.txt', inclusion, exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('build/keep/more.txt', inclusion, exclusion)).toBe(
				false,
			);
			expect(needIncludeFromGlobRules('build/keep.txt/extra', inclusion, exclusion)).toBe(
				false,
			);
		});

		it('a plain include path does not recurse into children', () => {
			const inclusion = makeRules(['aaa/bb']);
			const exclusion = makeRules(['aaa/bb/cc']);

			expect(needIncludeFromGlobRules('aaa/bb', inclusion, exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('aaa/bb/file.md', inclusion, exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('aaa/bb/cc', inclusion, exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('aaa/bb/cc/child.md', inclusion, exclusion)).toBe(
				false,
			);
		});

		it('a include path with /** recurses and still wins over exclude rules', () => {
			const inclusion = makeRules(['aaa/bb/**']);
			const exclusion = makeRules(['aaa/bb/cc/**']);

			expect(needIncludeFromGlobRules('aaa/bb/file.md', inclusion, exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('aaa/bb/deep/note.md', inclusion, exclusion)).toBe(
				true,
			);
			expect(needIncludeFromGlobRules('aaa/bb/cc/file.md', inclusion, exclusion)).toBe(true);
		});

		it('patterns containing / match relative paths', () => {
			const exclusion = makeRules(['doc/*.txt']);

			expect(needIncludeFromGlobRules('doc/a.txt', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('doc/server/arch.txt', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('docs/a.txt', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('doc/a.txt/', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('doc/a.tx', [], exclusion)).toBe(true);
		});
	});

	describe('double-star ** matching', () => {
		it('**/pattern matches file names at any depth', () => {
			const exclusion = makeRules(['**/__pycache__']);

			expect(needIncludeFromGlobRules('__pycache__', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('src/__pycache__', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('src/utils/__pycache__', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('src/utils/__pycache__/', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('src/utils/__pycache__x', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('src/__pycache__/file.py', [], exclusion)).toBe(false);
		});

		it('pattern/** matches everything under that directory', () => {
			const exclusion = makeRules(['assets/**']);

			expect(needIncludeFromGlobRules('assets/logo.png', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('assets/icons/icon.svg', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('assets', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('src/assets/logo.png', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('assets/.keep', [], exclusion)).toBe(false);
		});

		it('pattern/**/pattern matches across directory levels', () => {
			const exclusion = makeRules(['foo/**/bar']);

			expect(needIncludeFromGlobRules('foo/bar', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('foo/x/bar', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('foo/x/y/bar', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('x/foo/bar', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('foo/bar/baz', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('foo/.hidden/bar', [], exclusion)).toBe(false);
		});
	});

	describe('combined rule examples', () => {
		const exclusion = makeRules([
			'*.a',
			'bin/',
			'/vendor/',
			'logs/*.txt',
			'core/**/*.out',
			'test[0-9].js',
		]);

		it('*.a matches .a files in any directory', () => {
			expect(needIncludeFromGlobRules('lib.a', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('src/lib.a', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('src/lib.so', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('src/lib.a/', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('src/lib.a.bak', [], exclusion)).toBe(true);
		});

		it('bin/ ignores bin directories at any depth', () => {
			expect(needIncludeFromGlobRules('bin/tool', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('src/bin/tool', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('binfile', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('src/binfile/tool', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('bin/../bin/tool', [], exclusion)).toBe(false);
		});

		it('/vendor/ ignores only the root vendor directory', () => {
			expect(needIncludeFromGlobRules('vendor/lib.js', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('src/vendor/lib.js', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('vendor', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('vendor/', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('src/../vendor/lib.js', [], exclusion)).toBe(false);
		});

		it('logs/*.txt matches only one level under logs', () => {
			expect(needIncludeFromGlobRules('logs/app.txt', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('logs/history/2023.txt', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('logs/app.txt/', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('logs/app.tx', [], exclusion)).toBe(true);
		});

		it('core/**/*.out matches .out files at any depth under core', () => {
			expect(needIncludeFromGlobRules('core/main.out', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('core/a/b/c/test.out', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('src/core/test.out', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('core/test.out/', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('core/test.output', [], exclusion)).toBe(true);
		});

		it('test[0-9].js matches test0.js through test9.js', () => {
			expect(needIncludeFromGlobRules('test0.js', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('test9.js', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('test10.js', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('testA.js', [], exclusion)).toBe(true);
			expect(needIncludeFromGlobRules('test0.js/', [], exclusion)).toBe(false);
			expect(needIncludeFromGlobRules('test5.js.map', [], exclusion)).toBe(true);
		});
	});
});
