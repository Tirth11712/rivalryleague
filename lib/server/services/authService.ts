import { readDb, writeDb, DatabaseSchema } from '../db'
import { hashPassword, passwordMatches } from '../auth/password'

type AuthResult = { success: boolean; message: string; wrongPassword?: boolean }

function isCorrect(db: DatabaseSchema, password: string): boolean {
  const { pinHash, pin } = db.auctioneer || {}
  if (pinHash) return passwordMatches(password.trim(), pinHash)
  return password.trim() === (pin || '1234').trim()
}

function storePassword(db: DatabaseSchema, password: string) {
  db.auctioneer.pinHash = hashPassword(password.trim())
  delete db.auctioneer.pin
}

export async function verifyAuctioneerPin(pin: string): Promise<AuthResult> {
  const db = await readDb()
  if (!isCorrect(db, pin)) return { success: false, message: 'Wrong superadmin password', wrongPassword: true }

  // Older data keeps the password as plain text: replace it on the first good sign-in
  if (!db.auctioneer?.pinHash) {
    storePassword(db, pin)
    await writeDb(db).catch(err => console.error('[auth] could not upgrade password storage:', err))
  }
  return { success: true, message: 'Signed in' }
}

export async function updateAuctioneerPin(currentPin: string, newPin: string): Promise<AuthResult> {
  const db = await readDb()
  if (!isCorrect(db, currentPin)) {
    return { success: false, message: 'Current password is incorrect', wrongPassword: true }
  }
  if (!newPin || newPin.trim().length < 6) {
    return { success: false, message: 'New password must be at least 6 characters' }
  }
  storePassword(db, newPin)
  await writeDb(db)
  return { success: true, message: 'Password updated' }
}
