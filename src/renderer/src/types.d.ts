export {}

declare global {
  interface Window {
    flashcardLearn?: {
      version: string
      listCsvFiles: () => Promise<{
        folderPath: string
        csvFiles: Array<{
          name: string
          path: string
        }>
      } | null>
      readTextFile: (filePath: string) => Promise<string>
    }
  }
}
