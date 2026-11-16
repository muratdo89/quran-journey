/**
 * Page-by-page hifz plan (sebak / sebki / manzil), kept pure so it is easy to test.
 *
 * The unit is a Mushaf page. Each day:
 *  1. Yeni ders (sebak): one part of the current page (a quarter, half or the whole page).
 *  2. Yakın tekrar (sebki): every page memorized in the last 7 days.
 *  3. Eski tekrar (manzil): a rotating slice of older memorized pages, weakest first.
 * Rule from hifz teachers: if a recent page is weak ("Takıldım"), no new page until it is solid.
 */

export type HifzDirection = "backward" | "forward";
export type HifzDailyParts = 1 | 2 | 4;
export type HifzRating = "akici" | "takildim" | "unuttum";

export interface HifzSettings {
  startPage: number;
  /** backward: 604 → 1 (Amme cüzünden geriye), forward: 1 → 604. */
  direction: HifzDirection;
  /** How many days one page takes: 1 = tam sayfa, 2 = yarım, 4 = çeyrek. */
  dailyParts: HifzDailyParts;
}

export interface HifzPageState {
  status: "learning" | "memorized";
  partsDone: number;
  partCount: number;
  memorizedOn?: string;
  lastReviewedOn?: string;
  weak?: boolean;
}

export interface HifzStore {
  version: 1;
  settings: HifzSettings | null;
  pages: Record<string, HifzPageState>;
  /** Day the new lesson was finished (no second new part that day unless asked). */
  newDoneOn?: string;
  /** Verses memorized in the older (surah-based) Ezber page were brought over once. */
  importedLegacy?: boolean;
}

export const TOTAL_PAGES = 604;
export const RECENT_DAYS = 7;
export const MAX_MANZIL_PAGES = 7;

export const EMPTY_HIFZ_STORE: HifzStore = { version: 1, settings: null, pages: {} };

export const DAILY_PART_OPTIONS: { value: HifzDailyParts; labelTr: string; hintTr: string }[] = [
  { value: 4, labelTr: "Çeyrek sayfa", hintTr: "Bir sayfa 4 günde" },
  { value: 2, labelTr: "Yarım sayfa", hintTr: "Bir sayfa 2 günde" },
  { value: 1, labelTr: "Tam sayfa", hintTr: "Her gün bir sayfa" },
];

/* ---------- dates ---------- */

export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayDiff(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/* ---------- splitting a page ---------- */

/**
 * Splits verse indices into `partCount` consecutive parts of similar text length.
 * Never makes more parts than verses.
 */
export function splitIntoParts(lengths: number[], partCount: number): number[][] {
  const n = lengths.length;
  if (n === 0) return [];
  const count = Math.max(1, Math.min(partCount, n));
  const total = lengths.reduce((a, b) => a + b, 0);
  const parts: number[][] = [];
  let current: number[] = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    current.push(i);
    acc += lengths[i]!;
    const partsLeft = count - parts.length - 1;
    const versesLeft = n - i - 1;
    const target = (total * (parts.length + 1)) / count;
    // Close the part once it reaches its share, but leave at least one verse per remaining part.
    if (partsLeft > 0 && (acc >= target || versesLeft === partsLeft)) {
      parts.push(current);
      current = [];
    }
  }
  if (current.length > 0) parts.push(current);
  return parts;
}

/**
 * Splits one part into small chunks: at most 5 verses and ~250 letters, one long verse alone.
 * A chunk never runs across a surah start (`breaksBefore` holds the indices that start a surah).
 */
export function splitIntoChunks(
  indices: number[],
  lengths: number[],
  breaksBefore: ReadonlySet<number> = new Set(),
  maxLetters = 250,
  maxVerses = 5
): number[][] {
  const chunks: number[][] = [];
  let current: number[] = [];
  let acc = 0;
  for (const i of indices) {
    const len = lengths[i] ?? 0;
    if (current.length > 0 && (breaksBefore.has(i) || acc + len > maxLetters || current.length >= maxVerses)) {
      chunks.push(current);
      current = [];
      acc = 0;
    }
    current.push(i);
    acc += len;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/* ---------- page order ---------- */

export function pageOrder(settings: HifzSettings): number[] {
  const out: number[] = [];
  if (settings.direction === "backward") {
    for (let p = settings.startPage; p >= 1; p--) out.push(p);
  } else {
    for (let p = settings.startPage; p <= TOTAL_PAGES; p++) out.push(p);
  }
  return out;
}

/** The page being learned now: a page already started first, then the next unmemorized one. */
export function currentNewPage(store: HifzStore): number | null {
  if (!store.settings) return null;
  const order = pageOrder(store.settings);
  const learning = order.find((p) => store.pages[p]?.status === "learning");
  if (learning) return learning;
  // Pages relearned after "Unuttum" may sit outside the order (start page changed): still first.
  const anyLearning = Object.entries(store.pages).find(([, s]) => s.status === "learning");
  if (anyLearning) return Number(anyLearning[0]);
  return order.find((p) => store.pages[p]?.status !== "memorized") ?? null;
}

/* ---------- today's plan ---------- */

export interface NewLessonPlan {
  page: number;
  partIndex: number;
  partCount: number;
  isRelearn: boolean;
}

export interface TodayPlan {
  /** The new lesson still to do today (null when done, blocked or nothing left). */
  newLesson: NewLessonPlan | null;
  newDoneToday: boolean;
  /** Recent weak pages that must be solid before a new page (shown first). */
  blockedBy: number[];
  /** Pages memorized in the last 7 days, not yet reviewed today. */
  recent: number[];
  /** Older pages due today, not yet reviewed. */
  manzil: number[];
  /** Pages reviewed today (for the progress line). */
  reviewedToday: number;
  memorizedCount: number;
}

function memorizedPages(store: HifzStore): Array<[number, HifzPageState]> {
  return Object.entries(store.pages)
    .filter(([, s]) => s.status === "memorized")
    .map(([p, s]) => [Number(p), s] as [number, HifzPageState]);
}

function isRecent(s: HifzPageState, today: string): boolean {
  return !!s.memorizedOn && dayDiff(s.memorizedOn, today) < RECENT_DAYS;
}

export function manzilQuota(memorizedCount: number): number {
  if (memorizedCount === 0) return 0;
  return Math.min(MAX_MANZIL_PAGES, Math.max(1, Math.ceil(memorizedCount / RECENT_DAYS)));
}

export function buildTodayPlan(store: HifzStore, today: string = dayKey()): TodayPlan {
  const memorized = memorizedPages(store);
  const reviewedToday = memorized.filter(([, s]) => s.lastReviewedOn === today && s.memorizedOn !== today).length;

  const recentAll = memorized.filter(([, s]) => isRecent(s, today));
  const blockedBy = recentAll.filter(([, s]) => s.weak).map(([p]) => p);
  const recent = recentAll
    .filter(([, s]) => s.lastReviewedOn !== today && s.memorizedOn !== today)
    .sort((a, b) => Number(!!b[1].weak) - Number(!!a[1].weak) || (b[1].memorizedOn ?? "").localeCompare(a[1].memorizedOn ?? ""))
    .map(([p]) => p);

  const older = memorized.filter(([, s]) => !isRecent(s, today));
  const olderDoneToday = older.filter(([, s]) => s.lastReviewedOn === today).length;
  const quota = Math.max(0, manzilQuota(memorized.length) - olderDoneToday);
  const manzil = older
    .filter(([, s]) => s.lastReviewedOn !== today)
    .sort((a, b) => {
      if (!!a[1].weak !== !!b[1].weak) return a[1].weak ? -1 : 1;
      const la = a[1].lastReviewedOn ?? a[1].memorizedOn ?? "";
      const lb = b[1].lastReviewedOn ?? b[1].memorizedOn ?? "";
      return la.localeCompare(lb) || a[0] - b[0];
    })
    .slice(0, quota)
    .map(([p]) => p);

  const newDoneToday = store.newDoneOn === today;
  let newLesson: NewLessonPlan | null = null;
  if (!newDoneToday && blockedBy.length === 0 && store.settings) {
    const page = currentNewPage(store);
    if (page !== null) {
      const state = store.pages[page];
      const started = state?.status === "learning" && state.partsDone > 0;
      const partCount = started ? state.partCount : store.settings.dailyParts;
      newLesson = {
        page,
        partIndex: started ? Math.min(state.partsDone, partCount - 1) : 0,
        partCount,
        isRelearn: !!state?.memorizedOn,
      };
    }
  }

  return { newLesson, newDoneToday, blockedBy, recent, manzil, reviewedToday, memorizedCount: memorized.length };
}

export type HifzQueueItem =
  | { kind: "new"; lesson: NewLessonPlan }
  | { kind: "recent"; page: number }
  | { kind: "manzil"; page: number };

/** Today's order: weak recent pages first (they unblock the new lesson), new lesson, other reviews. */
export function buildQueue(plan: TodayPlan): HifzQueueItem[] {
  const blocked = new Set(plan.blockedBy);
  const items: HifzQueueItem[] = [];
  for (const p of plan.recent) if (blocked.has(p)) items.push({ kind: "recent", page: p });
  if (plan.newLesson) items.push({ kind: "new", lesson: plan.newLesson });
  for (const p of plan.recent) if (!blocked.has(p)) items.push({ kind: "recent", page: p });
  for (const p of plan.manzil) items.push({ kind: "manzil", page: p });
  return items;
}

export function estimateMinutes(plan: TodayPlan): number {
  const newMinutes = plan.newLesson ? Math.round(18 / plan.newLesson.partCount) + 4 : 0;
  return newMinutes + (plan.recent.length + plan.manzil.length) * 2;
}

/* ---------- updates (return a new store) ---------- */

export function saveSettings(store: HifzStore, settings: HifzSettings): HifzStore {
  return { ...store, settings };
}

/** A part of the new page is learned. The last part is finished by `ratePage` instead. */
export function completeNewPart(store: HifzStore, lesson: NewLessonPlan, today: string = dayKey()): HifzStore {
  const prev = store.pages[lesson.page];
  return {
    ...store,
    newDoneOn: today,
    pages: {
      ...store.pages,
      [lesson.page]: {
        ...prev,
        status: "learning",
        partCount: lesson.partCount,
        partsDone: Math.min(lesson.partIndex + 1, lesson.partCount),
      },
    },
  };
}

/**
 * Rates a whole page recited from memory: at the end of a new page, or in a review.
 * Akıcı: solid. Takıldım: kept, but weak (comes back tomorrow, blocks a new page while recent).
 * Unuttum: back to learning from the first part.
 */
export function ratePage(
  store: HifzStore,
  page: number,
  rating: HifzRating,
  opts: { fromNewLesson?: boolean; partCount?: number } = {},
  today: string = dayKey()
): HifzStore {
  const prev = store.pages[page];
  const partCount = opts.partCount ?? prev?.partCount ?? store.settings?.dailyParts ?? 1;
  let next: HifzPageState;
  if (rating === "unuttum") {
    next = { ...prev, status: "learning", partsDone: 0, partCount, weak: false, lastReviewedOn: today };
  } else {
    next = {
      ...prev,
      status: "memorized",
      partCount,
      partsDone: partCount,
      memorizedOn: opts.fromNewLesson || !prev?.memorizedOn ? today : prev.memorizedOn,
      lastReviewedOn: today,
      weak: rating === "takildim",
    };
  }
  return {
    ...store,
    newDoneOn: opts.fromNewLesson ? today : store.newDoneOn,
    pages: { ...store.pages, [page]: next },
  };
}

function addDays(day: string, delta: number): string {
  const d = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)));
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * Brings over pages fully memorized in the older, surah-based Ezber page (once). They join the
 * older-review rotation (manzil) rather than the daily recent review, and never overwrite
 * a page the hifz plan already tracks.
 */
export function importLegacyPages(store: HifzStore, pages: number[], today: string = dayKey()): HifzStore {
  if (store.importedLegacy) return store;
  const since = addDays(today, -RECENT_DAYS);
  const next = { ...store.pages };
  for (const p of pages) {
    if (!Number.isInteger(p) || p < 1 || p > TOTAL_PAGES || next[p]) continue;
    next[p] = { status: "memorized", partsDone: 1, partCount: 1, memorizedOn: since, lastReviewedOn: since };
  }
  return { ...store, pages: next, importedLegacy: true };
}

/**
 * "Ezberlediğim yerler": the learner marks what they already know by heart.
 * Newly marked pages go straight into older review (manzil); pages taken off the list are cleared.
 * Pages the app is tracking (memorized here or being learned) and still marked keep their history.
 */
export function setMemorizedPages(store: HifzStore, marked: Iterable<number>, today: string = dayKey()): HifzStore {
  const want = new Set([...marked].filter((p) => Number.isInteger(p) && p >= 1 && p <= TOTAL_PAGES));
  const since = addDays(today, -RECENT_DAYS);
  const next: HifzStore["pages"] = {};
  for (const [key, state] of Object.entries(store.pages)) {
    const p = Number(key);
    if (state.status === "memorized" && !want.has(p)) continue;
    next[p] = state;
  }
  for (const p of want) {
    if (next[p]?.status === "memorized") continue;
    next[p] = { status: "memorized", partsDone: 1, partCount: 1, memorizedOn: since, lastReviewedOn: since };
  }
  return { ...store, pages: next };
}

/** "Bir parça daha": lets the learner take the next new part today. */
export function allowAnotherNewPart(store: HifzStore): HifzStore {
  return { ...store, newDoneOn: undefined };
}

export function normalizeHifzStore(raw: unknown): HifzStore {
  if (!raw || typeof raw !== "object") return EMPTY_HIFZ_STORE;
  const r = raw as Partial<HifzStore>;
  const s = r.settings;
  const settings: HifzSettings | null =
    s && typeof s === "object" && Number.isInteger(s.startPage) && s.startPage >= 1 && s.startPage <= TOTAL_PAGES
      ? {
          startPage: s.startPage,
          direction: s.direction === "forward" ? "forward" : "backward",
          dailyParts: s.dailyParts === 1 || s.dailyParts === 4 ? s.dailyParts : 2,
        }
      : null;
  const pages: Record<string, HifzPageState> = {};
  if (r.pages && typeof r.pages === "object") {
    for (const [k, v] of Object.entries(r.pages)) {
      const p = Number(k);
      if (!Number.isInteger(p) || p < 1 || p > TOTAL_PAGES || !v || typeof v !== "object") continue;
      if (v.status !== "learning" && v.status !== "memorized") continue;
      pages[k] = v;
    }
  }
  return {
    version: 1,
    settings,
    pages,
    newDoneOn: typeof r.newDoneOn === "string" ? r.newDoneOn : undefined,
    importedLegacy: r.importedLegacy === true ? true : undefined,
  };
}
