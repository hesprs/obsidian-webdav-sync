# WebDAV Explorer Source Code Map

## Responsibility
The `src` directory contains the core UI and logic for the WebDAV file explorer. Its primary responsibilities include:
- **Directory Navigation**: Providing a user interface to browse remote directories.
- **Folder Management**: Enabling the creation of new folders on the remote server.
- **Path Selection**: Allowing users to select and confirm a specific directory path for synchronization or other purposes.
- **Abstraction**: Decoupling the UI from the underlying file system implementation through a standardized `fs` interface.
- **Internationalization**: Supporting multiple languages (English and Chinese) for the explorer UI.

## Design Patterns
- **Component-Based Architecture**: Built using SolidJS components (`App`, `FileList`, `File`, `Folder`, `NewFolder`) for modular and reactive UI development.
- **Factory Pattern**: The `createFileList` function in `FileList.tsx` acts as a factory that returns a stateful component and a `refresh` controller, allowing external triggers for data re-fetching.
- **Dependency Injection**: The `App` component receives its file system implementation (`fs`) and event handlers (`onConfirm`, `onClose`) via props, facilitating testing and reuse with different backends.
- **Signal-Based State Management**: Leverages SolidJS signals for fine-grained reactivity in managing the navigation stack, UI visibility, and localization.
- **Strategy Pattern (i18n)**: Uses a dictionary-based approach for translations, selecting the appropriate locale strategy based on the user's environment.

## Data & Control Flow
- **Navigation Flow**: 
    1. `App.tsx` maintains a `stack` of directory paths.
    2. Clicking a `Folder` component triggers `enter(path)`, pushing a new path onto the stack.
    3. The "Go Back" button triggers `pop()`, removing the top path from the stack.
- **Data Fetching**:
    1. The `FileList` component monitors the current path and a `version` signal.
    2. When either changes, it calls `fs.ls(path)` to fetch the directory contents.
    3. The results are sorted (folders first, then alphabetically) and rendered.
- **Action Flow**:
    1. Creating a folder via `NewFolder` calls `fs.mkdirs(target)`.
    2. Upon successful creation, the `FileList` is refreshed via the `version` signal.
    3. Clicking "Confirm" passes the current working directory (`cwd`) back to the parent application via `onConfirm`.

## Integration Points
- **Obsidian API**: Integrates with Obsidian's `Notice` system to display error messages and feedback to the user.
- **SolidJS Framework**: The entry point `index.tsx` uses SolidJS's `render` to mount the application into the DOM.
- **File System Interface**: Expects an object implementing the `fs` interface (`ls` and `mkdirs` methods), typically provided by a WebDAV client wrapper.
- **i18n System**: Uses `@solid-primitives/i18n` for translation management, integrating with `navigator.language` for automatic locale detection.
