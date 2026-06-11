import { DECRYPTION_ERROR_MESSAGE } from './content';
import {
	FILE_SALT_LENGTH,
	concatUint8Arrays,
	decryptContentChunk,
	deriveFileKey,
	getEncryptedChunkCount,
	getEncryptedChunkSize,
	importAesGcmKey,
	ownedBytes,
} from './shared';

// oxlint-disable-next-line import/prefer-default-export
export function createDecryptedReadableStream(
	source: ReadableStream,
	rootFileKey: Uint8Array,
	key: string,
	encryptedFileSize: number,
): ReadableStream {
	const typedSource = source as ReadableStream<Uint8Array>;
	let pending = ownedBytes(new Uint8Array());
	let fileKeyPromise: Promise<CryptoKey> | undefined;
	let chunkIndex = 0;

	if (encryptedFileSize < FILE_SALT_LENGTH) throw new Error(DECRYPTION_ERROR_MESSAGE);

	const processPending = async (
		chunk: Uint8Array,
		isFinal: boolean,
		controller: TransformStreamDefaultController<Uint8Array>,
	): Promise<void> => {
		pending = ownedBytes(concatUint8Arrays(pending, chunk));

		const totalChunkCount = getEncryptedChunkCount(encryptedFileSize);

		if (!fileKeyPromise) {
			if (pending.length < FILE_SALT_LENGTH) {
				if (isFinal) throw new Error(DECRYPTION_ERROR_MESSAGE);
				return;
			}

			const fileSalt = ownedBytes(pending.slice(0, FILE_SALT_LENGTH));
			pending = ownedBytes(pending.slice(FILE_SALT_LENGTH));
			fileKeyPromise = importAesGcmKey(
				await deriveFileKey(rootFileKey, fileSalt, encryptedFileSize, key),
			);
		}

		while (chunkIndex < totalChunkCount) {
			const expectedSize = getEncryptedChunkSize(chunkIndex, encryptedFileSize);
			if (pending.length < expectedSize) break;

			const encryptedChunk = ownedBytes(pending.slice(0, expectedSize));
			pending = ownedBytes(pending.slice(expectedSize));
			controller.enqueue(
				await decryptContentChunk(await fileKeyPromise, encryptedChunk, chunkIndex),
			);
			chunkIndex += 1;
		}

		if (isFinal && (chunkIndex !== totalChunkCount || pending.length > 0))
			throw new Error(DECRYPTION_ERROR_MESSAGE);
	};

	return typedSource.pipeThrough(
		new TransformStream<Uint8Array, Uint8Array>({
			async flush(controller) {
				await processPending(new Uint8Array(), true, controller);
			},
			async transform(chunk, controller) {
				await processPending(chunk, false, controller);
			},
		}),
	);
}
