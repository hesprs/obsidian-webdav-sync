import type { RemoteFs, WrappedRemoteFs } from '../interface';

export default function digOriginal(wrapped: WrappedRemoteFs | RemoteFs) {
	const stack: Array<RemoteFs | WrappedRemoteFs> = [wrapped];
	while ('original' in (stack.at(-1) as RemoteFs | WrappedRemoteFs))
		stack.push((stack.at(-1) as WrappedRemoteFs).original);
	return stack;
}
