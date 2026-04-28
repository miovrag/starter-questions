'use client'

import { useState } from 'react'
import StarterQuestions, { type Tier } from '@/components/StarterQuestions'

const TIERS: { value: Tier; label: string }[] = [
  { value: 'free',       label: 'Free' },
  { value: 'premium',    label: 'Premium' },
  { value: 'enterprise', label: 'Enterprise' },
]

export default function Home() {
  const [tier, setTier] = useState<Tier>('free')

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', padding: '40px 16px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Demo tier switcher */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: '#F5F5F5', borderRadius: 16, padding: 4,
          width: 'fit-content', margin: '0 auto 32px',
        }}>
          {TIERS.map(t => (
            <button key={t.value} type="button" onClick={() => setTier(t.value)}
              style={{
                font: `${tier === t.value ? '600' : '400'} 13px/18px "Inter",sans-serif`,
                color: tier === t.value ? '#171717' : '#737373',
                background: tier === t.value ? '#fff' : 'transparent',
                border: 'none', borderRadius: 12,
                padding: '6px 20px', cursor: 'pointer',
                boxShadow: tier === t.value ? '0 1px 3px rgba(23,23,23,0.10)' : 'none',
                transition: 'all 0.12s',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24 }}>
          <span style={{ font: '400 12px/16px "Inter",sans-serif', color: '#737373' }}>Agent settings</span>
          <span style={{ font: '400 12px/16px "Inter",sans-serif', color: '#A3A3A3' }}>›</span>
          <span style={{ font: '500 12px/16px "Inter",sans-serif', color: '#171717' }}>Customise</span>
        </div>

        {/* Settings card */}
        <div style={{
          background: '#fff',
          border: '1px solid #E5E5E5',
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(23,23,23,0.06)',
          padding: 24,
        }}>
          <StarterQuestions tier={tier} />
        </div>

      </div>
    </div>
  )
}
