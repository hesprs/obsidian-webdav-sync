export type CreateWebDAVReadStreamOptions = {
	size: number;
	chunkSize: number;
	maxConcurrent: number;
	requestRange: (start: number, endInclusive: number) => Promise<ArrayBuffer>;
};

export function createWebDAVReadStream({
	size,
	chunkSize,
	maxConcurrent,
	requestRange,
}: CreateWebDAVReadStreamOptions): ReadableStream<ArrayBuffer> {
	const totalChunks = size === 0 ? 0 : Math.ceil(size / chunkSize);
	const maxBufferedBytes = chunkSize * maxConcurrent;
	if (totalChunks === 0)
		return new ReadableStream<ArrayBuffer>({
			start(controller) {
				controller.close();
			},
		});

	let controllerRef: ReadableStreamDefaultController<ArrayBuffer> | undefined;
	let nextChunkIndex = 0;
	let nextPendingIndex = 0;
	let inFlight = 0;
	let closed = false;
	let consumerReady = false;
	let pendingBytes = 0;
	const pending = new Map<number, ArrayBuffer>();

	const closeIfDone = () => {
		if (closed || !controllerRef) return;
		if (nextPendingIndex < totalChunks || inFlight > 0) return;
		closed = true;
		controllerRef.close();
	};

	const flush = () => {
		if (!controllerRef || closed) return;
		while (consumerReady && pending.has(nextPendingIndex)) {
			const chunk = pending.get(nextPendingIndex);
			if (!chunk) break;
			pending.delete(nextPendingIndex);
			pendingBytes -= chunk.byteLength;
			controllerRef.enqueue(chunk);
			consumerReady = (controllerRef.desiredSize ?? 0) > 0;
			nextPendingIndex++;
		}
		closeIfDone();
	};

	const canScheduleNext = () =>
		controllerRef !== undefined &&
		!closed &&
		consumerReady &&
		inFlight < maxConcurrent &&
		nextChunkIndex < totalChunks &&
		pendingBytes < maxBufferedBytes;

	const requestChunk = (currentIndex: number) => {
		inFlight++;

		const start = currentIndex * chunkSize;
		const endInclusive = Math.min(start + chunkSize - 1, size - 1);

		void requestRange(start, endInclusive)
			.then((buffer) => {
				if (closed) return;
				pending.set(currentIndex, buffer);
				pendingBytes += buffer.byteLength;
				inFlight--;
				flush();
				schedule();
			})
			.catch((error) => {
				if (closed) return;
				closed = true;
				controllerRef?.error(error);
			});
	};

	const schedule = () => {
		while (canScheduleNext()) {
			const currentIndex = nextChunkIndex;
			nextChunkIndex++;
			requestChunk(currentIndex);
		}
	};

	return new ReadableStream<ArrayBuffer>(
		{
			cancel() {
				closed = true;
			},
			pull(controller) {
				controllerRef = controller;
				consumerReady = true;
				flush();
				schedule();
			},
			start(controller) {
				controllerRef = controller;
			},
		},
		{ highWaterMark: 0 },
	);
}
