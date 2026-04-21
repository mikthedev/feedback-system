import type { Metadata } from 'next'
import TermsContent from './TermsContent'

export const metadata: Metadata = {
  title: 'Terms of Service | Demo Feedback System',
  description: 'Terms of Service for the Demo Feedback System.',
}

export default function TermsPage() {
  return <TermsContent />
}
