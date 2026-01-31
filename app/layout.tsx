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
      <body className="flex flex-col min-h-screen safe-area-padding">
        <main className="relative z-10 w-full max-w-full overflow-x-hidden flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
