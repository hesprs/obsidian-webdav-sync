import { diff3Merge, diffComm } from 'node-diff3';

/**
 * https://github.com/bhousel/node-diff3/blob/39c04c024620d3971010abf4ba3e2cbdba2f3f81/index.mjs#L464
 */
export function mergeDigIn(
	a: string[] | string,
	o: string[] | string,
	b: string[] | string,
	_options: {
		excludeFalseConflicts?: boolean;
		stringSeparator?: string | RegExp;
		useGitStyle?: boolean;
	},
) {
	const options = {
		excludeFalseConflicts: true,
		stringSeparator: /\s+/,
		label: {},
		useGitStyle: false,
		..._options,
	};

	const aSection = options.useGitStyle ? '<<<<<<<' : `<mark class="conflict ours">`;
	const xSection = options.useGitStyle ? '=======' : '</mark><mark class="conflict theirs">';
	const bSection = options.useGitStyle ? '>>>>>>>' : `</mark>`;

	const regions = diff3Merge(a, o, b, options);
	let conflict = false;
	let result: string[] = [];

	regions.forEach((region) => {
		if (region.ok) result = result.concat(region.ok);
		else {
			const c = diffComm(region.conflict?.a as string[], region.conflict?.b as string[]);
			for (let j = 0; j < c.length; j++) {
				const inner = c[j];
				conflict = true;
				result = result.concat([aSection], inner.buffer1, [xSection], inner.buffer2, [
					bSection,
				]);
			}
		}
	});

	return {
		conflict: conflict,
		result: result,
	};
}
