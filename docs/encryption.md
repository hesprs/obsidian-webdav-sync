# End-To-End Encryption

The plugin unloads files encrypted to remote, download and decrypt back to local. The schema below aims to achieve production-level security and resource efficiency.

## Terminology

- IV = Initialization Vector = Nonce
- B = Byte
- KB = KiB = 1024B
- _Master key_: the generated deterministic strong key from user password and WebDAV info
- File nonce: the generated random 8B number used to concatenate chunk counter to generate _chunk nonce_

## Enabling and Disabling

- Via settings "End-to-end encryption" toggling
- When enabled, allow users to set encryption password via Obsidian keychain, like WebDAV token
- Shows modal to remind users to:
  - ensure all devices are synced and have E2EE enabled / disabled
  - manually delete remote directory
  - re-trigger sync
- On each sync, check first whether E2EE is enabled but secret `webdav-sync-e2ee-key` is linked, or secret `split('.')[1]` is the object hash of server URL + account name + remote base directory. This is safe since there won't be a second user with the exact setup, so the salt is unique
- If the the above step returns false:
  - get the object hash of server URL + account name + remote base directory (should already be obtained)
  - derive a deterministic salt from the hash
  - apply `PBKDF2` to the user's password with the salt by 600k iterations (asynchronous) to obtain _master key_
  - convert the _master key_ to _Base64URL_ string, and save to secret `webdav-sync-e2ee-key` as `<Base64URL>.<object hash>`.
  - pass _master key_ down to the sync logic
- If returns true:
  - _Base64URL_ decode `split('.')[0]` and convert to binary as _master key_
  - pass _master key_ down to the sync logic

## File Encryption

- Input raw file
- Generate random 8B _file nonce_
- Splice the file content into 128KB chunks, special size for the last chunk, for each chunk:
  - generate get chunk index starting from 0 represented in 4B
  - calculate _chunk nonce_ as _file nonce_ concatenated by 4B chunk index
  - encrypt the 128KB with _master key_ and _chunk nonce_ using `AES-GCM-256`
  - each chunk = chunk index (4B) + ciphertext (128KB = 131,072B) + auth tag (16B) = 131,092B
- Concatenate the file as: _file nonce_ + all chunks
- Upload encrypted file

## File / Folder Name Encryption

- All names should be normalized to Unicode NFC (current plugin logic already ensures this)
- Cascade and encrypt the whole path chain, for each chain node:
  - generate deterministic random 12B nonce from the node's full path
  - use `AES-GCM-256` to encrypt to ciphertext with nonce + _master key_
  - the new file name = `<base64URL(nonce + ciphertext + authTag)>.sync-enc` (same name for folders, although a bit weird to add an extension to folders)
- For example, when encrypting the full path of `foo/bar/a.md`, first generate nonce from `foo` to encrypt folder `foo`, then `foo/bar` for `bar` folder, and `foo/bar/a.md` for `a.md`.
- Use a global in-memory cache to accelerate file path encryption for identical paths, limited to 10K entries.
- This is safe since file system forbids same-name file in the same directory, so each nonce is unique.

## One-pass Decryption

- Download encrypted file
- Splice the first 8B as _file nonce_
- Continue to splice into 131,092B pieces (exception for the last chunk), for each piece:
  - obtain the first 4 chunks as _chunk index_
  - verify if _chunk index_ is in the correct ascending order, if not, throw file corrupted error
  - splice and obtain ciphertext and auth tag
  - concatenate _file nonce_ with _chunk index_ to obtain _chunk nonce_
  - decrypt the chunk with _chunk nonce_ + _master key_ with `AES-GCM-256`, throw `data corrupted` or `wrong password` and skip the file if auth tag mismatch
- Concatenate chunks
- Save file

## Ranged Decryption (for ranged downloading)

- Accept a sequential stream of random-size binary
- Split and concatenate the chunk internally
- For example, if the first received binary is 2,000,000B in size, the range decrypter:
  - strips first 8B as _file nonce_
  - add up counter for each chunk and strip next 1966380B as 15 _completed chunks_
  - save the last 33612B as an _incomplete chunk_ and save to a buffer
  - verify the _chunk indices_ for the first 15 _completed chunks_ are consistent with the deduced logical indices.
  - decrypt the 15 _completed chunks_ using `AES-GCM-256`, throw `data corrupted` or `wrong password` and skip the file if auth tag mismatch
  - concatenate content, and return to caller. The caller should append the file and GC immediately
  - next time the decrypter class method is called, it concatenates the content in the buffer with the first certain size of bytes in the new binary as the first _completed chunk_.
  - repeat until a done call is received, the class treats the rest content in its buffer as a _completed chunk_, decrypt directly and return to caller.

## File / Folder Name Decryption

- Input file name `Base64URL`
- Parse to raw bytes
- Strip first 12B as nonce
- Decrypt the rest of the file name using `AES-GCM-256` with nonce and _master key_ (and use the cache if possible)
- Return the decrypted file name

## Implementation

- The implementation should only use Web Crypto API, use of any external library or Node modules is forbidden
- Helpers and exports should be encapsulated in `src/composable/encryption.ts`. The implementation should be context-agnostic and reusable across similar projects
- Encryption should be isolated at the end site, directly in the push task and mkdir task
- Decryption should happen immediately when the encrypted file touches local machine, directly during remote traversal, pull task, and `getRemoteContent`.
- Only trigger decryption when the file name of the target ends with `.sync-enc` or `.sync-enc/`.
