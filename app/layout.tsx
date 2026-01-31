import type { Metadata, Viewport } from 'next'
import './globals.css'
import Footer from './components/Footer'

export const metadata: Metadata = {
  title: 'Demo Feedback System',
  description: 'Submit and review music demos',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen flex flex-col min-h-[100dvh] safe-area-padding">
        <main className="flex-1 relative z-10 w-full max-w-full overflow-x-hidden">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
