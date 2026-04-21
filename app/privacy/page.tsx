import type { Metadata } from 'next'
import PrivacyContent from './PrivacyContent'

export const metadata: Metadata = {
  title: 'Privacy Policy | Demo Feedback System',
  description: 'Privacy Policy for the Demo Feedback System.',
}

export default function PrivacyPage() {
  return <PrivacyContent />
}
