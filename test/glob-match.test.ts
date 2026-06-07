import { expect, test } from 'bun:test';
import GlobMatch from '~/composable/glob-match';
import { needIncludeFromGlobRules } from '~/utils/glob-match';

const options = { caseSensitive: false };

const makeRules = (patterns: Array<string>) =>
	patterns.map((pattern) => new GlobMatch(pattern, options));

test('needIncludeFromGlobRules includes every file when no rules are defined', () => {
	expect(needIncludeFromGlobRules('some/file.txt', [], [])).toBe(true);
	expect(needIncludeFromGlobRules('some/../file.txt', [], [])).toBe(true);
	expect(needIncludeFromGlobRules('./some/file.txt', [], [])).toBe(true);
	expect(needIncludeFromGlobRules('some//file.txt', [], [])).toBe(true);
	expect(needIncludeFromGlobRules('/some/file.txt', [], [])).toBe(true);
	expect(needIncludeFromGlobRules('some/folder/..', [], [])).toBe(true);
	expect(needIncludeFromGlobRules('some/folder/../', [], [])).toBe(true);
	expect(needIncludeFromGlobRules('some/././file.txt', [], [])).toBe(true);
});

test('needIncludeFromGlobRules includes files matched by include rules', () => {
	const inclusion = makeRules(['*.txt']);
	const exclusion: Array<GlobMatch> = [];

	expect(needIncludeFromGlobRules('document.txt', inclusion, exclusion)).toBe(true);
});

test('needIncludeFromGlobRules excludes files matched by exclude rules', () => {
	const inclusion: Array<GlobMatch> = [];
	const exclusion = makeRules(['*.log']);

	expect(needIncludeFromGlobRules('debug.log', inclusion, exclusion)).toBe(false);
});

test('needIncludeFromGlobRules prefers include rules over exclude rules', () => {
	const inclusion = makeRules(['important.log']);
	const exclusion = makeRules(['*.log']);

	expect(needIncludeFromGlobRules('important.log', inclusion, exclusion)).toBe(true);
});

test('Standard wildcards: * matches zero or more characters within a path segment', () => {
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

test('Standard wildcards: ? matches any single character', () => {
	const exclusion = makeRules(['debug?.log']);

	expect(needIncludeFromGlobRules('debug1.log', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('debugA.log', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('debug12.log', [], exclusion)).toBe(true);
	expect(needIncludeFromGlobRules('debug.log', [], exclusion)).toBe(true);
	expect(needIncludeFromGlobRules('debug/.log', [], exclusion)).toBe(true);
	expect(needIncludeFromGlobRules('debugä.log', [], exclusion)).toBe(false);
});

test('Standard wildcards: [] matches a character set or range', () => {
	const exclusion = makeRules(['backup[0-9].sql']);

	expect(needIncludeFromGlobRules('backup0.sql', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('backup9.sql', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('backupA.sql', [], exclusion)).toBe(true);
	expect(needIncludeFromGlobRules('backup10.sql', [], exclusion)).toBe(true);
	expect(needIncludeFromGlobRules('backup-.sql', [], exclusion)).toBe(true);
	expect(needIncludeFromGlobRules('backup5.SQL', [], exclusion)).toBe(false);
});

test('Path separator rules: patterns without / match recursively in any directory', () => {
	const exclusion = makeRules(['*.log', 'temp']);

	expect(needIncludeFromGlobRules('app.log', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('logs/app.log', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('logs/app.log/', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('temp', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('src/temp', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('src/temp/file.txt', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('src/temp/../temp/file.txt', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('src/./temp/file.txt', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('TEMP', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('temporary/file.txt', [], exclusion)).toBe(true);
});

test('Path separator rules: patterns starting with / match only the root directory', () => {
	const exclusion = makeRules(['/TODO']);

	expect(needIncludeFromGlobRules('TODO', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('src/TODO', [], exclusion)).toBe(true);
	expect(needIncludeFromGlobRules('TODO/readme.md', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('todo', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('src/../TODO', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('/TODO', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('nested/TODO', [], exclusion)).toBe(true);
});

test('Path separator rules: patterns ending with / match directories and their contents', () => {
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

test('Path separator rules: ignored parent directories stay ignored', () => {
	const exclusion = makeRules(['build/']);

	expect(needIncludeFromGlobRules('build/', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('build/app.js', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('build/sub/app.js', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('build/sub/', [], exclusion)).toBe(false);
});

test('Path separator rules: a child include does not unignore an ignored parent directory', () => {
	const inclusion = makeRules(['build/keep.txt']);
	const exclusion = makeRules(['build/']);

	expect(needIncludeFromGlobRules('build/keep.txt', inclusion, exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('build/keep/more.txt', inclusion, exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('build/keep.txt/extra', inclusion, exclusion)).toBe(false);
});

test('Path separator rules: a plain include path does not recurse into children', () => {
	const inclusion = makeRules(['aaa/bb']);
	const exclusion = makeRules(['aaa/bb/cc']);

	expect(needIncludeFromGlobRules('aaa/bb', inclusion, exclusion)).toBe(true);
	expect(needIncludeFromGlobRules('aaa/bb/file.md', inclusion, exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('aaa/bb/cc', inclusion, exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('aaa/bb/cc/child.md', inclusion, exclusion)).toBe(false);
});

test('Path separator rules: a include path with /** recurses and still wins over exclude rules', () => {
	const inclusion = makeRules(['aaa/bb/**']);
	const exclusion = makeRules(['aaa/bb/cc/**']);

	expect(needIncludeFromGlobRules('aaa/bb/file.md', inclusion, exclusion)).toBe(true);
	expect(needIncludeFromGlobRules('aaa/bb/deep/note.md', inclusion, exclusion)).toBe(true);
	expect(needIncludeFromGlobRules('aaa/bb/cc/file.md', inclusion, exclusion)).toBe(true);
});

test('Path separator rules: patterns containing / match relative paths', () => {
	const exclusion = makeRules(['doc/*.txt']);

	expect(needIncludeFromGlobRules('doc/a.txt', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('doc/server/arch.txt', [], exclusion)).toBe(true);
	expect(needIncludeFromGlobRules('docs/a.txt', [], exclusion)).toBe(true);
	expect(needIncludeFromGlobRules('doc/a.txt/', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('doc/a.tx', [], exclusion)).toBe(true);
});

test('Double-star matching: **/pattern matches file names at any depth', () => {
	const exclusion = makeRules(['**/__pycache__']);

	expect(needIncludeFromGlobRules('__pycache__', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('src/__pycache__', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('src/utils/__pycache__', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('src/utils/__pycache__/', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('src/utils/__pycache__x', [], exclusion)).toBe(true);
	expect(needIncludeFromGlobRules('src/__pycache__/file.py', [], exclusion)).toBe(false);
});

test('Double-star matching: pattern/** matches everything under that directory', () => {
	const exclusion = makeRules(['assets/**']);

	expect(needIncludeFromGlobRules('assets/logo.png', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('assets/icons/icon.svg', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('assets', [], exclusion)).toBe(true);
	expect(needIncludeFromGlobRules('src/assets/logo.png', [], exclusion)).toBe(true);
	expect(needIncludeFromGlobRules('assets/.keep', [], exclusion)).toBe(false);
});

test('Double-star matching: pattern/**/pattern matches across directory levels', () => {
	const exclusion = makeRules(['foo/**/bar']);

	expect(needIncludeFromGlobRules('foo/bar', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('foo/x/bar', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('foo/x/y/bar', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('x/foo/bar', [], exclusion)).toBe(true);
	expect(needIncludeFromGlobRules('foo/bar/baz', [], exclusion)).toBe(false);
	expect(needIncludeFromGlobRules('foo/.hidden/bar', [], exclusion)).toBe(false);
});

const combinedExclusion = makeRules([
	'*.a',
	'bin/',
	'/vendor/',
	'logs/*.txt',
	'core/**/*.out',
	'test[0-9].js',
]);

test('Combined rules: *.a matches .a files in any directory', () => {
	expect(needIncludeFromGlobRules('lib.a', [], combinedExclusion)).toBe(false);
	expect(needIncludeFromGlobRules('src/lib.a', [], combinedExclusion)).toBe(false);
	expect(needIncludeFromGlobRules('src/lib.so', [], combinedExclusion)).toBe(true);
	expect(needIncludeFromGlobRules('src/lib.a/', [], combinedExclusion)).toBe(false);
	expect(needIncludeFromGlobRules('src/lib.a.bak', [], combinedExclusion)).toBe(true);
});

test('Combined rules: bin/ ignores bin directories at any depth', () => {
	expect(needIncludeFromGlobRules('bin/tool', [], combinedExclusion)).toBe(false);
	expect(needIncludeFromGlobRules('src/bin/tool', [], combinedExclusion)).toBe(false);
	expect(needIncludeFromGlobRules('binfile', [], combinedExclusion)).toBe(true);
	expect(needIncludeFromGlobRules('src/binfile/tool', [], combinedExclusion)).toBe(true);
	expect(needIncludeFromGlobRules('bin/../bin/tool', [], combinedExclusion)).toBe(false);
});

test('Combined rules: /vendor/ ignores only the root vendor directory', () => {
	expect(needIncludeFromGlobRules('vendor/lib.js', [], combinedExclusion)).toBe(false);
	expect(needIncludeFromGlobRules('src/vendor/lib.js', [], combinedExclusion)).toBe(true);
	expect(needIncludeFromGlobRules('vendor', [], combinedExclusion)).toBe(true);
	expect(needIncludeFromGlobRules('vendor/', [], combinedExclusion)).toBe(false);
	expect(needIncludeFromGlobRules('src/../vendor/lib.js', [], combinedExclusion)).toBe(false);
});

test('Combined rules: logs/*.txt matches only one level under logs', () => {
	expect(needIncludeFromGlobRules('logs/app.txt', [], combinedExclusion)).toBe(false);
	expect(needIncludeFromGlobRules('logs/history/2023.txt', [], combinedExclusion)).toBe(true);
	expect(needIncludeFromGlobRules('logs/app.txt/', [], combinedExclusion)).toBe(false);
	expect(needIncludeFromGlobRules('logs/app.tx', [], combinedExclusion)).toBe(true);
});

test('Combined rules: core/**/*.out matches .out files at any depth under core', () => {
	expect(needIncludeFromGlobRules('core/main.out', [], combinedExclusion)).toBe(false);
	expect(needIncludeFromGlobRules('core/a/b/c/test.out', [], combinedExclusion)).toBe(false);
	expect(needIncludeFromGlobRules('src/core/test.out', [], combinedExclusion)).toBe(true);
	expect(needIncludeFromGlobRules('core/test.out/', [], combinedExclusion)).toBe(false);
	expect(needIncludeFromGlobRules('core/test.output', [], combinedExclusion)).toBe(true);
});

test('Combined rules: test[0-9].js matches test0.js through test9.js', () => {
	expect(needIncludeFromGlobRules('test0.js', [], combinedExclusion)).toBe(false);
	expect(needIncludeFromGlobRules('test9.js', [], combinedExclusion)).toBe(false);
	expect(needIncludeFromGlobRules('test10.js', [], combinedExclusion)).toBe(true);
	expect(needIncludeFromGlobRules('testA.js', [], combinedExclusion)).toBe(true);
	expect(needIncludeFromGlobRules('test0.js/', [], combinedExclusion)).toBe(false);
	expect(needIncludeFromGlobRules('test5.js.map', [], combinedExclusion)).toBe(true);
});
