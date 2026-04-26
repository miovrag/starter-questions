import StarterQuestions from '@/components/StarterQuestions'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Mock settings nav */}
        <div className="mb-6">
          <p className="text-xs text-gray-400 mb-1">Agent Settings</p>
          <h1 className="text-xl font-semibold text-gray-900">Configure</h1>
        </div>

        {/* Settings card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <StarterQuestions />
        </div>
      </div>
    </div>
  )
}
