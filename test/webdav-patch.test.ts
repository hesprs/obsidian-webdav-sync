import { beforeEach, expect, mock, test } from 'bun:test';
import { getPatcher } from 'webdav';
import patchWebDav from '~/webdav-patch';

type RequestUrlCall = {
	contentType?: string;
	headers: Record<string, string>;
	method: string;
	url: string;
};

let lastCall: RequestUrlCall | undefined;
const requestUrlMock = mock(async (p: RequestUrlCall) => {
	lastCall = p;
	return {
		arrayBuffer: new ArrayBuffer(0),
		headers: {},
		status: 207,
		text: '',
	};
});

void mock.module('~/utils/request-url', () => ({
	default: requestUrlMock,
}));

beforeEach(() => {
	lastCall = undefined;
	patchWebDav();
});

test('uses the content-type header when present, ignoring accept', async () => {
	await getPatcher().execute('request', {
		headers: {
			accept: 'text/plain,application/xml',
			'content-type': 'application/xml; charset=utf-8',
		},
		method: 'PUT',
		url: 'https://webdav.mc.gmx.net/Notes/file.md',
	});

	expect(lastCall?.contentType).toBe('application/xml; charset=utf-8');
});

test('leaves contentType unset for body-less PROPFIND requests that only send accept', async () => {
	// Mirrors the webdav library's stat()/exists() calls, which only set an
	// Accept header (a comma list, invalid as Content-Type) and no body
	await getPatcher().execute('request', {
		headers: {
			Accept: 'text/plain,application/xml',
			Depth: '0',
		},
		method: 'PROPFIND',
		url: 'https://webdav.mc.gmx.net/',
	});

	expect(lastCall?.contentType).toBeUndefined();
});
