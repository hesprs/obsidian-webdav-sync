import { App, Command, EventRef, IconName, ListedFiles, Modal, Plugin, RequestUrlParam, Stat, ToggleComponent } from "obsidian";
//#region test/e2e-utils.d.ts
type General$1 = any;
//#endregion
//#region src/types.d.ts
type MaybePromise<T> = Promise<T> | T;
type TogglableValue<T = number> = {
  enabled: boolean;
  value: T;
};
type FileStat = {
  isDir: false;
  key: string;
  mtime: number;
  size: number;
  uid: string;
};
type FolderStat = {
  isDir: true;
  key: string;
};
type Stat$1 = FileStat | FolderStat;
type RecordStat = {
  isDir: false;
  local: string;
  remote: string;
} | {
  isDir: true;
};
type StatsMap = Map<string, Stat$1>;
type RecordStatsMap = Map<string, RecordStat>;
type GlobMatchRule = {
  expr: string;
  caseSensitive: boolean;
};
type Progress<T = string> = {
  total: number;
  completed: number;
  current?: T;
};
type Binary = Uint8Array<ArrayBuffer>;
//#endregion
//#region src/utils/glob-match.d.ts
type GlobMatchResult = 'include' | 'exclude' | 'advance';
//#endregion
//#region src/fs/interface.d.ts
/**
 * All keys use unified format:
 * - root: `/`
 * - file: `note.md`, `folder/note.md`
 * - folder: `folder/`, `folder/nested/`
 */
type RootFs = {
  getUid(): string;
  read(key: string, stat: FileStat): MaybePromise<Binary>;
  readStream(key: string, stat: FileStat): MaybePromise<ReadableStream<Binary>>;
  write(key: string, value: Binary, stat: FileStat): MaybePromise<string>;
  writeStream(key: string, value: ReadableStream<Binary>, stat: FileStat): MaybePromise<string>;
  delete(key: string): MaybePromise<void>;
  move(oldKey: string, newKey: string): MaybePromise<void>;
  mkdir(key: string, recursive?: boolean): MaybePromise<void>;
  stat(key: string): MaybePromise<Stat$1>;
  exists(key: string): MaybePromise<boolean>;
  list(key: string, reporter: ListReporter): MaybePromise<Array<Stat$1>>;
};
type ListReporter = (progress: Required<Progress>) => MaybePromise<GlobMatchResult>;
type WrappedFs = RootFs & {
  original: Fs;
};
type Fs = WrappedFs | RootFs;
type WriteAtom = {
  type: 'write';
  key: string;
  execute: () => MaybePromise<string>;
  resolve: (uid: string) => void;
  reject: (err: Error) => void;
};
type DeleteAtom = {
  type: 'delete';
  key: string;
  execute: () => MaybePromise<void>;
  resolve: () => void;
  reject: (err: Error) => void;
};
type MoveAtom = {
  type: 'move';
  oldKey: string;
  newKey: string;
  execute: () => MaybePromise<void>;
  resolve: () => void;
  reject: (err: Error) => void;
};
type MkdirAtom = {
  type: 'mkdir';
  key: string;
  execute: () => MaybePromise<void>;
  resolve: () => void;
  reject: (err: Error) => void;
};
type InputAtom = WriteAtom | DeleteAtom | MoveAtom | MkdirAtom;
type CustomAtom = {
  type: 'custom';
  execute: () => MaybePromise<void>;
};
type OutputAtom = InputAtom | CustomAtom;
type OptimizerInput = {
  atoms: Array<InputAtom>;
  fs: Fs;
  executeAtom: (atom: OutputAtom) => Promise<void | string>;
};
type OptimizerOutput = Array<OutputAtom>;
type BatchOptimizer = (input: OptimizerInput) => OptimizerOutput;
//#endregion
//#region ../../node_modules/.bun/uni-kv@..+..+uni-kv.tgz/node_modules/uni-kv/dist/interface.d.ts
//#region src/interface.d.ts
type Database<D extends Record<string, unknown>, M extends Record<string, unknown>, F extends boolean> = {
  getStore<K extends keyof D>(name: K): Store<D[K], F>;
  getStoreNames(): IsPromise<Array<string>, F>;
  deleteStore(name: string): IsPromise<void, F>;
  clearStores(): IsPromise<void, F>;
  getMeta<T extends keyof M>(key: T): IsPromise<M[T] | undefined, F>;
  setMeta<T extends keyof M>(key: T, value: M[T]): IsPromise<void, F>;
  dispose(): IsPromise<void, F>;
};
type Store<T, F extends boolean> = {
  get(key: string): IsPromise<T | undefined, F>;
  set(key: string, value: T): IsPromise<void, F>;
  delete(key: string): IsPromise<void, F>;
  clear(): IsPromise<void, F>;
  keys(): IsPromise<Array<string>, F>;
  values(): IsPromise<Array<T>, F>;
  entries(): IsPromise<Array<[string, T]>, F>;
  batch(operations: Array<StoreOperations<T>>): IsPromise<Array<GetResult<T>>, F>;
};
type StoreSync<T = unknown> = Store<T, false>;
type StoreAsync<T = unknown> = Store<T, true>;
type DatabaseSync<D extends Record<string, unknown> = Record<string, unknown>, M extends Record<string, unknown> = {}> = Database<D, M, false>;
type DatabaseAsync<D extends Record<string, unknown> = Record<string, unknown>, M extends Record<string, unknown> = {}> = Database<D, M, true>;
type GetOperation = {
  type: 'get';
  key: string;
};
type GetResult<T> = {
  key: string;
  value: T | undefined;
};
type SetOperation<T> = {
  type: 'set';
  key: string;
  value: T;
};
type DeleteOperation = {
  type: 'delete';
  key: string;
};
type StoreOperations<T> = GetOperation | SetOperation<T> | DeleteOperation;
type IsPromise<T, F extends boolean> = F extends true ? Promise<T> : T;
//#endregion
//#region ../../node_modules/.bun/synthkernel@.+synthkernel.tgz/node_modules/synthkernel/dist/context.d.ts
//#region src/context.d.ts
type General = any;
type GeneralConstructor = new (...args: Array<General>) => General;
type ModuleConstructor<C extends object> = new (context: C) => General;
type GeneralModuleInput = ReadonlyArray<GeneralConstructor> | ReadonlyArray<object>;
type IsPlainObject<T> = T extends object ? T extends Function | Date | RegExp | Array<any> | Map<any, any> | Set<any> ? false : true : false;
type ShallowMerge<A, B> = IsPlainObject<A> extends true ? (IsPlainObject<B> extends true ? Omit<A, keyof B> & B : B) : B;
type Keys<T> = T extends General ? keyof T : never;
type InstanceEach<T extends GeneralModuleInput> = T extends ReadonlyArray<GeneralConstructor> ? { [K in keyof T]: InstanceType<T[K]>; } : T;
type PickEach<T extends ReadonlyArray<object>, K extends PropertyKey> = { [I in keyof T]: Pick<T[I], Extract<K, keyof T[I]>>; };
type RootValue<T extends object> = RootKey extends keyof T ? Extract<T[RootKey], object> : {};
type MergeRootEach<T extends ReadonlyArray<object>> = { [I in keyof T]: ShallowMerge<Omit<T[I], RootKey>, RootValue<T[I]>>; };
type ExtractKeyEach<T extends ReadonlyArray<object>, K extends Keys<T>> = { [I in keyof T]: K extends keyof T[I] ? T[I][K] : never; };
type MergeObjects<T extends ReadonlyArray<object>, O extends ReadonlyArray<object> = MergeRootEach<T>> = { [P in Keys<O[number]>]: MergeValues<ExtractKeyEach<O, P>>; };
type MergeSingleKey<M extends GeneralModuleInput, K extends Keys<InstanceEach<M>[number]>> = MergeValues<ExtractKeyEach<InstanceEach<M>, K>>;
type MergePair<A, B> = [A] extends [never] ? B : [B] extends [never] ? A : ShallowMerge<A, B>;
type MergeValues<T extends ReadonlyArray<unknown>> = T extends readonly [infer First, ...infer Rest] ? [First] extends [never] ? MergeValues<Rest> : Rest extends ReadonlyArray<unknown> ? Rest['length'] extends 0 ? First : MergePair<First, MergeValues<Rest>> : never : never;
type MergeResult<M extends GeneralModuleInput, K extends Keys<InstanceEach<M>[number]>, Pr extends object, Po extends object> = MergeObjects<[Pr, ...PickEach<InstanceEach<M>, K>, Po]>;
type Context$1<M extends GeneralModuleInput, K extends Keys<InstanceEach<M>[number]>, Pr extends object = {}, Po extends object = {}> = MergeResult<M, K, Pr, Po> & {
  __modules__: WeakMap<M[number], InstanceEach<M>[number]>;
  __getModule__: <C extends new (ctx: General) => InstanceEach<M>[number]>(ctor: C) => InstanceType<C>;
  __addModule__: <N extends ModuleConstructor<Context$1<[...M, N], K, Pr, Po>>>(newModule: N) => Context$1<[...M, N], K, Pr, Po>;
  __assign__: (obj: Partial<MergeResult<M, K, Pr, Po>>) => Context$1<M, K, Pr, Po>;
};
declare const ROOT_KEY = "root";
type RootKey = typeof ROOT_KEY;
//#endregion
//#region ../../node_modules/.bun/synthkernel@.+synthkernel.tgz/node_modules/synthkernel/dist/reactive.d.ts
//#region src/reactive.d.ts
type RefMatchingFunc<T> = (newValue: T, oldValue: T) => unknown;
type Ref<T> = {
  (): T;
  (newValue: T): void;
  subscribe(func: RefMatchingFunc<T>, options?: {
    immediate?: boolean;
  }): () => void;
  unsubscribe(func: RefMatchingFunc<T>): void;
  clear(): void;
};
//#endregion
//#region src/modules/EventBus.d.ts
type Dispatch<O extends object> = <K extends keyof O>(...[key, payload]: undefined extends O[K] ? [K] : [K, O[K]]) => void;
type On<O extends object> = <K extends keyof O>(key: K, callback: (payload: O[K]) => void) => () => void;
declare class EventBus {
  readonly events: {
    logSync: string;
    logGeneral: string;
    errorSync: string;
    errorGeneral: string;
  };
  private readonly cleanupCallbacks;
  private readonly isIdle;
  private readonly syncLogs;
  private readonly generalLogs;
  constructor();
  private readonly getThisSync;
  private readonly putSyncLog;
  private readonly putGeneralLog;
  private readonly subscribers;
  private readonly on;
  private readonly dispatch;
  private readonly getLogs;
  readonly dispose: () => void;
  readonly root: {
    dispatch: Dispatch<General$1>;
    getLogs: () => string;
    isIdle: Ref<boolean>;
    on: On<General$1>;
  };
}
//#endregion
//#region src/modules/I18n.d.ts
type ObsidianLanguageCode = 'en' | 'af' | 'am' | 'ar' | 'az' | 'be' | 'bg' | 'bn' | 'ca' | 'cs' | 'da' | 'de' | 'dv' | 'el' | 'en-GB' | 'eo' | 'es' | 'eu' | 'fa' | 'fi' | 'fr' | 'ga' | 'gl' | 'he' | 'hi' | 'hr' | 'hu' | 'id' | 'it' | 'ja' | 'ka' | 'kh' | 'kn' | 'ko' | 'ky' | 'la' | 'lt' | 'lv' | 'ml' | 'ms' | 'nan-TW' | 'ne' | 'nl' | 'nn' | 'no' | 'oc' | 'or' | 'pl' | 'pt' | 'pt-BR' | 'ro' | 'ru' | 'sa' | 'si' | 'sk' | 'sl' | 'sq' | 'sr' | 'sv' | 'sw' | 'ta' | 'te' | 'th' | 'tl' | 'tr' | 'tt' | 'uk' | 'ur' | 'uz' | 'vi' | 'zh' | 'zh-TW';
type Primitive = string | number | boolean | null | undefined;
type Fragment<A = undefined> = (frag: DocumentFragment, args: A) => void;
type TranslationResource = Record<string, string | Fragment<General$1>>;
type InterpolationValues = Record<string, Primitive>;
type TranslateParams<R extends Fragment<General$1> | string> = R extends Fragment<infer A> ? ([undefined] extends [A] ? [] : [A]) : [] | [InterpolationValues];
type Translate<O extends TranslationResource> = <K extends keyof O>(key: K, ...args: TranslateParams<O[K]>) => O[K] extends string ? string : DocumentFragment;
declare class I18n {
  private readonly targetLangs;
  readonly i18n: {};
  private readonly registerI18n;
  private readonly translate;
  root: {
    registerI18n: (code: ObsidianLanguageCode, resource: TranslationResource) => void;
    translate: Translate<General$1>;
  };
}
//#endregion
//#region src/modules/Storage.d.ts
type RecordStore = StoreAsync<RecordStat>;
declare class Storage {
  private readonly ctx;
  private readonly memoryDB;
  private readonly indexedDB;
  constructor(ctx: {
    getNamespace: () => string;
  });
  private readonly getRecordStore;
  private readonly deleteRecordStore;
  private readonly clearRecordStores;
  private readonly recordStoreExists;
  readonly root: {
    clearRecordStores: () => Promise<void>;
    deleteRecordStore: (namespace?: string) => MaybePromise<void>;
    getRecordStore: (namespace?: string) => {
      get(key: string): Promise<RecordStat | undefined>;
      set(key: string, value: RecordStat): Promise<void>;
      delete(key: string): Promise<void>;
      clear(): Promise<void>;
      keys(): Promise<string[]>;
      values(): Promise<RecordStat[]>;
      entries(): Promise<[string, RecordStat][]>;
      batch(operations: StoreOperations<RecordStat>[]): Promise<GetResult<RecordStat>[]>;
    };
    indexedDB: DatabaseAsync<General$1, General$1>;
    memoryDB: {
      getStore<K extends string | number | symbol>(name: K): {
        get(key: string): any;
        set(key: string, value: any): void;
        delete(key: string): void;
        clear(): void;
        keys(): string[];
        values(): any[];
        entries(): [string, any][];
        batch(operations: StoreOperations<any>[]): GetResult<any>[];
      };
      getStoreNames(): string[];
      deleteStore(name: string): void;
      clearStores(): void;
      getMeta<T extends string | number | symbol>(key: T): any;
      setMeta<T extends string | number | symbol>(key: T, value: any): void;
      dispose(): void;
    };
    recordStoreExists: (namespace?: string) => MaybePromise<boolean>;
  };
  readonly dispose: () => void;
}
//#endregion
//#region src/sync/tasks/interface.d.ts
type BaseTaskOptions = {
  localFs: Fs;
  remoteFs: Fs;
  record: RecordStore;
};
type TaskNames = 'addRecord' | 'removeRecord' | 'createLocalDir' | 'createRemoteDir' | 'download' | 'resolveConflict' | 'removeLocal' | 'removeRemote' | 'upload' | 'moveLocal' | 'moveRemote';
type ConflictResolverPayload = {
  local: FileStat;
  remote: FileStat;
  key: string;
  localFs: Fs;
  remoteFs: Fs;
  record: RecordStore;
};
type ConflictResolver = (payload: ConflictResolverPayload) => MaybePromise<void>;
declare abstract class BaseTask<T extends TaskOptions = TaskOptions> {
  readonly options: BaseTaskOptions & T;
  constructor(options: BaseTaskOptions & T);
  protected readonly remoteFs: Fs;
  protected readonly localFs: Fs;
  protected readonly record: RecordStore;
  name: TaskNames;
  prettyName: string;
  readonly key: string;
  readonly local: (BaseTaskOptions & T)['local'];
  readonly remote: (BaseTaskOptions & T)['remote'];
  abstract exec(): MaybePromise<void>;
}
//#endregion
//#region src/sync/tasks/AddRecord.d.ts
declare class AddRecord extends BaseTask<OptionsWithBothStats> {
  exec(): Promise<void>;
}
//#endregion
//#region src/sync/tasks/CreateRemoteDir.d.ts
declare class CreateRemoteDir extends BaseTask<OptionsWithLocalFolderStat> {
  exec(): Promise<void>;
}
//#endregion
//#region src/sync/tasks/Download.d.ts
declare class Download extends BaseTask<OptionsWithRemoteFileStat> {
  exec(): Promise<void>;
}
//#endregion
//#region src/sync/tasks/MoveLocal.d.ts
declare class MoveLocal extends BaseTask<OptionsWithRemoteStatAndOldKey> {
  exec(): Promise<void>;
}
//#endregion
//#region src/sync/tasks/MoveRemote.d.ts
declare class MoveRemote extends BaseTask<OptionsWithLocalStatAndOldKey> {
  exec(): Promise<void>;
}
//#endregion
//#region src/sync/tasks/RemoveLocal.d.ts
declare class RemoveLocal extends BaseTask<OptionsWithLocalStat> {
  exec(): Promise<void>;
}
//#endregion
//#region src/sync/tasks/RemoveRecord.d.ts
declare class RemoveRecord extends BaseTask {
  exec(): Promise<void>;
}
//#endregion
//#region src/sync/tasks/RemoveRemote.d.ts
declare class RemoveRemote extends BaseTask<OptionsWithRemoteStat> {
  exec(): Promise<void>;
}
//#endregion
//#region src/sync/tasks/ResolveConflict.d.ts
declare class ResolveConflict extends BaseTask<OptionsWithBothFileStats & {
  resolver: ConflictResolver;
}> {
  exec: () => MaybePromise<void>;
}
//#endregion
//#region src/sync/tasks/Upload.d.ts
declare class Upload extends BaseTask<OptionsWithLocalFileStat> {
  exec(): Promise<void>;
}
//#endregion
//#region src/sync/decision/interface.d.ts
type TaskOptions = {
  key: string;
  remote?: Stat$1;
  local?: Stat$1;
};
type OptionsWithRemoteFileStat = {
  remote: FileStat;
} & TaskOptions;
type OptionsWithLocalFileStat = {
  local: FileStat;
} & TaskOptions;
type OptionsWithRemoteFolderStat = {
  remote: FolderStat;
} & TaskOptions;
type OptionsWithLocalFolderStat = {
  local: FolderStat;
} & TaskOptions;
type OptionsWithLocalStat = {
  local: Stat$1;
} & TaskOptions;
type OptionsWithRemoteStat = {
  remote: Stat$1;
} & TaskOptions;
type OptionsWithBothStats = {
  local: Stat$1;
  remote: Stat$1;
} & TaskOptions;
type OptionsWithBothFileStats = {
  local: FileStat;
  remote: FileStat;
} & TaskOptions;
type OptionsWithLocalStatAndOldKey = {
  local: Stat$1;
  oldKey: string;
} & TaskOptions;
type OptionsWithRemoteStatAndOldKey = {
  remote: Stat$1;
  oldKey: string;
} & TaskOptions;
type TaskOptionsMap = {
  download: OptionsWithRemoteFileStat;
  upload: OptionsWithLocalFileStat;
  resolveConflict: OptionsWithBothFileStats;
  removeLocal: OptionsWithLocalStat;
  removeRemote: OptionsWithRemoteStat;
  createLocalDir: OptionsWithRemoteFolderStat;
  createRemoteDir: OptionsWithLocalFolderStat;
  removeRecord: TaskOptions;
  addRecord: OptionsWithBothStats;
  moveLocal: OptionsWithRemoteStatAndOldKey;
  moveRemote: OptionsWithLocalStatAndOldKey;
};
declare const taskMap: {
  readonly addRecord: typeof AddRecord;
  readonly createLocalDir: typeof CreateLocalDir;
  readonly createRemoteDir: typeof CreateRemoteDir;
  readonly download: typeof Download;
  readonly moveLocal: typeof MoveLocal;
  readonly moveRemote: typeof MoveRemote;
  readonly removeLocal: typeof RemoveLocal;
  readonly removeRecord: typeof RemoveRecord;
  readonly removeRemote: typeof RemoveRemote;
  readonly resolveConflict: typeof ResolveConflict;
  readonly upload: typeof Upload;
};
type TaskFactory = <N extends TaskNames>(name: N, options: TaskOptionsMap[N]) => InstanceType<(typeof taskMap)[N]>;
type Decider = (input: DeciderInput) => Array<BaseTask>;
type DeciderInput = {
  localStats: StatsMap;
  remoteStats: StatsMap;
  records: RecordStatsMap;
  taskFactory: TaskFactory;
  logger: (log: string) => void;
};
//#endregion
//#region src/sync/tasks/CreateLocalDir.d.ts
declare class CreateLocalDir extends BaseTask<OptionsWithRemoteFolderStat> {
  exec(): Promise<void>;
}
//#endregion
//#region src/modules/Sync.d.ts
type SyncTerminateReason = {
  result: 'cancelled';
} | {
  result: 'completed';
} | {
  result: 'failed';
  error: string;
} | {
  result: 'noop';
};
type TaskInfo = {
  name: TaskNames;
  key: string;
  prettyName: string;
  isDir: boolean;
};
type FailedTaskInfo = TaskInfo & {
  error: string;
};
declare class Sync {
  private readonly ctx;
  dispatch: Dispatch<Events>;
  on: On<Events>;
  constructor(ctx: {
    dispatch: Dispatch<Events>;
    initializeSync: () => Infras;
    getDecider: () => Decider;
    on: On<Events>;
    translate: Translate<Translations>;
    listRemote: RemoteLister;
    getConflictResolver: () => ConflictResolver;
  });
  readonly events: {
    syncStarted: {
      isCancelled: Ref<boolean>;
      trigger: string;
    };
    remoteWalkProgress: Progress;
    syncTerminated: SyncTerminateReason;
    requestConfirmDelete: Array<RemoveLocal>;
    requestConfirmTasks: Array<BaseTask>;
    syncCanceled: undefined;
    taskCompleted: TaskInfo;
    taskFailed: FailedTaskInfo;
    executionStarted: Array<BaseTask>;
  };
  readonly settings: {
    maxFileSize: TogglableValue;
    exclusionRules: Array<GlobMatchRule>;
    inclusionRules: Array<GlobMatchRule>;
    confirmDeleteInAutoSync: boolean;
    confirmTasksInSync: boolean;
  };
  private readonly postProcess;
  private readonly confirmTasks;
  private readonly confirmDeletion;
  private readonly executeSync;
  private convertDeleteToUpload;
  root: {
    executeSync: (trigger: string) => Promise<{
      result: 'cancelled';
    } | {
      result: 'completed';
    } | {
      result: 'failed';
      error: string;
    } | {
      result: 'noop';
    }>;
  };
}
//#endregion
//#region src/modules/Observability.d.ts
type SyncStage = 'none' | 'walkingRemote' | 'awaitingConfirmation' | 'executing' | 'completed' | 'completedNoop' | 'cancelled' | 'failed';
type AddRibbonIcon = (icon: IconName, title: string, callback: (evt: MouseEvent) => void) => HTMLElement;
declare class Observability {
  private readonly ctx;
  private lastSyncTime;
  private readonly sinceLastSyncText;
  private readonly syncStage;
  private readonly walkProgress;
  private readonly executionProgress;
  private readonly cleanupCallbacks;
  private readonly t;
  private readonly progressText;
  readonly settings: {
    noticeStatusOnMobile: boolean;
  };
  readonly i18n: {
    startSync: string;
    startNonInteractiveSync: string;
    stopSync: string;
    showProgress: string;
    exportLogsToFile: string;
    exportLogsFailed: string;
    idle: string;
  };
  constructor(ctx: {
    addStatusBarItem: () => HTMLElement;
    on: On<Events>;
    translate: Translate<Translations>;
    isIdle: Ref<boolean>;
    dispatch: Dispatch<Events>;
    requestSync: (trigger: string) => Promise<SyncTerminateReason>;
    showProgress: () => void;
    addCommand: (command: Command) => Command;
    addRibbonIcon: AddRibbonIcon;
    getLogs: () => string;
    app: App;
  });
  readonly start: () => void;
  private readonly setupStatus;
  private readonly setupCommands;
  private readonly exportLogs;
  readonly dispose: () => void;
  root: {
    executionProgress: Ref<Progress<TaskInfo>>;
    exportLogs: () => Promise<void>;
    syncStage: Ref<SyncStage>;
    walkProgress: Ref<Progress>;
  };
}
//#endregion
//#region src/components/file-tree/index.d.ts
type FileTreeTranslations = {
  selectAll: string;
};
//#endregion
//#region src/components/HeadersEditorModal.d.ts
type HeadersEditorTranslations = {
  add: string;
  cancel: string;
  addSecretHeader: string;
  remove: string;
  save: string;
  customHeadersDescription: string;
  editHeaders: string;
  headerKeyPlaceholder: string;
  headerValuePlaceholder: string;
  omittedInvalidEntry: string;
};
//#endregion
//#region src/components/MigrationModal.d.ts
type MigrationModalTranslations = {
  cancel: string;
  remoteMigration: string;
  migrationProcess: string;
  startMigration: string;
  migrationDescription: string;
  migrationPhase1Description: string;
  migrationPhase2Description: string;
  migrationPhase3Description: string;
  toggleWithoutMigration: string;
  migrationFailed: string;
  completed: string;
  hide: string;
  done: string;
};
type MigrationEvents = {
  migrationProgress: Progress;
  migrationFailed: string;
};
type MigrationContext = {
  app: App;
  on: On<MigrationEvents>;
  dispatch: Dispatch<MigrationEvents & Events>;
  translate: Translate<MigrationModalTranslations>;
  requestSync: (trigger: string) => Promise<SyncTerminateReason>;
  initializeSync: () => Infras;
  memoryDB: ExistingMemoryDB;
};
declare function setNeedMigration(ctx: MigrationContext, { toggle, needMigration, content, apply }: {
  toggle: ToggleComponent;
  needMigration?: (value: boolean) => MaybePromise<boolean>;
  content: (value: boolean) => string | DocumentFragment;
  apply: (value: boolean) => MaybePromise<void>;
}): void;
//#endregion
//#region src/sdk/prefix.d.ts
declare function prefixWrapper(original: Fs, prefix: string): WrappedFs;
//#endregion
//#region src/utils/pipe.d.ts
declare function pipe({ from, to, stat, key }: {
  from: Fs;
  to: Fs;
  key: string;
  stat: FileStat;
}): Promise<string | undefined>;
declare function readWithSize(fs: Fs, key: string, stat: FileStat): Promise<Binary | ReadableStream<Binary> | undefined>;
declare function writeWithValue(fs: Fs, key: string, value: Binary | ReadableStream<Binary>, stat: FileStat): MaybePromise<string>;
//#endregion
//#region src/sdk/index.d.ts
declare function digOriginal(wrapped: Fs): RootFs;
type SelectFromContext<O extends object> = Context extends O ? O : never;
//#endregion
//#region src/modules/Extensibility.d.ts
type ModuleInstance = {
  moduleSettings: object;
  dispose?: () => void;
  start?: () => void;
};
type ModuleCtor = new (ctx: object) => ModuleInstance;
type ModuleMeta = {
  id: string;
  name: string;
  version: string;
  description: string;
  main: string;
  icon?: string;
  minPluginVersion?: string;
  integrity: string;
};
type AugmentedModuleMeta = ModuleMeta & {
  enabled: boolean;
  source: string;
  icon: string;
};
declare class Extensibility {
  private readonly ctx;
  private readonly moduleDir;
  private readonly sourceCache;
  private readonly discoveredModules;
  private readonly loadedModules;
  private readonly moduleStore;
  private autoUpdateTimeout?;
  readonly settings: {
    moduleSources: Array<string>;
    moduleAutoUpdate: boolean;
    modules: Record<string, object>;
  };
  readonly i18n: {
    failedToLoadModule: string;
    failedToDownloadModule: string;
    failedToFetchSource: string;
  };
  readonly events: {
    moduleLoaded: string;
    moduleUnloaded: string;
  };
  constructor(ctx: {
    app: App;
    __addModule__: Context['__addModule__'];
    __getModule__: Context['__getModule__'];
    dispatch: Dispatch<Events>;
    translate: Translate<Translations>;
    allModules: Set<General$1>;
    isIdle: Ref<boolean>;
    saveSettings: () => Promise<void>;
    indexedDB: DatabaseAsync<Record<string, AugmentedModuleMeta>>;
  });
  readonly start: () => void;
  private readonly createOperationFactory;
  private readonly loadAllModules;
  private readonly loadModule;
  private readonly unloadModule;
  private readonly downloadModule;
  private readonly deleteModule;
  private readonly fetchSources;
  private readonly updateModules;
  private readonly updateModuleMeta;
  private readonly enableModule;
  private readonly disableModule;
  private readonly getModulePath;
  private readonly parseModulePath;
  readonly dispose: () => void;
  readonly root: {
    deleteModule: (id: string) => Promise<void>;
    disableModule: (id: string) => void;
    discoveredModules: Map<string, AugmentedModuleMeta>;
    downloadModule: (meta: AugmentedModuleMeta, waitIdle?: boolean) => Promise<void>;
    enableModule: (id: string) => Promise<void>;
    fetchSources: (manual?: boolean) => Promise<AugmentedModuleMeta[]>;
    loadAllModules: () => Promise<void>;
    loadModule: (meta: AugmentedModuleMeta, start?: boolean, module?: string) => Promise<void>;
    loadedModules: Map<string, ModuleCtor>;
    unloadModule: (id: string) => void;
    updateModuleMeta: (meta: AugmentedModuleMeta) => Promise<void>;
    updateModules: () => Promise<void>;
  };
}
//#endregion
//#region src/components/ModuleEditorModal.d.ts
type ModuleEditorTranslations = {
  editModuleInformation: string;
  enable: string;
  name: string;
  namePlaceholder: string;
  description: string;
  descriptionPlaceholder: string;
  icon: string;
  iconDescription: Fragment;
  iconPlaceholder: string;
  updateSource: string;
  updateSourceDescription: string;
  updateSourcePlaceholder: string;
  invalidValue: string;
  integrityVerification: string;
  integrityVerificationDescription: Fragment;
  save: string;
  cancel: string;
};
//#endregion
//#region src/components/UnknownModuleModal.d.ts
type FileInfo = {
  path: string;
  size: string;
  mtime: string;
  ctime: string;
  fileName: string;
};
type UnknownModuleTranslations = {
  unknownModule: string;
  unknownModuleDescription: Fragment<FileInfo>;
  delete: string;
  configure: string;
};
//#endregion
//#region src/settings/controls.d.ts
type ControlsSettingTranslations = {
  controls: string;
  maxFileSize: string;
  maxFileSizeDescription: string;
  maxFileSizePlaceholder: string;
  maxRequestConcurrency: string;
  minRequestInterval: string;
  minRequestIntervalDescription: string;
  minRequestIntervalPlaceholder: string;
  maxRequestConcurrencyPlaceholder: string;
  maxRequestConcurrencyDescription: string;
  maxMemoryConsumption: string;
  maxMemoryConsumptionDescription: string;
  maxMemoryConsumptionPlaceholder: string;
  invalidValue: string;
};
//#endregion
//#region src/settings/development.d.ts
type DevelopmentSettingTranslations = {
  development: string;
  clearRecords: string;
  recordsCleared: string;
  clear: string;
  clearRecordsDescription: string;
  export: string;
  exportLogsDescription: string;
  exportLogsToFile: string;
};
//#endregion
//#region src/settings/features.d.ts
type FeaturesSettingTranslations = {
  features: string;
  realtimeSyncFastMode: string;
  realtimeSyncFastModeDescription: string;
  realtimeSync: string;
  realtimeSyncDescription: string;
  realtimeSyncPlaceholder: string;
  startupSync: string;
  startupSyncDescription: string;
  startupSyncPlaceholder: string;
  scheduledSync: string;
  scheduledSyncDescription: string;
  scheduledSyncPlaceholder: string;
  asymmetricStorage: string;
  asymmetricStorageDescription: Fragment;
  asymmetricStorageMigration: Fragment<'enable' | 'disable'>;
  invalidValue: string;
} & MigrationModalTranslations;
//#endregion
//#region src/components/FilterEditorModal.d.ts
type FilterEditorTranslations = {
  cancel: string;
  remove: string;
  save: string;
  add: string;
  inclusionRules: string;
  exclusionRules: string;
  inclusionRulesDescription: string;
  exclusionRulesDescription: string;
  filterPlaceholder: string;
};
//#endregion
//#region src/settings/filter.d.ts
type FilterSettingTranslations = {
  filterRules: string;
  edit: string;
} & FilterEditorTranslations;
//#endregion
//#region src/settings/head.d.ts
type HeadSettingTranslations = {
  moduleAutoUpdate: string;
  moduleAutoUpdateDescription: string;
  moduleManagement: string;
  moduleManagementDescription: string;
  openPanel: string;
  backend: string;
  backendDescription: string;
  syncStrategy: string;
  syncStrategyDescription: string;
  checkConnectionFailed: string;
  checkConnectionSuccess: string;
  checkConnection: string;
  conflictResolveStrategy: string;
  conflictResolveStrategyDescription: string;
};
//#endregion
//#region src/settings/miscellaneous.d.ts
type MiscellaneousSettingTranslations = {
  miscellaneous: string;
  diffMatchPatch: string;
  keepLocal: string;
  keepRemote: string;
  skip: string;
  noticeStatusOnMobile: string;
  noticeStatusOnMobileDescription: string;
  confirmTasksInSync: string;
  confirmTasksInSyncDescription: string;
  confirmDeleteInAutoSync: string;
  confirmDeleteInAutoSyncDescription: string;
  customHeaders: string;
  customHeadersDescription: string;
  edit: string;
};
//#endregion
//#region src/modules/Bootstrap.d.ts
type CustomHeaders = Array<{
  type: 'plaintext' | 'secret';
  value: string;
  key: string;
}>;
type ExistingMemoryDB = DatabaseSync<{
  localContext20000: Stat$1;
  remoteContext10000: Stat$1;
  remoteContext20000: Stat$1;
}, {
  localContext20000Marker: string;
  remoteContext10000Marker: string;
  remoteContext20000Marker: string;
}>;
declare class Bootstrap {
  private readonly ctx;
  private readonly cleanupCallbacks;
  private readonly memoryStates;
  private isCancelled?;
  private readonly localPool;
  private readonly remotePool;
  private localFs?;
  private remoteFs?;
  readonly i18n: {
    bidirectional: string;
    latestSurvive: string;
    keepLocal: string;
    keepRemote: string;
    renameAndKeepBoth: string;
    skip: string;
  } & ControlsSettingTranslations & DevelopmentSettingTranslations & FeaturesSettingTranslations & FilterSettingTranslations & HeadSettingTranslations & MiscellaneousSettingTranslations & HeadersEditorTranslations & UnknownModuleTranslations & ModuleEditorTranslations & FileTreeTranslations;
  readonly settings: {
    maxMemoryConsumption: TogglableValue;
    maxRequestConcurrency: TogglableValue;
    minRequestInterval: TogglableValue;
    realtimeSyncFastMode: boolean;
    asymmetricStorage: boolean;
    customHeaders: CustomHeaders;
  };
  constructor(ctx: {
    app: App;
    registerI18n: (code: ObsidianLanguageCode, resource: TranslationResource) => void;
    on: On<Events>;
    dispatch: Dispatch<Events>;
    memoryDB: ExistingMemoryDB;
    registerDecider: (id: string, entry: DeciderEntry) => void;
    registerLocalFsWrapper: (entry: FsWrapperEntry) => void;
    registerRemoteFs: (id: string, entry: RemoteFsEntry) => void;
    registerRemoteFsWrapper: (entry: FsWrapperEntry) => void;
    translate: Translate<Translations>;
    optimizeLocal: BatchOptimizer;
    optimizeRemote: BatchOptimizer;
    registerLocalOptimizer: (optimizer: OptimizerEntry) => void;
    registerRemoteOptimizer: (optimizer: OptimizerEntry) => void;
    registerRemoteLister: (entry: RemoteListerEntry) => () => boolean;
    registerSetting: (entry: SettingEntry) => () => boolean;
    registerConflictResolver: (id: string, entry: ConflictResolverEntry) => void;
    registerRemoteRequestMiddleware: (entry: RemoteRequestMiddlewareEntry) => void;
    registerLocalRequestMiddleware: (entry: LocalRequestMiddlewareEntry) => void;
  });
  readonly start: () => void;
  readonly dispose: () => void;
}
//#endregion
//#region src/components/module-management/index.d.ts
type ModuleManagementTranslations = {
  disableModule: string;
  disabled: string;
  downloadModule: string;
  enableModule: string;
  enabled: string;
  installed: string;
  loadingModules: string;
  noInstalledModulesFound: string;
  noMatchingModulesFound: string;
  noModulesAvailable: string;
  notInstalled: string;
  updateAvailable: string;
  updateModule: string;
  deleteModule: string;
  editModuleInformation: string;
};
//#endregion
//#region src/components/SourceEditorModal.d.ts
type SourceEditorTranslations = {
  add: string;
  cancel: string;
  editSources: string;
  omittedInvalidEntry: string;
  moduleSourcePlaceholder: string;
  remove: string;
  save: string;
  sourcesDescription: string;
  httpInsecureWarning: string;
};
//#endregion
//#region src/modules/ModulesModal.d.ts
type ModulesModalTranslations = ModuleManagementTranslations & SourceEditorTranslations & {
  searchModules: string;
  editSources: string;
  moduleManagement: string;
  showInstalledOnly: string;
  configurations: string;
};
declare class ModulesModal extends Modal {
  private readonly ctx;
  private readonly t;
  private readonly modalCleanup;
  private sourceEditorModal?;
  private showInstalledOnly;
  constructor(ctx: {
    app: App;
    translate: Translate<ModulesModalTranslations>;
    saveSettings: () => Promise<void>;
    fetchSources: (manual?: boolean) => Promise<Array<AugmentedModuleMeta>>;
    discoveredModules: Map<string, AugmentedModuleMeta>;
    loadedModules: Map<string, unknown>;
    downloadModule: (meta: AugmentedModuleMeta) => Promise<void>;
    deleteModule: (id: string) => Promise<void>;
    loadModule: (meta: AugmentedModuleMeta, start?: boolean) => Promise<void>;
    unloadModule: (id: string) => void;
    enableModule: (id: string) => Promise<void>;
    disableModule: (id: string) => void;
    updateModuleMeta: (meta: AugmentedModuleMeta) => Promise<void>;
  });
  readonly i18n: ModulesModalTranslations;
  readonly settings: {
    moduleSources: Array<string>;
  };
  root: {
    closeModuleManagement: () => void;
    openModuleManagement: () => void;
  };
  onOpen(): void;
  onClose(): void;
  private readonly openSourceEditorModal;
  dispose(): void;
}
//#endregion
//#region src/modules/ProgressModal.d.ts
type DeleteConfirmReturn = {
  delete: Array<RemoveLocal>;
  reupload: Array<RemoveLocal>;
};
declare class ProgressModal extends Modal {
  private readonly ctx;
  private readonly moduleCleanupCallbacks;
  private readonly t;
  private opening;
  private readonly modalCleanupCallbacks;
  private readonly dispatch;
  private description?;
  private detailContainer?;
  private controls?;
  constructor(ctx: {
    app: App;
    translate: Translate<Translations>;
    on: On<Events>;
    dispatch: Dispatch<Events>;
    syncStage: Ref<SyncStage>;
    walkProgress: Ref<Progress>;
    executionProgress: Ref<Progress<TaskInfo>>;
  });
  readonly events: {
    tasksConfirmed: Array<BaseTask>;
    deleteConfirmed: DeleteConfirmReturn;
  };
  readonly i18n: {
    syncProgress: string;
    completed: string;
    failedTasksDescription: string;
    confirmDeleteDescription: string;
    confirmTasksDescription: string;
    hide: string;
    confirm: string;
    cancel: string;
    done: string;
    stopSync: string;
  } & Record<TaskNames | SyncStage, string>;
  private readonly renderHideStop;
  private readonly renderConfirmCancel;
  private readonly renderDone;
  private readonly showDetails;
  private readonly hideDetails;
  onOpen(): void;
  root: {
    hideProgress: () => void;
    showProgress: () => void;
  };
  onClose(): void;
  dispose(): void;
}
//#endregion
//#region src/modules/Scheduler.d.ts
declare class Scheduler {
  private readonly ctx;
  private readonly pendingRequests;
  private isScheduling;
  private realtimeSyncTimer?;
  private scheduledSyncTimer?;
  private startupSyncTimer?;
  constructor(ctx: {
    syncStage: Ref<SyncStage>;
    executeSync: (trigger: string) => Promise<SyncTerminateReason>;
    registerEvent: (ref: EventRef) => void;
    app: App;
    isIdle: Ref<boolean>;
  });
  settings: {
    startupSync: TogglableValue;
    scheduledSync: TogglableValue;
    realtimeSync: TogglableValue;
    exclusionRules: Array<GlobMatchRule>;
    inclusionRules: Array<GlobMatchRule>;
  };
  private readonly requestSync;
  start: () => void;
  dispose: () => void;
  private readonly startScheduledSync;
  private readonly stopScheduledSync;
  private readonly onChange;
  private readonly scheduleFlush;
  private readonly flush;
  root: {
    requestSync: (trigger: string) => Promise<SyncTerminateReason>;
    startScheduledSync: () => void;
    stopScheduledSync: () => void;
  };
}
//#endregion
//#region src/index.d.ts
declare const internalModules: readonly [typeof EventBus, typeof I18n, typeof Storage, typeof Extensibility, typeof Registrar, typeof Sync, typeof Observability, typeof Scheduler, typeof ProgressModal, typeof ModulesModal, typeof Bootstrap];
type InternalModules = typeof internalModules;
type MergeKeys = 'settings' | 'root' | 'events' | 'i18n';
type Context = Context$1<InternalModules, MergeKeys, {
  app: App;
  addCommand: (command: Command) => Command;
  registerEvent: (ref: EventRef) => void;
  addRibbonIcon: AddRibbonIcon;
  addStatusBarItem: () => HTMLElement;
  saveSettings: () => Promise<void>;
}>;
type Events = MergeSingleKey<InternalModules, 'events'>;
type Settings = MergeSingleKey<InternalModules, 'settings'>;
type Translations = MergeSingleKey<InternalModules, 'i18n'>;
//#endregion
//#region src/modules/Registrar.d.ts
type RejectableWrapper<T> = (value: T) => T | undefined;
type OrderedWrapperEntry<T> = {
  priority: number;
  apply: RejectableWrapper<T>;
};
type RemoteRequestMiddlewareEntry = OrderedWrapperEntry<Request>;
type LocalRequestMiddlewareEntry = OrderedWrapperEntry<VaultRequest>;
type FsWrapperEntry = OrderedWrapperEntry<Fs>;
type CheckConnectionResult = {
  success: true;
} | {
  success: false;
  reason: string;
};
type RemoteFsEntry = {
  instantiate: (request: Request) => RootFs;
  prettyName: () => string;
  checkConnection: (request: Request) => MaybePromise<CheckConnectionResult>;
};
type DeciderEntry = {
  decider: Decider;
  prettyName: () => string;
};
type ConflictResolverEntry = {
  prettyName: () => string;
  resolver: ConflictResolver;
};
type GeneralFn = (...args: ReadonlyArray<General$1>) => unknown;
type RejectableApply<F extends GeneralFn> = (...input: Parameters<F>) => ReturnType<F> | undefined;
type OrderedApplyEntry<F extends GeneralFn> = {
  apply: RejectableApply<F>;
  priority: number;
};
type RemoteLister = (info: Infras & {
  trigger: string;
  reporter: ListReporter;
}) => MaybePromise<Array<Stat$1>>;
type RemoteListerEntry = OrderedApplyEntry<RemoteLister>;
type OptimizerEntry = OrderedApplyEntry<BatchOptimizer>;
type SettingEntry = {
  priority: number;
  apply: (el: HTMLElement) => void;
};
type RequestParam = Omit<RequestUrlParam, 'body'> & {
  body?: string | Binary;
};
type RequestResponse = {
  text: () => string;
  bytes: () => Binary;
  json: () => General$1;
  headers: Record<string, string>;
  status: number;
};
type Request = (params: RequestParam | string) => Promise<RequestResponse>;
type Infras = {
  localFs: Fs;
  remoteFs: Fs;
  record: RecordStore;
};
declare class Registrar {
  private readonly ctx;
  private settingTab?;
  private readonly cleanupCallbacks;
  private readonly localFsWrapperRegistry;
  private readonly remoteFsWrapperRegistry;
  private readonly localOptimizerRegistry;
  private readonly remoteOptimizerRegistry;
  private readonly remoteListerRegistry;
  private readonly settingRegistry;
  private readonly remoteRequestMiddlewareRegistry;
  private readonly localRequestMiddlewareRegistry;
  private readonly remoteFsRegistry;
  private readonly deciderRegistry;
  private readonly conflictResolverRegistry;
  readonly settings: {
    remoteFs: string;
    decider: string;
    conflictResolver: string;
  };
  constructor(ctx: {
    app: App;
    on: On<Events>;
    getRecordStore: (namespace?: string) => StoreAsync<RecordStat>;
  });
  private readonly getVaultRequest;
  private readonly createLocalFs;
  private readonly createRemoteFs;
  private readonly getRequest;
  private readonly getCheckConnection;
  private readonly getDecider;
  private readonly optimizeLocal;
  private readonly optimizeRemote;
  private readonly listRemote;
  private readonly getConflictResolver;
  private readonly getNamespace;
  private readonly initializeSync;
  private readonly addSettingTab;
  private readonly rerenderSettingTab;
  root: {
    addSettingTab: (plugin: Plugin) => void;
    conflictResolverRegistry: Map<string, ConflictResolverEntry>;
    createLocalFs: () => Fs;
    createRemoteFs: (remoteFs?: string) => RootFs;
    deciderRegistry: Map<string, DeciderEntry>;
    getCheckConnection: (remoteFs?: string) => () => MaybePromise<CheckConnectionResult>;
    getConflictResolver: () => ConflictResolver;
    getDecider: () => Decider;
    getNamespace: (localFs?: Fs, remoteFs?: Fs) => string;
    getRequest: () => Request;
    getVaultRequest: () => VaultRequest;
    initializeSync: () => Infras;
    listRemote: RemoteLister;
    optimizeLocal: BatchOptimizer;
    optimizeRemote: BatchOptimizer;
    registerConflictResolver: (key: string, entry: ConflictResolverEntry) => () => boolean;
    registerCss: (css: string) => () => void;
    registerDecider: (key: string, entry: DeciderEntry) => () => boolean;
    registerLocalFsWrapper: (entry: FsWrapperEntry) => () => boolean;
    registerLocalOptimizer: (entry: OptimizerEntry) => () => boolean;
    registerLocalRequestMiddleware: (entry: LocalRequestMiddlewareEntry) => () => boolean;
    registerRemoteFs: (key: string, entry: RemoteFsEntry) => () => boolean;
    registerRemoteFsWrapper: (entry: FsWrapperEntry) => () => boolean;
    registerRemoteLister: (entry: RemoteListerEntry) => () => boolean;
    registerRemoteOptimizer: (entry: OptimizerEntry) => () => boolean;
    registerRemoteRequestMiddleware: (entry: RemoteRequestMiddlewareEntry) => () => boolean;
    registerSetting: (entry: SettingEntry) => () => boolean;
    remoteFsRegistry: Map<string, RemoteFsEntry>;
    rerenderSettingTab: () => void | undefined;
  };
  readonly dispose: () => void;
}
//#endregion
//#region src/fs/vault/request.d.ts
type VaultRequestParam = {
  method: 'GET';
  key: string;
} | {
  method: 'GET_STREAM';
  key: string;
} | {
  method: 'PUT';
  key: string;
  value: Binary;
  headers?: {
    mtime?: number;
    ctime?: number;
  };
} | {
  method: 'APPEND';
  key: string;
  value: Binary;
  headers?: {
    mtime?: number;
    ctime?: number;
  };
} | {
  method: 'DELETE';
  key: string;
  headers?: {
    permanent?: boolean;
  };
} | {
  method: 'MOVE';
  key: string;
  headers: {
    destination: string;
  };
} | {
  method: 'MKDIR';
  key: string;
} | {
  method: 'EXISTS';
  key: string;
} | {
  method: 'STAT';
  key: string;
  headers?: {
    cached?: boolean;
  };
} | {
  method: 'LIST';
  key: string;
  headers?: {
    cached?: boolean;
  };
};
type VaultRequestResponseMap = {
  GET: Binary;
  GET_STREAM: ReadableStream<Binary>;
  PUT: void;
  APPEND: void;
  DELETE: void;
  MOVE: void;
  MKDIR: void;
  EXISTS: boolean;
  STAT: Stat;
  LIST: ListedFiles;
};
type VaultRequest = <T extends VaultRequestParam>(params: T) => Promise<VaultRequestResponseMap[T['method']]>;
//#endregion
export { TranslationResource as $, SyncTerminateReason as A, MoveRemote as B, SelectFromContext as C, FolderStat as Ct, writeWithValue as D, RecordStatsMap as Dt, readWithSize as E, RecordStat as Et, Upload as F, BaseTask as G, Download as H, ResolveConflict as I, TaskNames as J, ConflictResolver as K, RemoveRemote as L, Decider as M, DeciderInput as N, prefixWrapper as O, Stat$1 as Ot, TaskFactory as P, Translate as Q, RemoveRecord as R, ModuleMeta as S, FileStat as St, pipe as T, Progress as Tt, CreateRemoteDir as U, MoveLocal as V, AddRecord as W, Fragment as X, RecordStore as Y, ObsidianLanguageCode as Z, Events as _, OutputAtom as _t, FsWrapperEntry as a, StoreOperations as at, ExistingMemoryDB as b, WriteAtom as bt, RemoteFsEntry as c, CustomAtom as ct, RemoteRequestMiddlewareEntry as d, InputAtom as dt, Dispatch as et, Request as f, ListReporter as ft, Context as g, OptimizerOutput as gt, SettingEntry as h, OptimizerInput as ht, DeciderEntry as i, StoreAsync as it, CreateLocalDir as j, setNeedMigration as k, StatsMap as kt, RemoteLister as l, DeleteAtom as lt, RequestResponse as m, MoveAtom as mt, CheckConnectionResult as n, DatabaseAsync as nt, LocalRequestMiddlewareEntry as o, StoreSync as ot, RequestParam as p, MkdirAtom as pt, ConflictResolverPayload as q, ConflictResolverEntry as r, DatabaseSync as rt, OptimizerEntry as s, BatchOptimizer as st, VaultRequest as t, On as tt, RemoteListerEntry as u, Fs as ut, Settings as v, RootFs as vt, digOriginal as w, MaybePromise as wt, AugmentedModuleMeta as x, Binary as xt, Translations as y, WrappedFs as yt, RemoveLocal as z };