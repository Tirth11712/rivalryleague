import { NextResponse } from 'next/server'
import { reply, serverError } from '@/lib/server/respond'
import { readDb } from '@/lib/server/db'
import { requireTeamOwner } from '@/lib/server/auth/token'
import { setTeamLogo } from '@/lib/server/services/ownerService'

type Ctx = { params: Promise<{ id: string }> }

/** The logo as an image. Its link changes whenever the logo does, so phones may keep it for good. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const logo = (await readDb()).teams.find(t => t.id === id)?.logo
    const match = logo?.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/)
    if (!match) return new NextResponse(null, { status: 404 })
    return new NextResponse(Buffer.from(match[2], 'base64'), {
      headers: { 'Content-Type': match[1], 'Cache-Control': 'public, max-age=31536000, immutable' }
    })
  } catch (err) {
    return serverError(err)
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const denied = requireTeamOwner(req, id)
    if (denied) return denied

    const { logo } = await req.json()
    const result = await setTeamLogo(id, logo ?? '')
    return reply(result)
  } catch (err) {
    return serverError(err)
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const denied = requireTeamOwner(req, id)
    if (denied) return denied

    const result = await setTeamLogo(id, null)
    return reply(result)
  } catch (err) {
    return serverError(err)
  }
}
