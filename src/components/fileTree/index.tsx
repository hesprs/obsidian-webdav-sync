import { render } from 'solid-js/web';
import App, { type FileTreeAppProps } from './App';

export type { default as FileTreeSelectionController } from './selection';
export type { FileTreeSelectionSnapshot } from './types';

export function mount(el: Element, props: FileTreeAppProps) {
	return render(() => <App {...props} />, el);
}
