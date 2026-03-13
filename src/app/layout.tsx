import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/shared/Providers'

export const metadata: Metadata = {
  title: 'Seatvio — AI Interview Simulation Platform',
  description: 'So real, you\'ll get nervous. Practice with AI interviewers who speak and behave like real people in a hyper-realistic Teams-style audio interview.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
