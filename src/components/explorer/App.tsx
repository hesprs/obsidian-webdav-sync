import { Notice } from 'obsidian';
import { Show, createSignal } from 'solid-js';
import t from '~/i18n';
import { normalizeRemotePath } from '~/platform/path';
import { type FileStat, createFileList } from './components/FileList';
import NewFolder from './components/NewFolder';

function joinRemotePath(...parts: Array<string>): `/${string}` {
	return normalizeRemotePath(parts.join('/')) as `/${string}`;
}

export type fs = {
	ls: (path: string) => Promise<Array<FileStat>> | Array<FileStat>;
	mkdirs: (path: string) => Promise<void> | void;
};

export type AppProps = {
	fs: fs;
	onConfirm: (path: string) => void;
	onClose: () => void;
};

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

	async function createFolder(name: string, refresh: () => void) {
		const target = joinRemotePath(cwd() ?? '/', name);
		try {
			await Promise.resolve(props.fs.mkdirs(target));
			setShowNewFolder(false);
			refresh();
		} catch (error) {
			if (error instanceof Error) new Notice(error.message);
		}
	}

	const SingleCol = () => {
		const list = createFileList();
		return (
			<div class="flex-1 flex flex-col overflow-y-auto scrollbar-hide">
				<Show when={showNewFolder()}>
					<NewFolder
						class="mt-1"
						onCancel={() => {
							setShowNewFolder(false);
						}}
						onConfirm={(name) => void createFolder(name, list.refresh)}
					/>
				</Show>
				<list.FileList fs={props.fs} path={cwd() ?? ''} onClick={(f) => enter(f.path)} />
			</div>
		);
	};

	return (
		<div class="flex flex-col gap-4 h-50vh">
			<SingleCol />
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
