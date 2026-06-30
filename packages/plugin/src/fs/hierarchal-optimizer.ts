import { isSub } from '@repo/shared';
import type { OptimizerInput, RemoteFs, LocalFs, InputAtom } from './interface';

type Fs = RemoteFs | LocalFs;

export default function hierarchalOptimizer({ atoms, executeAtom }: OptimizerInput<Fs>) {
	// Extract relevant paths based on atom type
	const getPaths = (atom: InputAtom): { read?: string; write?: string } => {
		switch (atom.type) {
			case 'write': {
				return { write: atom.key };
			}
			case 'mkdir': {
				return { write: atom.key };
			}
			case 'delete': {
				return { read: atom.key };
			}
			case 'move': {
				return { read: atom.oldKey, write: atom.newKey };
			}
		}
	};

	const dependencies = new Map<InputAtom, Set<InputAtom>>();
	const umbrellas = new Map<InputAtom, InputAtom>();
	for (const atom of atoms) dependencies.set(atom, new Set());
	const writePathsMap = new Map<string, InputAtom>();
	for (const atom of atoms) {
		const paths = getPaths(atom);
		if (paths.write) writePathsMap.set(paths.write, atom);
	}

	// 1. Rule: Parent Directory Creation
	// Any operation that creates a path must wait for the deepest ancestor directory being created in this batch.
	for (const A of atoms) {
		const pathsA = getPaths(A);
		if (pathsA.write) {
			let currentPath = pathsA.write;
			while (true) {
				// Walk up the tree
				const pathToCheck = currentPath.endsWith('/')
					? currentPath.slice(0, -1)
					: currentPath;
				const slashIdx = pathToCheck.lastIndexOf('/');
				currentPath = slashIdx === -1 ? '/' : pathToCheck.substring(0, slashIdx + 1);
				if (currentPath === '/') break; // Reached root
				const creator = writePathsMap.get(currentPath);
				if (creator && creator !== A) {
					dependencies.get(A)!.add(creator);
					break; // Found the shallowest created ancestor, transitive dependencies handle the rest
				}
			}
		}
	}

	// 2. Rule: Rename Sequencing & Namespace Clearance
	for (const A of atoms) {
		const pathsA = getPaths(A);
		for (const B of atoms) {
			if (A === B) continue;
			const pathsB = getPaths(B);
			// Rename Sequencing
			if (B.type === 'move') {
				// Pre-Rename: Operations on descendants of the source must happen before the move
				if (pathsA.read && isSub(pathsA.read, B.oldKey)) dependencies.get(B)!.add(A);
				if (pathsA.write && isSub(pathsA.write, B.oldKey)) dependencies.get(B)!.add(A);
				// Post-Rename: Operations on descendants of the target must happen after the move
				if (pathsA.read && isSub(pathsA.read, B.newKey)) dependencies.get(A)!.add(B);
				if (pathsA.write && isSub(pathsA.write, B.newKey)) dependencies.get(A)!.add(B);
			}
			// Namespace Clearance (File vs Folder name collisions)
			if (A.type === 'delete' && pathsB.write)
				if (`${pathsA.read}/` === pathsB.write || `${pathsB.write}/` === pathsA.read)
					dependencies.get(B)!.add(A);
			if (B.type === 'delete' && pathsA.write)
				if (`${pathsB.read}/` === pathsA.write || `${pathsA.write}/` === pathsB.read)
					dependencies.get(A)!.add(B);
		}
		// Umbrella Subsumption: Redundant Descendant Deletions
		if (A.type === 'delete') {
			let currentUmbrella: InputAtom | undefined;
			let maxDepth = -1;
			for (const B of atoms)
				if (B.type === 'delete' && B !== A)
					if (isSub(A.key, B.key)) {
						const depth = B.key.split('/').length;
						if (depth > maxDepth) {
							maxDepth = depth;
							currentUmbrella = B;
						}
					}
			if (currentUmbrella) umbrellas.set(A, currentUmbrella);
		}
	}

	// 3. Orchestration & Wrapping
	for (const atom of atoms) {
		const originalExecute = atom.execute;
		const umbrella = umbrellas.get(atom);
		const deps = dependencies.get(atom) || new Set();
		atom.execute = (async () => {
			if (umbrella) {
				await executeAtom(umbrella);
				return;
			}
			if (deps.size > 0) await Promise.all([...deps].map((dep) => executeAtom(dep)));
			return originalExecute();
		}) as never;
	}

	return atoms;
}
