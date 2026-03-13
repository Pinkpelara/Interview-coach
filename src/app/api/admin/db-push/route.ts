import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(request: Request) {
  // Protect with admin secret OR NextAuth session
  const { token } = await request.json().catch(() => ({ token: '' }))
  const adminSecret = process.env.ADMIN_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET

  if (!adminSecret || token !== adminSecret) {
    return NextResponse.json({ error: 'Invalid admin token' }, { status: 401 })
  }

  try {
    const { stdout, stderr } = await execAsync('npx prisma db push --accept-data-loss', {
      timeout: 60000,
      env: { ...process.env },
    })

    return NextResponse.json({
      success: true,
      stdout: stdout.toString(),
      stderr: stderr.toString(),
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || '',
    }, { status: 500 })
  }
}
