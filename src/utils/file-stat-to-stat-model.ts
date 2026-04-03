import type { FileStat } from 'webdav';
import type { StatModel } from '~/types';

export function fileStatToStatModel(from: FileStat): StatModel {
	return {
		path: from.filename,
		isDir: from.type === 'directory',
		mtime: new Date(from.lastmod).valueOf(),
		size: from.size,
	};
}
