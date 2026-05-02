import { render } from 'solid-js/web';
import type { AppProps } from './App';
import App from './App';

export default function mount(el: Element, props: AppProps) {
	return render(() => <App {...props} />, el);
}
