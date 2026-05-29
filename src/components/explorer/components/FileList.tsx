import { Notice } from 'obsidian';
import { For, Show, createEffect, createSignal } from 'solid-js';
import type { fs } from '../App';
import File from './File';
import Folder from './Folder';

export type FileStat = {
	path: string;
	basename: string;
	isDir: boolean;
};

export type FileListProps = {
	path: string;
	fs: fs;
	onClick: (file: FileStat) => void;
};

export function createFileList() {
	const [version, setVersion] = createSignal(0);
	return {
		FileList: (props: FileListProps) => {
			const [items, setItems] = createSignal<Array<FileStat>>([]);

			const sortedItems = () =>
				items().sort((a, b) => {
					if (a.isDir === b.isDir) return a.basename.localeCompare(b.basename, ['zh']);
					return a.isDir && !b.isDir ? -1 : 1;
				});

			async function refresh() {
				try {
					const newItems = await props.fs.ls(props.path);
					setItems(newItems);
				} catch (error) {
					if (error instanceof Error) new Notice(error.message);
					else new Notice(`WebDAV unknown error`);
				}
			}

			createEffect(() => {
				if (version() === 0) {
					void refresh();
					return;
				}
				setVersion(0);
			});

			return (
				<For each={sortedItems()}>
					{(f) => (
						<Show when={f.isDir} fallback={<File name={f.basename} />}>
							<Folder
								name={f.basename}
								path={f.path}
								onClick={() => props.onClick(f)}
							/>
						</Show>
					)}
				</For>
			);
		},
		refresh: () => {
			setVersion((v) => ++v);
		},
	};
}
