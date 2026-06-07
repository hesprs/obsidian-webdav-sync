export * from './sync-run';

type RefMatchingFunc<T> = (newValue: T, oldValue: T) => void;

export type Ref<T> = {
	(): T;
	(newValue: T): void;
	value: T;
	subs: Set<RefMatchingFunc<T>>;
	subscribe: (func: RefMatchingFunc<T>) => () => void;
	unsubscribe: (func: RefMatchingFunc<T>) => void;
};

export function ref<T>(initial: T): Ref<T> {
	const result: Ref<T> = ((newValue?: T) => {
		if (newValue === undefined) return result.value;
		const oldValue = result.value;
		if (newValue === oldValue) return;
		result.value = newValue;
		for (const callback of result.subs) callback(newValue, oldValue);
	}) as Ref<T>;
	result.subs = new Set();
	result.value = initial;
	result.subscribe = (callback: RefMatchingFunc<T>) => {
		result.subs.add(callback);
		return () => result.unsubscribe(callback);
	};
	result.unsubscribe = (callback: RefMatchingFunc<T>) => {
		result.subs.delete(callback);
	};
	return result;
}

type HookMatchingFunc<Args extends GeneralArray> = (...args: Args) => void;
export type GeneralArray = ReadonlyArray<unknown>;
export type Hook<Args extends GeneralArray = []> = {
	(...args: Args): void;
	subs: Set<HookMatchingFunc<Args>>;
	subscribe: (callback: HookMatchingFunc<Args>) => () => void;
	unsubscribe: (callback: HookMatchingFunc<Args>) => void;
};

export function hook<Args extends GeneralArray = []>(): Hook<Args> {
	const result: Hook<Args> = (...args: Args) => {
		for (const callback of result.subs) callback(...args);
	};
	result.subs = new Set();
	result.subscribe = (callback: HookMatchingFunc<Args>) => {
		result.subs.add(callback);
		return () => result.unsubscribe(callback);
	};
	result.unsubscribe = (callback: HookMatchingFunc<Args>) => {
		result.subs.delete(callback);
	};
	return result;
}
