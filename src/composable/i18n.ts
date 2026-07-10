type Primitive = string | number | boolean | null | undefined;
type InterpolationValues = Record<string, Primitive>;

type Fragment = (frag: DocumentFragment) => void;
type StringTree = { [key: string]: string | Fragment | StringTree };
type Leaf = string | Fragment;
type PathKeys<T, Prefix extends string = ''> = [T] extends [Leaf | undefined | null]
	? Prefix
	: [T] extends [Record<string, any>]
		? {
				[K in keyof T & string]: PathKeys<
					NonNullable<T[K]>,
					Prefix extends '' ? K : `${Prefix}.${K}`
				>;
			}[keyof T & string]
		: never;
type PathValue<T, Path extends string, Optional extends boolean = false> = Path extends keyof T
	? Optional extends true
		? T[Path] | undefined
		: T[Path]
	: Path extends `${infer Head}.${infer Tail}`
		? Head extends keyof T
			? undefined extends T[Head]
				? PathValue<NonNullable<T[Head]>, Tail, true>
				: PathValue<NonNullable<T[Head]>, Tail, Optional>
			: never
		: never;
type FlattenTree<T> = { [K in PathKeys<T>]: PathValue<T, K> };

type Resources<TranslationShape extends StringTree> = Record<string, TranslationShape>;
type CreateI18nOptions<
	TranslationShape extends StringTree,
	T extends Resources<TranslationShape>,
> = {
	resources: T;
	current: keyof T;
};

export default function createI18n<TranslationShape extends StringTree>(
	options: CreateI18nOptions<TranslationShape, Resources<TranslationShape>>,
) {
	type Flattened = FlattenTree<TranslationShape>;
	type Languages = keyof Resources<TranslationShape>;
	function getValue(resource: TranslationShape, key: string) {
		const value = key
			.split('.')
			.reduce<StringTree | string | Fragment>(
				(current, segment) => (current as StringTree)[segment],
				resource,
			);
		return value as string | Fragment;
	}
	return {
		changeLanguage: (language: Languages) => {
			options.current = language;
		},
		translation: <K extends keyof Flattened>(
			key: K,
			params?: InterpolationValues,
		): Flattened[K] extends string ? string : DocumentFragment => {
			const template = getValue(options.resources[options.current], key);
			if (typeof template === 'string') return interpolate(template, params) as never;
			return createFragment(template) as never;
		},
	};
}

function interpolate(template: string, params?: InterpolationValues): string {
	if (params === undefined) return template;
	return template.replace(/\{\{\s*(?<key>[^{}\s]+)\s*\}\}/g, (match, key: string) => {
		const value = params[key];
		return value === undefined ? match : String(value);
	});
}
