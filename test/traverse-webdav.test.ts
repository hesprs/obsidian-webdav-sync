import { expect, mock, test } from 'bun:test';

const getDirectoryContentsMock = mock(() =>
	Promise.resolve([] as Array<{ isDir: boolean; path: string }>),
);

void mock.module('~/fs/webdav/api', () => ({
	getDirectoryContents: getDirectoryContentsMock,
	getStat: mock(() => Promise.resolve({} as never)),
}));

const { traverseWebDAV } = await import('~/fs/webdav');

test('uses remote-base-aware path when traversing child directories', async () => {
	getDirectoryContentsMock.mockReset();
	getDirectoryContentsMock.mockResolvedValueOnce([{ isDir: true, path: '/test/webdav-sync/' }]);
	getDirectoryContentsMock.mockResolvedValueOnce([]);

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
	getDirectoryContentsMock.mockResolvedValueOnce([{ isDir: true, path: '/test/missing/' }]);
	getDirectoryContentsMock.mockRejectedValueOnce({
		message: '404: Not Found',
		res: { status: 404 },
	});

	await traverseWebDAV({ token: 'token' });

	expect(getDirectoryContentsMock).toHaveBeenNthCalledWith(
		2,
		'https://dav.example.com/dav',
		'token',
		'/test/missing/',
		false,
	);
});
