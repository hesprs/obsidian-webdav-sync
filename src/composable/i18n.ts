type Primitive = string | number | boolean | null | undefined;
type InterpolationValues = Record<string, Primitive>;

type KeyOfObject<T, P extends string = ''> = T extends object
	? {
			[K in keyof T]: K extends string
				? T[K] extends object
					? KeyOfObject<T[K], `${P}${K}.`>
					: `${P}${K}`
				: never;
		}[keyof T]
	: never;

type StringTree = { [key: string]: string | StringTree };
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
	type Languages = keyof Resources<TranslationShape>;
	type TranslationKey = KeyOfObject<TranslationShape>;
	function getValue(resource: TranslationShape, key: string) {
		const value = key
			.split('.')
			.reduce<StringTree | string>(
				(current, segment) => (current as StringTree)[segment],
				resource,
			);
		return value as string;
	}
	return {
		changeLanguage: (language: Languages) => {
			options.current = language;
		},
		translation: (key: TranslationKey, params?: InterpolationValues): string => {
			const template = getValue(options.resources[options.current], key);
			return interpolate(template, params);
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
