import { render } from 'solid-js/web';
import App, { type AppProps } from './App';

export default function mount(el: Element, props: AppProps) {
	return render(() => <App {...props} />, el);
}
