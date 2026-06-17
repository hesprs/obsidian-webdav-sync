import type { RemoteFs, WrappedRemoteFs, LocalFs, WrappedLocalFs } from '../interface';

export default function digOriginal(wrapped: RemoteFs | LocalFs) {
	const stack: Array<RemoteFs | LocalFs> = [wrapped];
	while ('original' in (stack.at(-1) as RemoteFs | LocalFs))
		stack.push((stack.at(-1) as WrappedRemoteFs | WrappedLocalFs).original);
	return stack;
}
