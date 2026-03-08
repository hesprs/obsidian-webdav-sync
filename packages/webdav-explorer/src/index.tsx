import './assets/global.css';
import { render } from 'solid-js/web';
import App, { type AppProps } from './App';

export function mount(el: Element, props: AppProps) {
	return render(() => <App {...props} />, el);
}
