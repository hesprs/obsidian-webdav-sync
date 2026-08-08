import { Ct as FolderStat, St as FileStat, f as Request, p as RequestParam, ut as Fs, vt as RootFs, xt as Binary, yt as WrappedFs } from "./index-B5tgeZSc.spec.js";
//#region src/sdk/debug-wrapper.d.ts
declare function debugWrapper(original: Fs, log: (content: string) => void): WrappedFs;
//#endregion
//#region test/test-kit.d.ts
type FsCalls = {
  delete: Array<string>;
  exists: Array<string>;
  list: Array<string>;
  mkdir: Array<string>;
  move: Array<[string, string]>;
  read: Array<[string, FileStat]>;
  readStream: Array<[string, FileStat]>;
  stat: Array<string>;
  write: Array<[string, Binary, FileStat]>;
  writeStream: Array<[string, FileStat]>;
};
type FsOptions = {
  control?: Partial<Fs>;
  uid?: string;
};
type FsHarness = {
  calls: FsCalls;
  control: Fs;
  fs: RootFs;
};
type RequestHarness = {
  calls: Array<RequestParam | string>;
  request: Request;
};
declare function bytes(value: string): Binary;
declare function file(key: string, options?: {
  mtime?: number;
  size?: number;
  uid?: string;
}): FileStat;
declare function folder(key: string): FolderStat;
declare function stream(chunks?: Array<string | Binary>): ReadableStream<Binary>;
declare function deferred<T>(): {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T | PromiseLike<T>) => void;
};
declare function flush(turns?: number): Promise<void>;
declare function request(control: Request): RequestHarness;
declare function fs(options?: FsOptions): FsHarness;
declare const testKit: {
  bytes: typeof bytes;
  deferred: typeof deferred;
  file: typeof file;
  flush: typeof flush;
  folder: typeof folder;
  fs: typeof fs;
  request: typeof request;
  stream: typeof stream;
};
//#endregion
//#region src/utils/sha-256.d.ts
declare function sha256(input: string): Promise<string>;
//#endregion
//#region src/sdk/transform.d.ts
type SyncEngineConfig = {
  deps?: {
    neverBundle?: true | string | RegExp | Array<string | RegExp> | ((id: string, parentId: string | undefined, isResolved: boolean) => boolean | null | undefined);
  };
};
declare function syncEngineTransform(): {
  name: string;
  renderChunk(code: string): {
    code: string;
  } | undefined;
  tsdownConfig(config: SyncEngineConfig): void;
};
//#endregion
export { debugWrapper, sha256, syncEngineTransform, testKit };