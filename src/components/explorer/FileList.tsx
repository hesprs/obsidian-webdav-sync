import { Notice } from 'obsidian';
import { For, Show, createEffect, createSignal } from 'solid-js';
import type { FolderStat, RemoteFs, Stat } from '~/fs-new';
import { basename } from '~/platform/path';
import File from './File';
import Folder from './Folder';

export type FileListProps = {
	path: string;
	fs: RemoteFs;
	onClick: (file: FolderStat) => void;
};

export function createFileList() {
	const [version, setVersion] = createSignal(0);
	return {
		FileList: (props: FileListProps) => {
			const [items, setItems] = createSignal<Array<Stat>>([]);

			const sortedItems = () =>
				items().sort((a, b) => {
					if (a.isDir === b.isDir) return basename(a.key).localeCompare(basename(b.key));
					return a.isDir && !b.isDir ? -1 : 1;
				});

			async function refresh() {
				try {
					const newItems = await props.fs.list(props.path);
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
						<Show when={f.isDir} fallback={<File name={basename(f.key)} />}>
							<Folder
								name={basename(f.key)}
								path={f.key}
								onClick={() => {
									if (f.isDir) props.onClick(f);
								}}
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
