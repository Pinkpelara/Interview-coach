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
          onboardingDone: user.onboardingDone,
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
        token.onboardingDone = (user as { onboardingDone?: boolean }).onboardingDone ?? false
      }

      // Keep onboarding state in sync with DB so post-onboarding redirects
      // do not get stuck on stale JWT flags.
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { onboardingDone: true },
        })
        token.onboardingDone = dbUser?.onboardingDone ?? false
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string; onboardingDone?: boolean }).id = token.id as string
        ;(session.user as { id: string; onboardingDone?: boolean }).onboardingDone = Boolean(token.onboardingDone)
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  pages: {
    signIn: '/signin',
    newUser: '/onboarding',
  },
}
