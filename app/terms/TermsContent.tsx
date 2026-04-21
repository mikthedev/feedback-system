'use client'

import Link from 'next/link'
import { useLanguage } from '@/app/context/LanguageContext'

const TERMS_COPY = {
  en: {
    title: 'Terms of Service',
    updated: 'Last updated: April 21, 2026',
    intro:
      'Welcome to the Demo Feedback System. This service lets users submit music demos and engage with MikeGTC through review, queue management, feedback, and related stream interactions.',
    acceptableUseTitle: 'Acceptable Use',
    acceptableUseBody:
      'You agree to use the platform lawfully and respectfully. Do not abuse the service, attempt unauthorized access, submit harmful content, or interfere with other users and stream operations.',
    serviceScopeTitle: 'Service Scope',
    serviceScopeBody:
      'The platform is provided to support community engagement with MikeGTC. Features may change, pause, or be removed as the project evolves.',
    noAdsTitle: 'No Advertising Use',
    noAdsBody:
      'This system is not used for advertising targeting, ad personalization, or selling your activity to ad networks. Data and actions are used for safe operation, moderation, and improving engagement with MikeGTC.',
    safetyTitle: 'Safety and Moderation',
    safetyBody:
      'We apply reasonable safeguards and moderation practices to keep interactions safe and constructive for the community.',
    contactTitle: 'Contact',
    contactPrefix: 'Questions about these terms can be sent to',
    readOur: 'Read our',
    privacy: 'Privacy Policy',
  },
  uk: {
    title: 'Умови користування',
    updated: 'Останнє оновлення: 21 квітня 2026',
    intro:
      'Ласкаво просимо до Demo Feedback System. Цей сервіс дозволяє користувачам надсилати музичні демо та взаємодіяти з MikeGTC через огляд, керування чергою, фідбек і пов’язані активності стріму.',
    acceptableUseTitle: 'Прийнятне використання',
    acceptableUseBody:
      'Ви погоджуєтесь використовувати платформу законно та з повагою. Не зловживайте сервісом, не намагайтесь отримати несанкціонований доступ, не надсилайте шкідливий контент і не заважайте іншим користувачам та роботі стріму.',
    serviceScopeTitle: 'Обсяг сервісу',
    serviceScopeBody:
      'Платформа створена для підтримки взаємодії спільноти з MikeGTC. Функції можуть змінюватися, призупинятися або видалятися в процесі розвитку проєкту.',
    noAdsTitle: 'Без використання для реклами',
    noAdsBody:
      'Ця система не використовується для рекламного таргетингу, персоналізації реклами чи продажу ваших даних рекламним мережам. Дані й дії використовуються для безпечної роботи, модерації та покращення взаємодії зі спільнотою MikeGTC.',
    safetyTitle: 'Безпека та модерація',
    safetyBody:
      'Ми застосовуємо розумні заходи безпеки та модерації, щоб взаємодія в спільноті була безпечною та конструктивною.',
    contactTitle: 'Контакт',
    contactPrefix: 'Питання щодо цих умов надсилайте на',
    readOur: 'Ознайомтесь із',
    privacy: 'Політикою конфіденційності',
  },
  de: {
    title: 'Nutzungsbedingungen',
    updated: 'Zuletzt aktualisiert: 21. April 2026',
    intro:
      'Willkommen beim Demo Feedback System. Dieser Dienst ermöglicht es Nutzerinnen und Nutzern, Musikdemos einzureichen und mit MikeGTC über Reviews, Warteschlangenverwaltung, Feedback und zugehörige Stream-Interaktionen zu interagieren.',
    acceptableUseTitle: 'Zulässige Nutzung',
    acceptableUseBody:
      'Du stimmst zu, die Plattform rechtmäßig und respektvoll zu nutzen. Missbrauche den Dienst nicht, versuche keinen unbefugten Zugriff, reiche keine schädlichen Inhalte ein und störe weder andere Nutzer noch den Stream-Betrieb.',
    serviceScopeTitle: 'Leistungsumfang',
    serviceScopeBody:
      'Die Plattform dient der Community-Interaktion mit MikeGTC. Funktionen können sich ändern, pausieren oder im Laufe der Weiterentwicklung entfernt werden.',
    noAdsTitle: 'Keine Werbenutzung',
    noAdsBody:
      'Dieses System wird nicht für Werbetargeting, Anzeigenpersonalisierung oder den Verkauf deiner Aktivitäten an Werbenetzwerke genutzt. Daten und Aktionen werden ausschließlich für sicheren Betrieb, Moderation und bessere Community-Interaktion mit MikeGTC verwendet.',
    safetyTitle: 'Sicherheit und Moderation',
    safetyBody:
      'Wir setzen angemessene Schutz- und Moderationsmaßnahmen ein, um Interaktionen für die Community sicher und konstruktiv zu halten.',
    contactTitle: 'Kontakt',
    contactPrefix: 'Fragen zu diesen Bedingungen sende bitte an',
    readOur: 'Lies unsere',
    privacy: 'Datenschutzerklärung',
  },
} as const

export default function TermsContent() {
  const { locale } = useLanguage()
  const copy = TERMS_COPY[locale]

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl rounded-2xl border-2 border-gray-700/60 bg-background-light p-6 sm:p-8">
        <h1 className="text-3xl font-extrabold text-text-primary">{copy.title}</h1>
        <p className="mt-2 text-sm text-text-muted">{copy.updated}</p>

        <div className="mt-6 space-y-5 text-sm leading-relaxed text-text-secondary sm:text-base">
          <p>{copy.intro}</p>

          <section>
            <h2 className="mb-2 text-lg font-bold text-text-primary">{copy.acceptableUseTitle}</h2>
            <p>{copy.acceptableUseBody}</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-bold text-text-primary">{copy.serviceScopeTitle}</h2>
            <p>{copy.serviceScopeBody}</p>
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
          <Link href="/privacy" className="underline underline-offset-2 hover:text-primary transition-colors">
            {copy.privacy}
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
