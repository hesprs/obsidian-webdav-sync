import { diff3Merge, diffComm } from 'node-diff3';

/**
 * https://github.com/bhousel/node-diff3/blob/39c04c024620d3971010abf4ba3e2cbdba2f3f81/index.mjs#L464
 */
export default function mergeDigIn(
	a: Array<string> | string,
	o: Array<string> | string,
	b: Array<string> | string,
	_options: {
		excludeFalseConflicts?: boolean;
		stringSeparator?: string | RegExp;
		useGitStyle?: boolean;
	},
) {
	const options = {
		excludeFalseConflicts: true,
		label: {},
		stringSeparator: /\s+/,
		useGitStyle: false,
		..._options,
	};

	const aSection = options.useGitStyle ? '<<<<<<<' : `<mark class="conflict ours">`;
	const xSection = options.useGitStyle ? '=======' : '</mark><mark class="conflict theirs">';
	const bSection = options.useGitStyle ? '>>>>>>>' : `</mark>`;

	const regions = diff3Merge(a, o, b, options);
	let conflict = false;
	const result: Array<string> = [];

	regions.forEach((region) => {
		if (region.ok) result.push(...region.ok);
		else {
			const c = diffComm(
				region.conflict?.a as Array<string>,
				region.conflict?.b as Array<string>,
			);

			for (const inner of c)
				if (inner.common) result.push(...inner.common);
				else {
					conflict = true;
					result.push(aSection, ...inner.buffer1, xSection, ...inner.buffer2, bSection);
				}
		}
	});

	return {
		conflict,
		result,
	};
}
