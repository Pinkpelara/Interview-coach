import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user) return null
        if (!user.emailVerified) return null

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!isValid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          onboarded: user.onboarded,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.onboarded = (user as { onboarded?: boolean }).onboarded ?? false
      }

      // Keep onboarding state in sync with DB so post-onboarding redirects
      // do not get stuck on stale JWT flags.
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { onboarded: true },
        })
        token.onboarded = dbUser?.onboarded ?? false
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string; onboarded?: boolean }).id = token.id as string
        ;(session.user as { id: string; onboarded?: boolean }).onboarded = Boolean(token.onboarded)
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
    newUser: '/onboarding',
  },
}
