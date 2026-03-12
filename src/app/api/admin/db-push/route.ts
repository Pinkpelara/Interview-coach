import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(request: Request) {
  // Simple secret check to prevent unauthorized access
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (secret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { stdout, stderr } = await execAsync('npx prisma db push --accept-data-loss', {
      timeout: 30000,
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
