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

test('prefers the content-type header over accept when deriving the requestUrl contentType', async () => {
	await getPatcher().execute('request', {
		headers: {
			accept: 'text/plain,application/xml',
			'content-type': 'application/xml; charset=utf-8',
		},
		method: 'PROPFIND',
		url: 'https://webdav.mc.gmx.net/Notes',
	});

	expect(lastCall?.contentType).toBe('application/xml; charset=utf-8');
});

test('falls back to the accept header when no content-type is present', async () => {
	await getPatcher().execute('request', {
		headers: {
			accept: 'text/plain,application/xml',
		},
		method: 'GET',
		url: 'https://webdav.mc.gmx.net/Notes/file.md',
	});

	expect(lastCall?.contentType).toBe('text/plain,application/xml');
});
