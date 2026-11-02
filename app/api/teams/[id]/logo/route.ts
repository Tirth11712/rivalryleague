import { NextResponse } from 'next/server'
import { serverError } from '@/lib/server/respond'
import { requireTeamOwner } from '@/lib/server/auth/token'
import { setTeamLogo } from '@/lib/server/services/ownerService'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const denied = requireTeamOwner(req, id)
    if (denied) return denied

    const { logo } = await req.json()
    const result = await setTeamLogo(id, logo ?? '')
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
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
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (err) {
    return serverError(err)
  }
}
