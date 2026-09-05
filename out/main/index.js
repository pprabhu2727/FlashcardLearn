import { app, ipcMain, BrowserWindow } from "electron";
import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
const isDev = !app.isPackaged;
async function collectCsvFiles(rootPath) {
  const csvFiles = [];
  async function scanDirectory(directoryPath) {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        await scanDirectory(entryPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".csv")) {
        continue;
      }
      csvFiles.push({
        name: relative(rootPath, entryPath).split(sep).join("/"),
        path: entryPath
      });
    }
  }
  await scanDirectory(rootPath);
  csvFiles.sort((left, right) => left.name.localeCompare(right.name));
  return csvFiles;
}
ipcMain.handle("flashcard-learn:list-csv-files", async () => {
  const candidateRoots = [
    process.cwd(),
    app.getAppPath(),
    join(app.getAppPath(), "..")
  ];
  const roots = candidateRoots.filter((rootPath, index, allRoots) => rootPath && allRoots.indexOf(rootPath) === index);
  const discovered = /* @__PURE__ */ new Map();
  for (const rootPath of roots) {
    try {
      const csvFiles2 = await collectCsvFiles(rootPath);
      for (const file of csvFiles2) {
        if (!discovered.has(file.path)) {
          discovered.set(file.path, file);
        }
      }
    } catch {
      continue;
    }
  }
  const csvFiles = Array.from(discovered.values()).sort((left, right) => left.name.localeCompare(right.name));
  return {
    folderPath: process.cwd(),
    csvFiles
  };
});
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1120,
    minHeight: 760,
    backgroundColor: "#08111f",
    titleBarStyle: "hiddenInset",
    title: "Flashcard Learn",
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }
  mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
}
app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
