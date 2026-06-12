import { Notice } from 'obsidian';
import { Show, createSignal } from 'solid-js';
import type { RemoteFs } from '~/fs';
import t from '~/i18n';
import { normalizeKey } from '~/utils/path';
import { createFileList } from './FileList';
import NewFolder from './NewFolder';

export type AppProps = {
	fs: RemoteFs;
	onConfirm: (path: string) => void;
	onClose: () => void;
};

type SingleColProps = {
	fs: RemoteFs;
	showNewFolder: () => boolean;
	setShowNewFolder: (value: boolean) => void;
	cwd: () => string | undefined;
	enter: (path: string) => void;
};

function SingleCol(props: SingleColProps) {
	const list = createFileList();
	return (
		<div class="flex-1 flex flex-col overflow-y-auto scrollbar-hide">
			<Show when={props.showNewFolder()}>
				<NewFolder
					class="mt-1"
					onCancel={() => {
						props.setShowNewFolder(false);
					}}
					onConfirm={(name) => void createFolder(props, list.refresh, name)}
				/>
			</Show>
			<list.FileList
				fs={props.fs}
				path={props.cwd() ?? ''}
				onClick={(f) => props.enter(f.key)}
			/>
		</div>
	);
}

async function createFolder(props: SingleColProps, refresh: () => void, name: string) {
	const target = normalizeKey(`${props.cwd()}${name}`, true);
	try {
		await Promise.resolve(props.fs.mkdir(target));
		props.setShowNewFolder(false);
		refresh();
	} catch (error) {
		if (error instanceof Error) new Notice(error.message);
	}
}

function App(props: AppProps) {
	const [stack, setStack] = createSignal(['/']);
	const [showNewFolder, setShowNewFolder] = createSignal(false);
	const cwd = () => stack().at(-1);

	function enter(path: string) {
		setStack((newStack) => [...newStack, path]);
	}

	function pop() {
		setStack((newStack) => (newStack.length > 1 ? newStack.slice(0, -1) : newStack));
	}

	return (
		<div class="flex flex-col gap-4 h-50vh">
			<SingleCol
				cwd={cwd}
				enter={enter}
				fs={props.fs}
				setShowNewFolder={setShowNewFolder}
				showNewFolder={showNewFolder}
			/>
			<div class="flex gap-2 text-xs">
				<span>{t('dirSelector.currentPath', { path: cwd() ?? '/' })}</span>
			</div>
			<div class="flex items-center gap-2">
				<button onClick={pop}>{t('dirSelector.goBack')}</button>
				<a class="no-underline" onClick={() => setShowNewFolder(true)}>
					{t('dirSelector.newFolder')}
				</a>
				<div class="flex-1" />
				<button onClick={props.onClose}>{t('dirSelector.cancel')}</button>
				<button onclick={() => props.onConfirm(cwd() ?? '/')}>
					{t('dirSelector.confirm')}
				</button>
			</div>
		</div>
	);
}

export default App;
