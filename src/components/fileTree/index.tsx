import { render } from 'solid-js/web';
import type { FileTreeAppProps } from './App';
import App from './App';

export type { default as FileTreeSelectionController } from './selection';
export type { FileTreeSelectionSnapshot } from './types';

export function mount(el: Element, props: FileTreeAppProps) {
	return render(() => <App {...props} />, el);
}
