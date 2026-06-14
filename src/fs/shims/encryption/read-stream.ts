import { DECRYPTION_ERROR_MESSAGE } from './content';
import {
	FILE_SALT_LENGTH,
	concatArrayBuffer,
	decryptContentChunk,
	deriveFileKey,
	getEncryptedChunkCount,
	getEncryptedChunkSize,
	importAesGcmKey,
	ownedBytes,
} from './shared';

export default function createDecryptedReadableStream(
	source: ReadableStream<ArrayBuffer>,
	rootFileKey: Uint8Array,
	key: string,
	encryptedFileSize: number,
): ReadableStream<ArrayBuffer> {
	let pending = new ArrayBuffer(0);
	let fileKeyPromise: Promise<CryptoKey> | undefined;
	let chunkIndex = 0;

	if (encryptedFileSize < FILE_SALT_LENGTH) throw new Error(DECRYPTION_ERROR_MESSAGE);

	const processPending = async (
		chunk: ArrayBuffer,
		isFinal: boolean,
		controller: TransformStreamDefaultController<ArrayBuffer>,
	): Promise<void> => {
		pending = concatArrayBuffer(pending, chunk);

		const totalChunkCount = getEncryptedChunkCount(encryptedFileSize);
		let pendingBytes = new Uint8Array(pending);

		if (!fileKeyPromise) {
			if (pendingBytes.byteLength < FILE_SALT_LENGTH) {
				if (isFinal) throw new Error(DECRYPTION_ERROR_MESSAGE);
				return;
			}

			const fileSalt = ownedBytes(pendingBytes.slice(0, FILE_SALT_LENGTH));
			pending = pendingBytes.slice(FILE_SALT_LENGTH).buffer;
			pendingBytes = new Uint8Array(pending);
			fileKeyPromise = importAesGcmKey(
				await deriveFileKey(rootFileKey, fileSalt, encryptedFileSize, key),
			);
		}

		while (chunkIndex < totalChunkCount) {
			const expectedSize = getEncryptedChunkSize(chunkIndex, encryptedFileSize);
			if (pending.byteLength < expectedSize) break;

			const encryptedChunk = pendingBytes.slice(0, expectedSize).buffer;
			pendingBytes = pendingBytes.slice(expectedSize);
			pending = pendingBytes.buffer;
			controller.enqueue(
				await decryptContentChunk(await fileKeyPromise, encryptedChunk, chunkIndex),
			);
			chunkIndex += 1;
		}

		if (isFinal && (chunkIndex !== totalChunkCount || pending.byteLength > 0))
			throw new Error(DECRYPTION_ERROR_MESSAGE);
	};

	return source.pipeThrough(
		new TransformStream<ArrayBuffer, ArrayBuffer>({
			async flush(controller) {
				await processPending(new ArrayBuffer(0), true, controller);
			},
			async transform(chunk, controller) {
				await processPending(chunk, false, controller);
			},
		}),
	);
}
