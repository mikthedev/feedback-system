'use client'

import Link from 'next/link'
import { useLanguage } from '@/app/context/LanguageContext'

const PRIVACY_COPY = {
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: April 21, 2026',
    intro:
      'This Privacy Policy explains what information the Demo Feedback System gathers and how it is used to support safe, meaningful engagement with MikeGTC.',
    collectTitle: 'What We Collect',
    collectBody:
      'Depending on your activity, the system may collect account identifiers (such as Twitch user details), submitted demo links and messages, queue/review status, and interaction-related metadata needed to run the platform.',
    useTitle: 'How We Use It',
    useBody:
      'Data is used to authenticate users, manage demo submissions, support moderation, provide feedback workflows, and improve the experience for MikeGTC community engagement.',
    noAdsTitle: 'No Advertising or Ad Targeting',
    noAdsBody:
      'We do not use collected information for advertising, ad profiling, or selling user data to advertisers. Platform activity is handled for operational safety and community interaction purposes only.',
    safetyTitle: 'Security and Safety',
    safetyBody:
      'We use reasonable technical and organizational measures to protect information and keep user actions safe within the platform.',
    contactTitle: 'Contact',
    contactPrefix: 'For privacy questions, contact',
    readOur: 'Read our',
    terms: 'Terms of Service',
  },
  uk: {
    title: 'Політика конфіденційності',
    updated: 'Останнє оновлення: 21 квітня 2026',
    intro:
      'Ця Політика конфіденційності пояснює, які дані збирає Demo Feedback System і як вони використовуються для безпечної та змістовної взаємодії зі спільнотою MikeGTC.',
    collectTitle: 'Що ми збираємо',
    collectBody:
      'Залежно від вашої активності, система може збирати ідентифікатори акаунта (наприклад, дані користувача Twitch), надіслані демо-посилання та повідомлення, статус черги/огляду, а також технічні дані взаємодії, потрібні для роботи платформи.',
    useTitle: 'Як ми це використовуємо',
    useBody:
      'Дані використовуються для автентифікації користувачів, керування демо-заявками, модерації, підтримки процесів фідбеку та покращення взаємодії зі спільнотою MikeGTC.',
    noAdsTitle: 'Без реклами та рекламного таргетингу',
    noAdsBody:
      'Ми не використовуємо зібрану інформацію для реклами, рекламного профілювання чи продажу даних рекламодавцям. Активність на платформі обробляється лише для безпеки та взаємодії спільноти.',
    safetyTitle: 'Безпека та захист',
    safetyBody:
      'Ми застосовуємо розумні технічні та організаційні заходи для захисту інформації та безпеки дій користувачів на платформі.',
    contactTitle: 'Контакт',
    contactPrefix: 'З питань конфіденційності пишіть на',
    readOur: 'Ознайомтесь із',
    terms: 'Умовами користування',
  },
  de: {
    title: 'Datenschutzerklärung',
    updated: 'Zuletzt aktualisiert: 21. April 2026',
    intro:
      'Diese Datenschutzerklärung erklärt, welche Informationen das Demo Feedback System erfasst und wie sie verwendet werden, um eine sichere und sinnvolle Interaktion mit der MikeGTC-Community zu ermöglichen.',
    collectTitle: 'Welche Daten wir erfassen',
    collectBody:
      'Je nach deiner Aktivität kann das System Konto-Identifikatoren (z. B. Twitch-Nutzerdaten), eingereichte Demo-Links und Nachrichten, Warteschlangen-/Review-Status sowie Interaktionsmetadaten erfassen, die für den Betrieb der Plattform erforderlich sind.',
    useTitle: 'Wie wir sie verwenden',
    useBody:
      'Daten werden zur Authentifizierung, Verwaltung von Demo-Einreichungen, Moderation, Unterstützung von Feedback-Abläufen und zur Verbesserung der Community-Interaktion mit MikeGTC verwendet.',
    noAdsTitle: 'Keine Werbung oder Werbetargeting',
    noAdsBody:
      'Wir verwenden erfasste Informationen nicht für Werbung, Werbeprofiling oder den Verkauf von Nutzerdaten an Werbetreibende. Plattformaktivitäten werden ausschließlich für Betriebssicherheit und Community-Interaktion verarbeitet.',
    safetyTitle: 'Sicherheit und Schutz',
    safetyBody:
      'Wir nutzen angemessene technische und organisatorische Maßnahmen, um Informationen zu schützen und Nutzeraktionen auf der Plattform sicher zu halten.',
    contactTitle: 'Kontakt',
    contactPrefix: 'Bei Datenschutzfragen kontaktiere',
    readOur: 'Lies unsere',
    terms: 'Nutzungsbedingungen',
  },
} as const

export default function PrivacyContent() {
  const { locale } = useLanguage()
  const copy = PRIVACY_COPY[locale]

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl rounded-2xl border-2 border-gray-700/60 bg-background-light p-6 sm:p-8">
        <h1 className="text-3xl font-extrabold text-text-primary">{copy.title}</h1>
        <p className="mt-2 text-sm text-text-muted">{copy.updated}</p>

        <div className="mt-6 space-y-5 text-sm leading-relaxed text-text-secondary sm:text-base">
          <p>{copy.intro}</p>

          <section>
            <h2 className="mb-2 text-lg font-bold text-text-primary">{copy.collectTitle}</h2>
            <p>{copy.collectBody}</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-text-primary">{copy.useTitle}</h2>
            <p>{copy.useBody}</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-text-primary">{copy.noAdsTitle}</h2>
            <p>{copy.noAdsBody}</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-text-primary">{copy.safetyTitle}</h2>
            <p>{copy.safetyBody}</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-text-primary">{copy.contactTitle}</h2>
            <p>
              {copy.contactPrefix}{' '}
              <a className="underline underline-offset-2 hover:text-primary transition-colors" href="mailto:michael.bbox@gmail.com">
                michael.bbox@gmail.com
              </a>
              .
            </p>
          </section>
        </div>

        <p className="mt-8 text-sm text-text-muted">
          {copy.readOur}{' '}
          <Link href="/terms" className="underline underline-offset-2 hover:text-primary transition-colors">
            {copy.terms}
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
