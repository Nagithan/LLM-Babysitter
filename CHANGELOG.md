# Change Log

## [0.3.0] - 2026-04-23

### Added
- Added new built-in prompt presets for a pragmatic senior pre-prompt plus `Code / PR review`, `Implement a feature`, `Performance`, and `Security` main instructions.

### Changed
- Improved the token usage panel by showing prompt and file token subtotals, capping the stacked progress bar correctly, and exposing the token meter to assistive technologies.
- Standardized the extension UI, built-in prompts, and preset labels in English only by removing the built-in French localization layer.
- Improved long prompt textareas by keeping them scrollable instead of letting very large prompts over-expand the sidebar.
- Tightened the default exclusion patterns so common credential files such as `.env`, `.npmrc`, SSH material, and key/certificate files stay hidden from the explorer unless users explicitly opt in.

### Fixed
- Fixed **Expand All** for lazy-loaded folders so nested directories are progressively loaded and expanded instead of appearing as empty collapsed placeholders.
- Fixed empty folder checkbox states so loaded empty folders are disabled and no longer appear selected by default.
- Fixed parent folder selection state when empty folders are mixed with selected files.
- Fixed batch selection loading states so the Select All button remains disabled with a busy indicator while deep folder contents are collected.
- Fixed favorite modal keyboard and dismissal behavior: Enter saves, Escape closes, backdrop click cancels, and repeated openings clean up prior listeners.
- Fixed stale status timers so newer status messages are not hidden by older timeout callbacks.
- Fixed Copy to Clipboard feedback by adding a busy state while prompt generation is in progress.
- Fixed explorer search so it no longer blanks out unopened lazy-loaded folders while filtering; matching branches are now discovered progressively and empty searches show an explicit no-results state.
- Fixed startup token totals for restored file selections by warming the cached file-token count before the webview requests its first token refresh.
- Refined dotfile discovery so benign dotfiles remain supported while internal VCS/system entries stay hidden and sensitive credential files are excluded by default.
- Fixed favorite management for modified custom presets so the original preset remains updatable instead of forcing duplicate saves, and built-in presets are now clearly presented as read-only.
- Fixed tree accessibility by adding keyboard navigation, focus styling, and screen-reader semantics to explorer rows.
- Fixed prompt refreshes after preset actions and settings refresh so in-progress text is preserved instead of being reset to empty fields.
- Fixed empty copy attempts so the extension now reports that there is nothing to copy instead of showing a false success state.
- Fixed the favorite naming modal for keyboard users by trapping focus inside the dialog and restoring focus to the triggering control on close.
- Fixed favorite-management prompts, actions, confirmations, and status messages so they now stay consistently in English across the native VS Code flows.
- Hardened file loading by rejecting symbolic links from the explorer and prompt pipeline so linked files cannot escape the workspace boundary.
- Fixed generated prompt fences so file contents containing backticks no longer break the Markdown envelope around selected files.
- Fixed file token estimation to use structured file-read results, keeping the meter aligned with the copied prompt even when file content starts with `[` or placeholder messages are injected for skipped/error cases.

## [0.2.0] - 2026-04-05

### Added
- **Tooltip System**: Implementation of a CSS-only tooltip specifically designed to bypass Electron iframe clipping and macOS focus suppression bugs.
- **Enhanced Template Interaction**:
  - Added a "Modified" state for template buttons.
  - Clicking an active template now clears the input field.
  - Manual text edits now transition the active template into the "Modified" state instead of clearing its selection entirely.

### Changed
- **UI Architecture**: Converted all chips and section title handlers to semantic `<button>` elements for improved browser focus handling and accessibility.

### Fixed
- **Refined Selection Logic**: Template content is now **only** automatically applied during the initial load; **subsequent clearing of fields by the user is respected**.


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
