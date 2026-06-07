import { expect, mock, test } from 'bun:test';

const settings = {
	encryption: { enabled: false },
	exhaustiveRemoteTraversal: false,
	filterRules: { exclusionRules: [], inclusionRules: [] },
	remoteDir: '/test/',
	serverUrl: 'https://dav.example.com/dav',
	skipLargeFiles: { enabled: false, value: 0 },
};

const getDirectoryContentsMock = mock(() =>
	Promise.resolve([] as Array<{ isDir: boolean; path: string }>),
);
const useSettingsMock = mock(() => settings);
const loggerMock = {
	debug: mock(() => undefined),
	error: mock(() => undefined),
	warn: mock(() => undefined),
};

void mock.module('~/fs/webdav/api', () => ({
	getDirectoryContents: getDirectoryContentsMock,
	getStat: mock(() => Promise.resolve({} as never)),
}));

void mock.module('~/composable/api-limiter', () => ({
	default: {
		wrap<T>(fn: T) {
			return fn;
		},
	},
}));
void mock.module('~/utils/logger', () => ({
	default: loggerMock,
}));
void mock.module('~/settings', () => ({
	usePlugin: mock(() => Promise.resolve({} as never)),
	useSettings: useSettingsMock,
}));

const { traverseWebDAV } = await import('~/fs/webdav');

test('uses remote-base-aware path when traversing child directories', async () => {
	getDirectoryContentsMock.mockReset();
	useSettingsMock.mockReset();
	getDirectoryContentsMock.mockResolvedValueOnce([{ isDir: true, path: '/test/webdav-sync/' }]);
	getDirectoryContentsMock.mockResolvedValueOnce([]);
	useSettingsMock.mockReturnValue(settings);

	await traverseWebDAV({ token: 'token' });

	expect(getDirectoryContentsMock).toHaveBeenNthCalledWith(
		1,
		'https://dav.example.com/dav',
		'token',
		'/test/',
		false,
	);
	expect(getDirectoryContentsMock).toHaveBeenNthCalledWith(
		2,
		'https://dav.example.com/dav',
		'token',
		'/test/webdav-sync/',
		false,
	);
});

test('skips missing directories during traversal', async () => {
	getDirectoryContentsMock.mockReset();
	useSettingsMock.mockReset();
	getDirectoryContentsMock.mockResolvedValueOnce([{ isDir: true, path: '/test/missing/' }]);
	getDirectoryContentsMock.mockRejectedValueOnce({
		message: '404: Not Found',
		res: { status: 404 },
	});
	useSettingsMock.mockReturnValue(settings);

	await traverseWebDAV({ token: 'token' });

	expect(getDirectoryContentsMock).toHaveBeenNthCalledWith(
		2,
		'https://dav.example.com/dav',
		'token',
		'/test/missing/',
		false,
	);
});
