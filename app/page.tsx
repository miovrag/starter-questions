import StarterQuestions from '@/components/StarterQuestions'

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', background: '#F8F7FA', padding: '40px 16px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24 }}>
          <span style={{ font: '400 12px/16px "Inter",sans-serif', color: '#737373' }}>Agent settings</span>
          <span style={{ font: '400 12px/16px "Inter",sans-serif', color: '#A3A3A3' }}>›</span>
          <span style={{ font: '500 12px/16px "Inter",sans-serif', color: '#171717' }}>Customise</span>
        </div>

        {/* Settings card */}
        <div style={{
          background: '#fff',
          border: '1px solid #EBE9F1',
          borderRadius: 6,
          boxShadow: '0 4px 24px rgba(75,70,92,0.08)',
          padding: 24,
        }}>
          <StarterQuestions />
        </div>
      </div>
    </div>
  )
}
