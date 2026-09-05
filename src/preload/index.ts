import { contextBridge, ipcRenderer } from 'electron'
import { readFile } from 'node:fs/promises'

contextBridge.exposeInMainWorld('flashcardLearn', {
  version: '0.1.0',
  listCsvFiles: async () => ipcRenderer.invoke('flashcard-learn:list-csv-files'),
  readTextFile: async (filePath: string) => readFile(filePath, 'utf8')
})
