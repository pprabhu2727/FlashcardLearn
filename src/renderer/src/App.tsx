import { useEffect, useMemo, useState } from 'react'
import { parseFlashcardText, type Flashcard, type ParseIssue, type ParseResult } from './lib/flashcards'
import {
  answerCurrentCard,
  createLearnSession,
  getCurrentCard,
  getSessionStats,
  type LearnSessionState,
  type ReviewResult
} from './lib/studyEngine'

type CsvFileEntry = {
  name: string
  path: string
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function folderLabelFromPath(folderPath: string) {
  const parts = folderPath.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? folderPath
}

function getBridge() {
  return window.flashcardLearn
}

function statLine(label: string, value: number | string) {
  return (
    <div className="stat-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export default function App() {
  const [projectPath, setProjectPath] = useState('Loading project files...')
  const [csvFiles, setCsvFiles] = useState<CsvFileEntry[]>([])
  const [loadedFileName, setLoadedFileName] = useState('')
  const [loadedParse, setLoadedParse] = useState<ParseResult | null>(null)
  const [rangeStart, setRangeStart] = useState('1')
  const [rangeEnd, setRangeEnd] = useState('')
  const [cards, setCards] = useState<Flashcard[]>([])
  const [session, setSession] = useState<LearnSessionState | null>(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const selectedFile = csvFiles[0] ?? null

  useEffect(() => {
    let cancelled = false
    const bridge = getBridge()

    if (!bridge) {
      setNotice('The Electron bridge is not available.')
      return () => {
        cancelled = true
      }
    }

    bridge
      .listCsvFiles()
      .then((selection) => {
        if (cancelled || !selection) {
          return
        }

        setProjectPath(folderLabelFromPath(selection.folderPath))
        setCsvFiles(selection.csvFiles)

        if (selection.csvFiles.length === 0) {
          setNotice('No CSV files were found in the project folder.')
          setLoadedFileName('')
          setLoadedParse(null)
          setCards([])
          setSession(null)
          return
        }

        setNotice(`Found ${selection.csvFiles.length} CSV file${selection.csvFiles.length === 1 ? '' : 's'} in the project.`)
      })
      .catch(() => {
        if (!cancelled) {
          setNotice('Could not scan the project for CSV files.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedFile) {
      setLoadedFileName('')
      setLoadedParse(null)
      setCards([])
      setSession(null)
      return
    }

    let cancelled = false
    const bridge = getBridge()

    if (!bridge) {
      setNotice('The Electron bridge is not available.')
      return () => {
        cancelled = true
      }
    }

    bridge
      .readTextFile(selectedFile.path)
      .then((text) => {
        if (cancelled) {
          return
        }

        const parsed = parseFlashcardText(text)
        setLoadedFileName(selectedFile.name)
        setLoadedParse(parsed)
        setRangeStart('2')
        setRangeEnd(String(parsed.cards.length - 1))
        setCards([])
        setSession(null)
        setShowAnswer(false)
        setNotice(
          parsed.cards.length > 0
            ? `Loaded ${parsed.cards.length} cards from ${selectedFile.name}.`
            : 'The selected file did not contain any valid cards.'
        )
      })
      .catch(() => {
        if (!cancelled) {
          setNotice(`Could not read ${selectedFile.name}.`)
          setLoadedParse(null)
          setCards([])
          setSession(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedFile])

  const currentCard = useMemo(() => {
    if (!session) {
      return null
    }

    return getCurrentCard(session, cards)
  }, [cards, session])

  const stats = useMemo(() => {
    if (!session) {
      return { introduced: 0, learned: 0, dueNow: 0, active: 0 }
    }

    return getSessionStats(session, cards)
  }, [cards, session])

  const issues = loadedParse?.issues ?? []

  function resetStudy() {
    setCards([])
    setSession(null)
    setShowAnswer(false)
  }

  function refreshCsvList() {
    const bridge = getBridge()
    bridge?.listCsvFiles().then((selection) => {
      if (!selection) {
        return
      }

      setProjectPath(folderLabelFromPath(selection.folderPath))
      setCsvFiles(selection.csvFiles)
      resetStudy()
      setNotice(`Refreshed ${selection.csvFiles.length} CSV file${selection.csvFiles.length === 1 ? '' : 's'} from the project.`)
    })
  }

  function startSession() {
    if (!loadedParse) {
      setNotice('The CSV file is not loaded yet.')
      return
    }

    const totalCards = loadedParse.cards.length
    if (totalCards === 0) {
      setNotice('The selected file does not contain usable cards.')
      return
    }

    const start = clamp(Number.parseInt(rangeStart, 10) || 1, 1, totalCards)
    const endValue = rangeEnd.trim() === '' ? totalCards : Number.parseInt(rangeEnd, 10)
    const end = clamp(Number.isFinite(endValue) ? endValue : totalCards, start, totalCards)

    if (start > end) {
      setNotice('The start card cannot be after the end card.')
      return
    }

    const subset = loadedParse.cards.slice(start - 1, end)
    if (subset.length === 0) {
      setNotice('That range did not produce any cards.')
      return
    }

    setCards(subset)
    setSession(createLearnSession(subset))
    setShowAnswer(false)
    setNotice(`Studying cards ${start}-${end} from ${loadedFileName || selectedFile?.name || 'the selected file'}.`)
  }

  function answer(result: ReviewResult) {
    if (!session || !currentCard) {
      return
    }

    setSession(answerCurrentCard(session, cards, result))
    setShowAnswer(false)
    setNotice(result === 'understood' ? 'Good. That card can retire as soon as it earns enough correct answers.' : 'That card is coming back soon for another pass.')
  }

  const complete = Boolean(session && !session.currentCardId)
  const totalLoadedCards = loadedParse?.cards.length ?? 0
  const selectedFileDisplay = selectedFile?.name ?? loadedFileName
  const previewCards = useMemo(() => {
    if (!loadedParse || loadedParse.cards.length === 0) {
      return [] as Flashcard[]
    }

    const start = clamp(Number.parseInt(rangeStart, 10) || 1, 1, loadedParse.cards.length)
    const endValue = rangeEnd.trim() === '' ? loadedParse.cards.length : Number.parseInt(rangeEnd, 10)
    const end = clamp(Number.isFinite(endValue) ? endValue : loadedParse.cards.length, start, loadedParse.cards.length)

    if (start > end) {
      return [] as Flashcard[]
    }

    return loadedParse.cards.slice(start - 1, end)
  }, [loadedParse, rangeEnd, rangeStart])

  const firstCardPreview = previewCards[0] ?? null
  const lastCardPreview = previewCards[previewCards.length - 1] ?? null

  return (
    <div className="shell">
      <div className="backdrop backdrop-a" />
      <div className="backdrop backdrop-b" />

      <main className="layout">
        <section className="hero-panel">
          <div className="eyebrow">Flashcard Learn</div>
          <h1>A first pass flashcard study app.</h1>
          <p className="hero-copy">
            The app scans the project for the CSV file in "Flashcards CSV Files", then you only choose a start and end card to study a subset.
          </p>

          <div className="import-card">
            <div className="selection-summary">
              <span>CSV file</span>
              <strong>{selectedFileDisplay || 'No file found'}</strong>
            </div>

            <div className="range-grid">
              <label className="field-stack">
                <span>Start card</span>
                <input
                  type="number"
                  min={1}
                  max={totalLoadedCards || 1}
                  value={rangeStart}
                  onChange={(event) => setRangeStart(event.target.value)}
                  disabled={totalLoadedCards === 0}
                />
              </label>

              <label className="field-stack">
                <span>End card</span>
                <input
                  type="number"
                  min={1}
                  max={totalLoadedCards || 1}
                  value={rangeEnd}
                  onChange={(event) => setRangeEnd(event.target.value)}
                  placeholder={totalLoadedCards > 0 ? String(totalLoadedCards) : ''}
                  disabled={totalLoadedCards === 0}
                />
              </label>
            </div>

            <div className="selection-summary">
              <span>Parsed cards</span>
              <strong>{totalLoadedCards}</strong>
            </div>

            <div className="preview-grid">
              <div className="preview-card">
                <span className="card-tag">First card preview</span>
                {firstCardPreview ? (
                  <>
                    <p>{firstCardPreview.term}</p>
                  </>
                ) : (
                  <p>No CSV loaded yet.</p>
                )}
              </div>

              <div className="preview-card">
                <span className="card-tag">Last card preview</span>
                {lastCardPreview ? (
                  <>
                    <p>{lastCardPreview.term}</p>
                  </>
                ) : (
                  <p>No CSV loaded yet.</p>
                )}
              </div>
            </div>

            <div className="import-actions">
              <button className="primary-button" onClick={startSession} disabled={!loadedParse || totalLoadedCards === 0}>
                Start session
              </button>
            </div>

            <div className="tip-row">
              <span>Recommended format</span>
              <strong>CSV with two columns</strong>
            </div>
            <p className="helper-text">
              Put the term in column one and the definition in column two. Quote fields that contain commas, and use a range to study just a subset when needed.
            </p>
          </div>

          {notice ? <div className="notice">{notice}</div> : null}
        </section>

        <section className="study-panel">
          <div className="study-header">
            <div>
              <span className="section-label">Current session</span>
              <h2>{complete ? 'Deck complete' : currentCard ? '' : 'Choose a CSV to begin'}</h2>
              <p className="session-subtitle">
                {cards.length > 0 ? `Studying ${cards.length} cards from ${selectedFileDisplay || 'the chosen file'}.` : 'No study session is active yet.'}
              </p>
            </div>
            <div className="stats-grid">
              {statLine('Cards', cards.length)}
              {statLine('In rotation', stats.active)}
              {statLine('Learned', stats.learned)}
            </div>
          </div>

          <div className={`card-stage ${showAnswer ? 'revealed' : ''}`}>
            {currentCard ? (
              <>
                <div className="card-face card-front">
                  <span className="card-tag">Question:</span>
                  <h3>{currentCard.term}</h3>
                  <p>?</p>
                </div>
                <div className="card-face card-back">
                  <span className="card-tag">Answer</span>
                  <p>{currentCard.definition}</p>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <span className="card-tag">Ready</span>
                <h3>{cards.length > 0 ? 'No card is currently due.' : 'Pick a CSV file, then start a session.'}</h3>
                <p>
                  The scheduler keeps cards cycling until they are learned, while spacing successful cards farther apart and bringing misses back quickly.
                </p>
              </div>
            )}
          </div>

          <div className="study-actions">
            <button className="ghost-button" disabled={!currentCard || showAnswer} onClick={() => setShowAnswer(true)}>
              Reveal answer
            </button>
            <button className="secondary-button" disabled={!currentCard || !showAnswer} onClick={() => answer('missed')}>
              Didn&apos;t understand
            </button>
            <button className="primary-button" disabled={!currentCard || !showAnswer} onClick={() => answer('understood')}>
              Understood
            </button>
          </div>

          {issues.length > 0 ? (
            <div className="issue-panel">
              <h3>Import warnings</h3>
              <ul>
                {issues.map((issue: ParseIssue) => (
                  <li key={`${issue.row}-${issue.message}`}>
                    Row {issue.row}: {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  )
}
