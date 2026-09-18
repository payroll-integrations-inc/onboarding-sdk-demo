import type { OnboardingAggregate } from "./types";
import type { Scenario } from "../shared/token";

/**
 * In-memory state of the emulated backend.
 *
 * Mirrored to sessionStorage so that reloading the frame behaves like the real
 * product (the session cookie survives and the start screen resumes where the
 * user left off). Re-running the demo from the host page mints a token with a
 * fresh onboardingUserId, so every click starts a clean onboarding.
 */
export interface DivisionFlags {
  /** How many times `verify` has been called; Acme fails the first time, like a platform awaiting consent. */
  verifyCount: number;
  /** Whether the OAuth popup completed for this division. */
  oauthAuthorized: boolean;
}

export interface MockDb {
  /** Stands in for the `ExchangedJwt` session cookie the real token exchange sets. */
  session: { onboardingUserId: string; scenario: Scenario } | null;
  users: Record<string, OnboardingAggregate>;
  divisionFlags: Record<string, DivisionFlags>;
  nextId: number;
}

const STORAGE_KEY = "pi-demo-db";

function emptyDb(): MockDb {
  return { session: null, users: {}, divisionFlags: {}, nextId: 1 };
}

let db: MockDb | undefined;

function storage(): Storage | undefined {
  try {
    return typeof sessionStorage === "undefined" ? undefined : sessionStorage;
  } catch {
    return undefined; // access can throw under strict privacy settings
  }
}

export function getDb(): MockDb {
  if (db) return db;
  const raw = storage()?.getItem(STORAGE_KEY);
  if (raw) {
    try {
      db = JSON.parse(raw) as MockDb;
      return db;
    } catch {
      /* fall through to a clean db */
    }
  }
  db = emptyDb();
  return db;
}

export function persistDb(): void {
  if (!db) return;
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* quota / privacy mode: keep working in memory only */
  }
}

export function resetDb(): void {
  db = emptyDb();
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function nextId(prefix = ""): string {
  const current = getDb();
  const id = current.nextId++;
  return `${prefix}${id}`;
}

export function flagsFor(divisionId: string): DivisionFlags {
  const current = getDb();
  return (current.divisionFlags[divisionId] ??= { verifyCount: 0, oauthAuthorized: false });
}
