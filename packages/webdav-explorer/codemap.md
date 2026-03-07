# WebDAV Explorer Package Codemap

## Responsibility
The `webdav-explorer` package provides a SolidJS-based user interface for exploring and interacting with a WebDAV filesystem. It is designed to be embedded within an Obsidian plugin (or any other environment) to allow users to navigate folders, create new directories, and select a target path for synchronization.

## Design Patterns
- **Component-Based Architecture**: Built using SolidJS components (`App`, `FileList`, `File`, `Folder`, `NewFolder`) for a reactive and modular UI.
- **Dependency Injection**: The actual filesystem operations are abstracted behind an `fs` interface (`ls`, `mkdirs`), which is passed as a prop to the `App` component. This decouples the UI from the specific WebDAV client implementation.
- **Reactive State Management**: Uses SolidJS signals (`createSignal`) and effects (`createEffect`) to manage navigation state (path stack), file lists, and UI visibility (e.g., the "New Folder" dialog).
- **Internationalization (i18n)**: Implements multi-language support using `@solid-primitives/i18n`, with automatic locale detection based on the browser's language.

## Data & Control Flow
- **Navigation**:
    - The `App` component maintains a `stack` of paths.
    - `enter(path)` pushes a new path to the stack, triggering a re-render of the `FileList`.
    - `pop()` removes the top path from the stack to go back to the parent directory.
- **File Listing**:
    - `FileList` uses the provided `fs.ls(path)` method to fetch directory contents.
    - Items are sorted (directories first, then files) and rendered using the `For` component.
- **Folder Creation**:
    - `NewFolder` component captures user input and calls `fs.mkdirs(path)`.
    - Upon success, it triggers a refresh of the `FileList` via a `version` signal.
- **Selection**:
    - When the user clicks "Confirm", the `onConfirm` callback is invoked with the current directory path (`cwd`).

## Integration Points
- **Mounting**: The `mount(el, props)` function in `index.tsx` is the primary entry point for embedding the explorer into a DOM element.
- **Filesystem Interface**: Requires an object implementing the `fs` interface:
  ```typescript
  interface fs {
    ls: (path: string) => Promise<FileStat[]>;
    mkdirs: (path: string) => Promise<void>;
  }
  ```
- **Callbacks**: Communicates user actions back to the host application via `onConfirm` and `onClose` props.
- **Obsidian API**: Directly uses Obsidian's `Notice` class for displaying error messages to the user.
