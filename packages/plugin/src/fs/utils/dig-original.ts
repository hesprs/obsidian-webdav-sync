import type { RemoteFs, LocalFs, RootLocalFs, RootRemoteFs } from '../interface';

type DigOriginalResult<
	FS extends RootRemoteFs | RootLocalFs | undefined,
	WrappedFs extends RemoteFs | LocalFs,
> = [FS] extends [undefined] ? (WrappedFs extends RemoteFs ? RootRemoteFs : RootLocalFs) : FS;

export default function digOriginal<
	FS extends RootRemoteFs | RootLocalFs | undefined = undefined,
	WrappedFs extends RemoteFs | LocalFs = RemoteFs,
>(wrapped: WrappedFs): DigOriginalResult<FS, WrappedFs> {
	let original: RemoteFs | LocalFs = wrapped;
	while ('original' in original) original = original.original;
	return original as DigOriginalResult<FS, WrappedFs>;
}
