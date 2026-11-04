import { NextResponse } from 'next/server'
import { reply, serverError } from '@/lib/server/respond'
import { requireAuth } from '@/lib/server/auth/token'
import { getOwnerLoginId, setOwnerLogin } from '@/lib/server/services/ownerService'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Ctx) {
  const denied = requireAuth(req)
  if (denied) return denied

  try {
    const { id } = await params
    return NextResponse.json({ success: true, loginId: await getOwnerLoginId(id) })
  } catch (err) {
    return serverError(err)
  }
}

export async function POST(req: Request, { params }: Ctx) {
  const denied = requireAuth(req)
  if (denied) return denied

  try {
    const { id } = await params
    const { teamName, ownerName, loginId, password } = await req.json()
    const result = await setOwnerLogin(id, { teamName, ownerName, loginId, password })
    return reply(result)
  } catch (err) {
    return serverError(err)
  }
}
