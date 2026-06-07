export type TraversalProgress = {
	processedDirectories: number;
	totalDirectories: number;
	currentDirectory?: string;
};

export type OnProgress = (progress: TraversalProgress) => void;
