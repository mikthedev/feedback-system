'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleTwitchLogin = () => {
    setLoading(true)
    window.location.href = '/api/auth/twitch'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 animate-page-transition">
      <div className="bg-background-light rounded-2xl p-8 md:p-10 max-w-md w-full border border-gray-800/50 shadow-2xl">
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-bold mb-3 text-text-primary">
            Demo Feedback System
          </h1>
          <p className="text-text-secondary text-sm md:text-base">
            Submit your music demos and get feedback from MikeGTC
          </p>
        </div>
        <button
          onClick={handleTwitchLogin}
          disabled={loading}
          className="relative w-full bg-primary hover:bg-primary-hover active:bg-primary-active text-background font-medium py-3.5 px-4 rounded-button transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group shadow-lg hover:shadow-xl hover:shadow-primary/20 active:scale-[0.98] button-press"
        >
          {/* Subtle shine effect */}
          <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent"></span>
          
          <span className="relative flex items-center justify-center gap-2.5">
            {/* Twitch Logo SVG */}
            <svg 
              className="w-5 h-5" 
              viewBox="0 0 24 24" 
              fill="currentColor"
            >
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0H6zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714V11.143z"/>
            </svg>
            {loading ? 'Connecting...' : 'Login with Twitch'}
          </span>
        </button>
      </div>
    </div>
  )
}
