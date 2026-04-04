# Change Log

All notable changes to the "llm-babysitter" extension will be documented in this file.

## [0.1.3] - 2026-04-04

### Added
- **New Test Suite**: Comprehensive unit testing with Vitest and integration testing with @vscode/test-cli, achieving high reliability across the extension's core services.

### Changed
- **Rebranding**: Renamed the entire extension from "Backseat Pilot" to **LLM Babysitter** across the codebase, configuration, and documentation due to a name collision with an existing extension.

## [0.1.2] - 2026-04-04

### Refactored
- **File Explorer Architecture**: Refactor for robust lazy-loading, recursive selection, and performance.

### Fixed
- Fixed **Recursive Selection**: Selecting a closed folder now correctly deep-fetches and selects all nested children.
- Fixed **Rendering Performance**: Implemented partial tree updates and reference-equality checks to eliminate UI flicker and scroll resets during text entry.
- Fixed **Search Interactivity**: Corrected visibility and expansion logic when a filter is active.
- Fixed **Expand/Collapse All**: Restored functionality for bulk expand/collapse actions.
- Added **Filesystem Validation**: Persisted selections are now validated against the filesystem on startup to filter out stale paths.
- Enforced **File-Only Selection**: Directory paths are no longer stored in the selection set, ensuring consistent prompt generation.

## [0.1.1] - 2026-04-01

### Fixed
- Fixed missing UI styles and icons in the packaged `.vsix` extension by correctly bundling them in the `dist` folder.

## [0.1.0] - 2026-04-01

### Added
- Initial release of **LLM Babysitter**.