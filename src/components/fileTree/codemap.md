# src/components/fileTree/

## Responsibility

Render the sync task list as a hierarchical file tree and keep selection state consistent across related folder/file tasks.

## Design

- `tree-data.ts` builds a normalized node graph from `BaseTask[]`.
- Each path segment becomes a node; structural nodes exist for missing intermediate folders.
- Nodes carry task flags (`isFolderTask`, `isCreateFolderTask`, `isDeleteFolderTask`) plus ancestor/descendant task id sets used by selection rules.
- Visible labels are compressed through single-child structural chains (`a/b/c`), and children are sorted structural-first, then folder-task-first, then by name.
- `selection.ts` owns mutable selection state in `FileTreeSelectionController`.

## Flow

1. `App` receives `tasks` and calls `createFileTreeData(tasks)`.
2. The tree builder returns `nodes`, `orderedNodeIds`, and `taskNodeIds`; `App` initializes all task nodes as selected.
3. Rendering iterates `orderedNodeIds`, indents by node depth, and shows task-specific icons/tooltips.
4. Clicking a task row calls `controller.toggle(nodeId, nextSelected)`.
5. The controller propagates selection changes to descendant tasks and ancestor create/delete-folder tasks, then `App` mirrors the returned node ids into local Solid store state.
6. `getSnapshot()` converts controller state back into `selectedTasks` and `unselectedTasks` arrays.

## Integration

- `App.tsx` is the internal UI entry point; it consumes `BaseTask`, `createFileTreeData`, and `FileTreeSelectionController` directly.
- `index.tsx` exposes `mount(el, props)` for Solid rendering and re-exports `FileTreeSelectionController` plus `FileTreeSelectionSnapshot` for external consumers.
- `controllerRef` lets callers capture the controller instance and read selection snapshots without coupling to component internals.
