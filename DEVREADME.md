# Developer README

This project is a desktop flashcard study app built with Electron, electron-vite, React, and TypeScript. The current experience auto-discovers CSV files in the project tree, loads the single discovered file automatically, lets you choose a study range, and shows previews of the first and last cards in that selected range before you start studying.

## Project structure

- `package.json` - project scripts and dependency list.
- `electron.vite.config.ts` - electron-vite build configuration.
- `src/main/index.ts` - Electron main process; creates the window and exposes the CSV listing IPC handler.
- `src/preload/index.ts` - preload bridge; exposes `listCsvFiles` and `readTextFile` to the renderer.
- `src/renderer/src/App.tsx` - main UI and session flow.
- `src/renderer/src/lib/flashcards.ts` - CSV parsing and import validation.
- `src/renderer/src/lib/studyEngine.ts` - card scheduling, repetition timing, and retirement logic.
- `src/renderer/src/styles.css` - all visual styling for the app.

## What to change where

- CSV discovery or startup behavior: edit `src/main/index.ts`.
- Renderer bridge methods: edit `src/preload/index.ts` and the matching window type definitions in `src/renderer/src/types.d.ts`.
- Study flow, range selection, preview behavior, and UI labels: edit `src/renderer/src/App.tsx`.
- Repetition behavior, due timing, retirement thresholds, or stats: edit `src/renderer/src/lib/studyEngine.ts`.
- CSV parsing rules and delimiter handling: edit `src/renderer/src/lib/flashcards.ts`.
- Layout, overflow, spacing, colors, and responsiveness: edit `src/renderer/src/styles.css`.

The `In rotation` stat is intentionally capped by `DEFAULT_ACTIVE_WINDOW` in `studyEngine.ts` (currently three cards). When a card retires, another unseen card enters the rotation, so the value normally stays at three until the session is nearly complete. The `Learned` stat is the cumulative completed-card count.

## Running the app

- `npm run dev` starts the Electron app in development mode.
- `npm run build` creates the production bundle.

Closing the Electron window triggers the normal `window-all-closed` handler in `src/main/index.ts`, which calls `app.quit()` on Windows. The quick-launch command starts the development watcher in another console window; the Electron app closes normally, but that development console may remain open until its watcher is stopped.

## Quick launch and packaging

- `Flashcard Learn Quick Launch.cmd` is the fastest way to start the app on Windows. It runs `npm run dev` from the project root and installs dependencies first if needed.
- There is no packaged `.exe` yet. If you want one, add an Electron packager such as `electron-builder` and wire it to a production build workflow.

## Notes for future changes

- The UI currently hides the due count from the visible stats row, but the scheduler still tracks it internally in `studyEngine.ts`.
- The preview cards are based on the currently selected start/end range, so changing those inputs should immediately update the preview.
- If the bridge or CSV discovery ever fails again, start by checking `src/main/index.ts` for the IPC handler and the preload path used in the BrowserWindow configuration.
