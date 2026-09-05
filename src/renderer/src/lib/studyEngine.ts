import type { Flashcard } from './flashcards'

export type ReviewResult = 'understood' | 'missed'

const DEFAULT_ACTIVE_WINDOW = 5
const MAX_REQUIRED_CORRECTS = 3

export interface CardProgress {
  introduced: boolean
  retired: boolean
  mastery: number
  consecutiveCorrects: number
  consecutiveMisses: number
  misses: number
  seen: number
  dueTurn: number
  introducedTurn: number | null
  requiredCorrects: number
  lastResult: ReviewResult | null
}

export interface LearnSessionState {
  turn: number
  activeWindow: number
  currentCardId: string | null
  unseenIds: string[]
  progressById: Record<string, CardProgress>
}

export interface SessionStats {
  introduced: number
  learned: number
  dueNow: number
  active: number
}

function createProgress(): CardProgress {
  return {
    introduced: false,
    retired: false,
    mastery: 0,
    consecutiveCorrects: 0,
    consecutiveMisses: 0,
    misses: 0,
    seen: 0,
    dueTurn: 0,
    introducedTurn: null,
    requiredCorrects: 1,
    lastResult: null
  }
}

function nextGap(progress: CardProgress) {
  if (progress.lastResult === 'missed') {
    return 1
  }

  if (progress.requiredCorrects <= 1) {
    return 1
  }

  if (progress.requiredCorrects === 2) {
    return 1
  }

  if (progress.requiredCorrects === 3) {
    return 2
  }

  return 2
}

function chooseNextCard(session: LearnSessionState, cards: Flashcard[]) {
  const active = cards.filter((card) => {
    const progress = session.progressById[card.id]
    return progress.introduced && !progress.retired
  })

  const ready = active
    .filter((card) => session.progressById[card.id].dueTurn <= session.turn)
    .sort((left, right) => {
      const leftProgress = session.progressById[left.id]
      const rightProgress = session.progressById[right.id]

      if (leftProgress.dueTurn !== rightProgress.dueTurn) {
        return leftProgress.dueTurn - rightProgress.dueTurn
      }

      if (leftProgress.misses !== rightProgress.misses) {
        return rightProgress.misses - leftProgress.misses
      }

      return leftProgress.mastery - rightProgress.mastery
    })

  if (ready.length > 0) {
    return ready[0].id
  }

  if (session.unseenIds.length > 0) {
    const introducedCount = active.length
    if (introducedCount < session.activeWindow) {
      return session.unseenIds[0]
    }
  }

  if (active.length === 0) {
    return null
  }

  return active
    .slice()
    .sort((left, right) => {
      const leftProgress = session.progressById[left.id]
      const rightProgress = session.progressById[right.id]

      if (leftProgress.dueTurn !== rightProgress.dueTurn) {
        return leftProgress.dueTurn - rightProgress.dueTurn
      }

      return leftProgress.introducedTurn - rightProgress.introducedTurn
    })[0].id
}

export function createLearnSession(cards: Flashcard[], activeWindow = DEFAULT_ACTIVE_WINDOW): LearnSessionState {
  const progressById: Record<string, CardProgress> = {}
  for (const card of cards) {
    progressById[card.id] = createProgress()
  }

  const unseenIds = cards.map((card) => card.id)
  const currentCardId = unseenIds[0] ?? null
  if (currentCardId) {
    progressById[currentCardId] = {
      ...progressById[currentCardId],
      introduced: true,
      dueTurn: 0,
      introducedTurn: 0
    }
    unseenIds.shift()
  }

  return {
    turn: 0,
    activeWindow,
    currentCardId,
    unseenIds,
    progressById
  }
}

export function getCurrentCard(session: LearnSessionState, cards: Flashcard[]) {
  if (!session.currentCardId) {
    return null
  }

  return cards.find((card) => card.id === session.currentCardId) ?? null
}

export function getSessionStats(session: LearnSessionState, cards: Flashcard[]): SessionStats {
  const introduced = cards.filter((card) => session.progressById[card.id]?.introduced && !session.progressById[card.id]?.retired).length
  const learned = cards.filter((card) => session.progressById[card.id]?.retired).length
  const dueNow = cards.filter((card) => {
    const progress = session.progressById[card.id]
    return progress.introduced && !progress.retired && progress.dueTurn <= session.turn
  }).length

  return {
    introduced,
    learned,
    dueNow,
    active: introduced
  }
}

export function answerCurrentCard(
  session: LearnSessionState,
  cards: Flashcard[],
  result: ReviewResult
): LearnSessionState {
  if (!session.currentCardId) {
    return session
  }

  const currentProgress = session.progressById[session.currentCardId]
  const updatedProgress: CardProgress = {
    ...currentProgress,
    introduced: true,
    seen: currentProgress.seen + 1,
    misses: result === 'missed' ? currentProgress.misses + 1 : currentProgress.misses,
    mastery: result === 'missed' ? Math.max(0, currentProgress.mastery - 1) : Math.min(5, currentProgress.mastery + 1),
    consecutiveCorrects: result === 'missed' ? 0 : currentProgress.consecutiveCorrects + 1,
    consecutiveMisses: result === 'missed' ? currentProgress.consecutiveMisses + 1 : 0,
    requiredCorrects:
      result === 'missed' ? Math.min(MAX_REQUIRED_CORRECTS, currentProgress.consecutiveMisses + 2) : currentProgress.requiredCorrects,
    dueTurn: 0,
    lastResult: result
  }

  session = {
    ...session,
    turn: session.turn + 1,
    progressById: {
      ...session.progressById,
      [session.currentCardId]: updatedProgress
    }
  }

  const progressAfterAnswer = session.progressById[session.currentCardId]
  const shouldRetire = result === 'understood' && progressAfterAnswer.consecutiveCorrects >= progressAfterAnswer.requiredCorrects

  if (shouldRetire) {
    session.progressById[session.currentCardId] = {
      ...progressAfterAnswer,
      retired: true,
      dueTurn: Number.POSITIVE_INFINITY
    }
  } else {
    session.progressById[session.currentCardId] = {
      ...progressAfterAnswer,
      dueTurn: session.turn + nextGap(progressAfterAnswer)
    }
  }

  if (session.unseenIds.length > 0) {
    const activeCount = cards.filter((card) => {
      const progress = session.progressById[card.id]
      return progress.introduced && !progress.retired
    }).length

    if (activeCount < session.activeWindow) {
      const nextUnseen = session.unseenIds[0]
      session.unseenIds = session.unseenIds.slice(1)
      session.progressById[nextUnseen] = {
        ...session.progressById[nextUnseen],
        introduced: true,
        dueTurn: session.turn,
        introducedTurn: session.turn
      }
    }
  }

  session.currentCardId = chooseNextCard(session, cards)

  return session
}
