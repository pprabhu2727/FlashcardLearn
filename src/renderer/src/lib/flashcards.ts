import Papa from 'papaparse'

export interface Flashcard {
  id: string
  term: string
  definition: string
  sourceRow: number
}

export interface ParseIssue {
  row: number
  message: string
  raw: string
}

export interface ParseResult {
  cards: Flashcard[]
  issues: ParseIssue[]
  delimiter: string
}

const DELIMITERS = ['\t', '|', ';', ','] as const

function normalizeInput(text: string) {
  return text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim()
}

function parseRows(text: string, delimiter: string) {
  const result = Papa.parse<string[]>(text, {
    delimiter,
    skipEmptyLines: 'greedy',
    quoteChar: '"',
    escapeChar: '"',
    transform: (value) => value.trim()
  })

  const cards: Flashcard[] = []
  const issues: ParseIssue[] = []

  result.data.forEach((row, index) => {
    if (!Array.isArray(row)) {
      return
    }

    const cells = row.map((cell) => cell.trim()).filter((cell) => cell.length > 0)
    if (cells.length < 2) {
      const raw = row.join(delimiter).trim()
      if (raw) {
        issues.push({
          row: index + 1,
          message: 'Expected at least two columns for term and definition.',
          raw
        })
      }
      return
    }

    const term = cells[0]
    const definition = cells.slice(1).join(delimiter === '\t' ? '\t' : ` ${delimiter} `)

    if (!term || !definition) {
      issues.push({
        row: index + 1,
        message: 'Both the term and definition need text.',
        raw: row.join(delimiter)
      })
      return
    }

    cards.push({
      id: `card-${index + 1}-${term.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      term,
      definition,
      sourceRow: index + 1
    })
  })

  return { cards, issues }
}

function scoreResult(cards: Flashcard[], issues: ParseIssue[]) {
  return cards.length * 10 - issues.length * 3
}

export function parseFlashcardText(input: string): ParseResult {
  const text = normalizeInput(input)

  if (!text) {
    return { cards: [], issues: [], delimiter: '\t' }
  }

  let best = { cards: [] as Flashcard[], issues: [] as ParseIssue[], delimiter: DELIMITERS[0] }
  let bestScore = Number.NEGATIVE_INFINITY

  for (const delimiter of DELIMITERS) {
    const parsed = parseRows(text, delimiter)
    const score = scoreResult(parsed.cards, parsed.issues)

    if (score > bestScore) {
      best = { ...parsed, delimiter }
      bestScore = score
    }
  }

  return best
}
