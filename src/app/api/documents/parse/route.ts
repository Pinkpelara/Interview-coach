import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const MAX_FILE_BYTES = 8 * 1024 * 1024

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'Uploaded file is empty.' }, { status: 400 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'File is too large. Maximum size is 8MB.' }, { status: 400 })
    }

    const mime = file.type || ''
    const filename = file.name.toLowerCase()
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    let text = ''
    if (mime === 'application/pdf' || filename.endsWith('.pdf')) {
      const pdfModule = await import('pdf-parse')
      const parsePdf =
        (pdfModule as unknown as { default?: (input: Buffer) => Promise<{ text?: string }> }).default
        || (pdfModule as unknown as { pdfParse?: (input: Buffer) => Promise<{ text?: string }> }).pdfParse
        || (pdfModule as unknown as (input: Buffer) => Promise<{ text?: string }>)
      const parsed = await parsePdf(buffer)
      text = parsed.text || ''
    } else if (
      mime.startsWith('text/') ||
      filename.endsWith('.txt') ||
      filename.endsWith('.md')
    ) {
      text = buffer.toString('utf8')
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Upload PDF or text files.' },
        { status: 400 }
      )
    }

    const normalized = text.replace(/\r\n/g, '\n').replace(/\u0000/g, '').trim()
    if (!normalized) {
      return NextResponse.json(
        { error: 'Could not extract readable text from this document. Try another file.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ text: normalized })
  } catch (error) {
    console.error('Document parse error:', error)
    return NextResponse.json(
      { error: 'Failed to parse document. Please try again.' },
      { status: 500 }
    )
  }
}
