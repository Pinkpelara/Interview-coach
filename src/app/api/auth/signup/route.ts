import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, fullName } = body

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: 'All fields are required.' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const verifyToken = crypto.randomBytes(24).toString('hex')

    await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        fullName: fullName.trim(),
        passwordHash: hashedPassword,
        emailVerified: true,
        verifyToken,
      },
    })

    return NextResponse.json(
      {
        message: 'Account created successfully. You can now sign in.',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Signup error:', error)

    const message = error instanceof Error ? error.message : ''

    if (message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
