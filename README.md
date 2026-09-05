# Flashcard Learn

Flashcard Learn is a desktop study app inspired by Quizlet Learn. It is designed for large flashcard sets where you want repetition to begin right away, not after the entire deck has already been shown once.

## What it does

- Scans the project for the single `.csv` file at startup, including CSVs stored in subfolders, and uses it automatically.
- Lets you optionally study only a subset of the file by choosing a start and end card number.
- Shows a preview of the first and last card definitions so you can verify the file before starting.
- Uses a Learn-style queue so missed cards come back quickly and successful cards are spaced farther apart.
- Retires cards dynamically: a card answered correctly on the first try can retire immediately, while cards that were missed several times must earn more correct answers before retiring.
- Focuses on two study actions: `Understood` and `Didn't understand`.

## Getting started

1. Install dependencies with `npm install`.
2. Start the desktop app with `npm run dev`.
3. Open the app and wait for it to scan the project for the single `.csv` file.
4. Check the first and last card previews to make sure it found the right file.
5. Optionally set a start card and end card if you only want part of the file.
6. Click `Start session`.

If you want to study the full file, leave the range at the defaults. If you want a subset, use card numbers based on the order of the rows in the CSV file.

## CSV format

Use two columns per row:

```csv
Term,Definition
Homeostasis,The tendency of a system to maintain internal stability
Photosynthesis,The process plants use to convert light into chemical energy
```

The importer will also try to handle files that use other single-character separators such as tabs, pipes, or semicolons, but CSV with quoted fields is the safest option.

Guidelines:

- Put the term in the first column.
- Put the definition in the second column.
- Quote fields if they contain commas or other separator characters.
- Keep one flashcard per row.

## Study behavior

The app introduces cards gradually instead of forcing you through the whole set before repetition starts.

- New cards enter the session in a small window.
- Cards marked `Didn't understand` come back sooner.
- Cards marked `Understood` move farther away before they appear again.
- Cards only retire after they have been answered correctly multiple times.
- A card answered correctly the first time can retire immediately.
- Cards that were missed repeatedly require more correct answers before they retire, up to a small cap.
- `In rotation` shows the small group of cards currently being cycled, not the total number of unlearned cards. It normally stays at three as completed cards are replaced by new cards.

## Development

- `npm run dev` starts the app in development mode.
- `npm run build` creates a production build.

## Quick Launch

Use `Flashcard Learn Quick Launch.cmd` in the project root if you want a one-click Windows launcher. It opens the app in development mode and installs dependencies first if `node_modules` is missing.

If you want a real standalone executable, this project does not build one yet. The next step for that would be packaging with Electron tooling such as `electron-builder`.

## Troubleshooting

If `npm run dev` reports that it cannot find the Electron entry file, make sure the `main` field in `package.json` points to the built Electron entry file used by electron-vite.

If the app says the Electron bridge is not available, check that the preload path in `src/main/index.ts` points at `../preload/index.mjs`.

If the app does not find your CSV, confirm that it really has the `.csv` extension and that it is saved somewhere in the project folder tree.

Closing the Electron window exits the app normally. The quick-launch command may leave its development console open because it runs the development watcher separately; that console can be closed when you are finished.

