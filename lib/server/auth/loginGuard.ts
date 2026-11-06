import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { getSqlClient, withSql } from '../db'

const MAX_FAILURES = 8
const WINDOW_MINUTES = 15

// Serverless instances share no memory, so hosted counts live in Postgres. Local runs use this map.
const localAttempts = new Map<string, { failures: number; firstAt: number }>()
let tableReady = false

async function db() {
  const sql = getSqlClient()
  if (sql && !tableReady) {
    await withSql(sql => sql`
      CREATE TABLE IF NOT EXISTS login_attempts (
        key VARCHAR(64) PRIMARY KEY,
        failures INT NOT NULL,
        first_failed_at TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `)
    tableReady = true
  }
  return sql
}

/** One account from one network, so a stranger cannot lock the real owner out from elsewhere. */
export function attemptKey(account: string, req: Request): string {
  const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  return createHash('sha256').update(`${account}|${ip}`).digest('hex').slice(0, 64)
}

export async function isLocked(key: string): Promise<boolean> {
  const sql = await db()
  if (sql) {
    const rows = (await withSql(sql => sql`
      SELECT 1 FROM login_attempts
      WHERE key = ${key} AND failures >= ${MAX_FAILURES}
        AND first_failed_at > NOW() - INTERVAL '15 minutes';
    `)) as unknown as unknown[]
    return rows.length > 0
  }
  const entry = localAttempts.get(key)
  return !!entry && entry.failures >= MAX_FAILURES && Date.now() - entry.firstAt < WINDOW_MINUTES * 60_000
}

export async function recordFailure(key: string): Promise<void> {
  const sql = await db()
  if (sql) {
    await withSql(sql => sql`
      INSERT INTO login_attempts (key, failures, first_failed_at) VALUES (${key}, 1, NOW())
      ON CONFLICT (key) DO UPDATE SET
        failures = CASE WHEN login_attempts.first_failed_at < NOW() - INTERVAL '15 minutes' THEN 1 ELSE login_attempts.failures + 1 END,
        first_failed_at = CASE WHEN login_attempts.first_failed_at < NOW() - INTERVAL '15 minutes' THEN NOW() ELSE login_attempts.first_failed_at END;
    `)
    return
  }
  const entry = localAttempts.get(key)
  if (!entry || Date.now() - entry.firstAt >= WINDOW_MINUTES * 60_000) {
    localAttempts.set(key, { failures: 1, firstAt: Date.now() })
  } else {
    entry.failures++
  }
}

export async function clearFailures(key: string): Promise<void> {
  const sql = await db()
  if (sql) await withSql(sql => sql`DELETE FROM login_attempts WHERE key = ${key};`)
  else localAttempts.delete(key)
}

export function tooManyAttempts(): NextResponse {
  return NextResponse.json(
    { success: false, message: `Too many wrong tries. Please wait ${WINDOW_MINUTES} minutes and try again.` },
    { status: 429 }
  )
}
