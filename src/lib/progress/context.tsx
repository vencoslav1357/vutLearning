"use client";

/**
 * React vrstva nad `ProgressStore`.
 *
 * Store žije jen v prohlížeči – IndexedDB na serveru není. Při renderu na
 * serveru je proto `store` null a hooky vracejí prázdné hodnoty; skutečná
 * data dorazí až po připojení, takže se nerozchází serverové a klientské HTML.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { getProgressStore } from "./index";
import type { ObservableProgressStore, StorageKind } from "./local";
import type {
  AttemptRecord,
  CourseSummary,
  QuestionState,
  UserPrefs,
} from "./types";
import { summarizeCourse } from "@/lib/srs/mastery";

// Stabilní prázdná pole – nová by při každém renderu shodila memoizaci.
const EMPTY_STATES: QuestionState[] = [];
const EMPTY_ATTEMPTS: AttemptRecord[] = [];

interface ProgressContextValue {
  store: ObservableProgressStore | null;
  /** Roste po každém zápisu – donutí dotazy k přenačtení i bez Dexie. */
  revision: number;
  storageKind: StorageKind | null;
  /** Rozlišuje skutečný provider od výchozí hodnoty kontextu. */
  provided: boolean;
}

const ProgressContext = createContext<ProgressContextValue>({
  store: null,
  revision: 0,
  storageKind: null,
  provided: false,
});

/**
 * Store je singleton a existuje jen v prohlížeči. `useSyncExternalStore` je
 * jediný hook, který umí vrátit jinou hodnotu na serveru (`null`) než na
 * klientovi, aniž by se rozešla hydratace – React se sám překreslí až po
 * připojení. Odběr proto nic neposlouchá, jen si o to překreslení řekne.
 */
function subscribeAfterMount(onStoreChange: () => void): () => void {
  // Běží až po připojení, takže tady se instance poprvé smí vyrobit.
  onStoreChange();
  return () => {};
}

const noSubscribe = () => () => {};
const noStore = (): ObservableProgressStore | null => null;
const clientStore = (): ObservableProgressStore | null => getProgressStore();

/**
 * Připojí se ke store a hlídá jeho změny. Store je singleton, takže na
 * počtu volajících nezáleží – jen se přidá další odběratel.
 */
function useProgressRuntime(enabled: boolean): ProgressContextValue {
  const [revision, setRevision] = useState(0);
  const [storageKind, setStorageKind] = useState<StorageKind | null>(null);

  const store = useSyncExternalStore(
    enabled ? subscribeAfterMount : noSubscribe,
    enabled ? clientStore : noStore,
    noStore,
  );

  useEffect(() => {
    if (!store) return;
    let alive = true;

    const unsubscribe = store.onChange(() => {
      if (alive) setRevision((r) => r + 1);
    });
    void store.storageKind().then((kind) => {
      if (alive) setStorageKind(kind);
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, [store]);

  return useMemo<ProgressContextValue>(
    () => ({ store, revision, storageKind, provided: true }),
    [store, revision, storageKind],
  );
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const value = useProgressRuntime(true);
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

/**
 * Bez `<ProgressProvider>` si hook store obstará sám. Provider je i tak
 * lepší – drží jedno přihlášení k odběru pro celý strom místo jednoho
 * na komponentu.
 */
function useProgressContext(): ProgressContextValue {
  const context = useContext(ProgressContext);
  const standalone = useProgressRuntime(!context.provided);
  return context.provided ? context : standalone;
}

/**
 * Samotný store. Na serveru a při prvním renderu je null –
 * zápisy je potřeba volat až z event handleru, kde už store existuje.
 */
export function useProgress(): ObservableProgressStore | null {
  return useProgressContext().store;
}

/** Kde pokrok leží. `memory` znamená, že se po zavření karty ztratí. */
export function useStorageKind(): StorageKind | null {
  return useProgressContext().storageKind;
}

/** Stav učení jedné otázky. `undefined`, dokud se nenačte nebo když neexistuje. */
export function useQuestionState(questionId: string | null | undefined): QuestionState | undefined {
  const { store, revision } = useProgressContext();
  return useLiveQuery(
    () => (store && questionId ? store.getQuestionState(questionId) : undefined),
    [store, revision, questionId],
  );
}

/** Stavy celého předmětu. */
export function useCourseStates(course: string | null | undefined): QuestionState[] {
  const { store, revision } = useProgressContext();
  const states = useLiveQuery(
    () => (store && course ? store.getStatesForCourse(course) : undefined),
    [store, revision, course],
  );
  return states ?? EMPTY_STATES;
}

/** Souhrn pro dlaždici předmětu. `total` je počet otázek v obsahu. */
export function useCourseSummary(course: string, total: number): CourseSummary {
  const states = useCourseStates(course);
  return useMemo(
    () => summarizeCourse(states, total, { course }),
    [states, total, course],
  );
}

/** Otázky, které jsou na řadě k opakování. */
export function useDueQuestions(course?: string, limit?: number): QuestionState[] {
  const { store, revision } = useProgressContext();
  const due = useLiveQuery(
    () => (store ? store.getDueQuestions(course, limit) : undefined),
    [store, revision, course, limit],
  );
  return due ?? EMPTY_STATES;
}

/** Otázky s poslední odpovědí špatně – podklad pro režim „chyby". */
export function useMistakes(course?: string, limit?: number): QuestionState[] {
  const { store, revision } = useProgressContext();
  const mistakes = useLiveQuery(
    () => (store ? store.getMistakes(course, limit) : undefined),
    [store, revision, course, limit],
  );
  return mistakes ?? EMPTY_STATES;
}

/** Posledních `limit` pokusů, nejnovější první. */
export function useRecentAttempts(limit: number): AttemptRecord[] {
  const { store, revision } = useProgressContext();
  const attempts = useLiveQuery(
    () => (store ? store.getRecentAttempts(limit) : undefined),
    [store, revision, limit],
  );
  return attempts ?? EMPTY_ATTEMPTS;
}

export interface StreakInfo {
  current: number;
  longest: number;
  lastDay: string | null;
}

const NO_STREAK: StreakInfo = { current: 0, longest: 0, lastDay: null };

/** Série dnů v řadě. */
export function useStreak(): StreakInfo {
  const { store, revision } = useProgressContext();
  const streak = useLiveQuery(
    () => (store ? store.getStreak() : undefined),
    [store, revision],
  );
  return streak ?? NO_STREAK;
}

/**
 * Nastavení uživatele. `undefined`, dokud se nenačte – komponenty si
 * do té doby drží vlastní výchozí hodnotu (`prefs?.sessionSize ?? 15`).
 * Zapisuje se přes `useProgress().setPrefs()`.
 */
export function usePrefs(): UserPrefs | undefined {
  const { store, revision } = useProgressContext();
  return useLiveQuery(() => (store ? store.getPrefs() : undefined), [store, revision]);
}
