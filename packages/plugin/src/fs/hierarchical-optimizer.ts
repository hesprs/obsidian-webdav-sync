import { dirname, isSub } from '@repo/shared/path';
import type { DeleteAtom, InputAtom, MoveAtom, OptimizerInput } from './interface';

type Paths = { read?: string; write?: string };
type Subsumable = DeleteAtom | MoveAtom;

function pathsOf(atom: InputAtom): Paths {
	if (atom.type === 'delete') return { read: atom.key };
	if (atom.type === 'move') return { read: atom.oldKey, write: atom.newKey };
	return { write: atom.key };
}

function isSubsumable(atom: InputAtom): atom is Subsumable {
	return atom.type === 'delete' || atom.type === 'move';
}

export default function hierarchicalOptimizer({ atoms, executeAtom }: OptimizerInput) {
	const dependencies = new Map(atoms.map((atom) => [atom, new Set<InputAtom>()]));
	const umbrellas = new Map<Subsumable, Subsumable>();

	for (const atom of atoms)
		if (atom.type === 'move') {
			let umbrella: MoveAtom | undefined;
			for (const candidate of atoms) {
				if (
					candidate.type !== 'move' ||
					!isSub(candidate.oldKey, atom.oldKey) ||
					atom.newKey !==
						`${candidate.newKey}${atom.oldKey.slice(candidate.oldKey.length)}`
				)
					continue;
				if (!umbrella || candidate.oldKey.length < umbrella.oldKey.length)
					umbrella = candidate;
			}
			if (umbrella) umbrellas.set(atom, umbrella);
		} else if (atom.type === 'delete') {
			let umbrella: DeleteAtom | undefined;
			for (const candidate of atoms) {
				if (
					candidate.type !== 'delete' ||
					!isSub(candidate.key, atom.key) ||
					(umbrella && candidate.key.length <= umbrella.key.length)
				)
					continue;
				umbrella = candidate;
			}
			if (umbrella) umbrellas.set(atom, umbrella);
		}

	const creators = new Map<string, InputAtom>();
	for (const atom of atoms) {
		const { write } = pathsOf(atom);
		if (write) creators.set(write, atom);
	}
	for (const atom of atoms) {
		const { write } = pathsOf(atom);
		if (!write) continue;
		for (let parent = dirname(write); parent !== '/'; parent = dirname(parent)) {
			const creator = creators.get(parent);
			if (!creator || creator === atom) continue;
			dependencies.get(atom)?.add(creator);
			break;
		}
	}

	for (const move of atoms) {
		if (move.type !== 'move' || umbrellas.has(move)) continue;
		for (const atom of atoms) {
			if (atom === move || (isSubsumable(atom) && umbrellas.has(atom))) continue;
			const { read, write } = pathsOf(atom);
			if ((read && isSub(move.newKey, read)) || (write && isSub(move.newKey, write)))
				dependencies.get(atom)?.add(move);
		}
	}

	for (const deletion of atoms) {
		if (deletion.type !== 'delete') continue;
		for (const atom of atoms) {
			const { write } = pathsOf(atom);
			if (write && (`${deletion.key}/` === write || `${write}/` === deletion.key))
				dependencies.get(atom)?.add(deletion);
		}
	}

	for (const atom of atoms) {
		const originalExecute = atom.execute;
		atom.execute = (async () => {
			if (isSubsumable(atom)) {
				const umbrella = umbrellas.get(atom);
				if (umbrella) {
					await executeAtom(umbrella);
					atom.resolve();
					return;
				}
			}
			await Promise.all(
				[...(dependencies.get(atom) as Set<InputAtom>)].map((dependency) =>
					executeAtom(dependency),
				),
			);
			return originalExecute();
		}) as never;
	}

	return atoms;
}
