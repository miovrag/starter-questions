'use client'

import { useState, useRef, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Sparkles,
  Pencil,
  Trash2,
  Plus,
  AlertCircle,
  Loader2,
  X,
  Eye,
  EyeOff,
  Info,
  RotateCcw,
  GripVertical,
} from 'lucide-react'

interface Question {
  id: string
  text: string
  source: 'manual' | 'ai'
}

type CRStatus = 'off' | 'generating' | 'ready' | 'error' | 'no-content'

interface ToastState {
  question: Question
  originalIndex: number
}

const MAX_QUESTIONS = 8
const MAX_CHARS = 80

const AI_QUESTIONS: Question[] = [
  { id: 'ai-1', text: 'What are the key growth drivers in the analytical HPLC market?', source: 'ai' },
  { id: 'ai-2', text: 'Which regions have the highest LC/MS adoption rate?', source: 'ai' },
  { id: 'ai-3', text: 'How does column chemistry affect separation efficiency?', source: 'ai' },
  { id: 'ai-4', text: 'Who are the leading vendors in the GC/MS equipment market?', source: 'ai' },
]

const INITIAL_MANUAL: Question[] = [
  { id: 'q-1', text: 'What is the global market for Analytical HPLC?', source: 'manual' },
  { id: 'q-2', text: 'Tell me about the LC/MS market.', source: 'manual' },
  { id: 'q-3', text: 'What is the combined GC and GC/MS market by geography?', source: 'manual' },
  { id: 'q-4', text: "What's the size of the analytical HPLC columns market?", source: 'manual' },
]

// ─── Sortable question row ───────────────────────────────────────────────────

interface QuestionRowProps {
  q: Question
  editingId: string | null
  editText: string
  onEditStart: (q: Question) => void
  onEditChange: (text: string) => void
  onEditSave: () => void
  onEditCancel: () => void
  onDelete: (q: Question) => void
  editInputRef: React.RefObject<HTMLInputElement | null>
}

function SortableQuestionRow({
  q,
  editingId,
  editText,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel,
  onDelete,
  editInputRef,
}: QuestionRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: q.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isEditing = editingId === q.id

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-start gap-2 px-3 py-3 border-b border-gray-100 last:border-b-0 ${
        isDragging ? 'bg-indigo-50/60 opacity-60 rounded-xl z-10' : 'bg-white'
      }`}
    >
      {/* Drag handle */}
      <button
        {...listeners}
        {...attributes}
        tabIndex={-1}
        className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing touch-none text-gray-300 hover:text-gray-500 transition-colors"
        title="Drag to reorder"
      >
        <GripVertical size={15} />
      </button>

      {/* AI badge */}
      {q.source === 'ai' ? (
        <Sparkles size={13} className="text-indigo-400 shrink-0 mt-0.5" />
      ) : (
        <span className="w-[13px] shrink-0" />
      )}

      {/* Text / inline editor */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div>
            <input
              ref={editInputRef}
              value={editText}
              onChange={e => onEditChange(e.target.value.slice(0, MAX_CHARS))}
              onKeyDown={e => {
                if (e.key === 'Enter') onEditSave()
                if (e.key === 'Escape') onEditCancel()
              }}
              className="w-full text-sm border border-indigo-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-800"
            />
            <div className="flex items-center justify-between mt-1.5">
              <span
                className={`text-xs ${editText.length > MAX_CHARS * 0.85 ? 'text-amber-500' : 'text-gray-400'}`}
              >
                {editText.length}/{MAX_CHARS}
              </span>
              <div className="flex gap-2">
                <button onClick={onEditCancel} className="text-xs text-gray-400 hover:text-gray-600">
                  Cancel
                </button>
                <button
                  onClick={onEditSave}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        ) : (
          <span className="text-sm text-gray-700 block">{q.text}</span>
        )}
      </div>

      {/* Actions */}
      {!isEditing && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => onEditStart(q)}
            className="p-1.5 rounded text-gray-400 hover:text-gray-600"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDelete(q)}
            className="p-1.5 rounded text-gray-400 hover:text-red-500"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function StarterQuestions() {
  const [manualQuestions, setManualQuestions] = useState<Question[]>(INITIAL_MANUAL)
  const [aiQuestions, setAiQuestions] = useState<Question[]>([])
  const [savedAiQuestions, setSavedAiQuestions] = useState<Question[]>([])
  const [crOn, setCrOn] = useState(false)
  const [crStatus, setCrStatus] = useState<CRStatus>('off')
  const [hasContent, setHasContent] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [newText, setNewText] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editInputRef = useRef<HTMLInputElement | null>(null)
  const newInputRef = useRef<HTMLInputElement | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const displayedQuestions: Question[] = crOn
    ? [...aiQuestions, ...manualQuestions]
    : manualQuestions

  const totalCount = displayedQuestions.length
  const atLimit = totalCount >= MAX_QUESTIONS

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  useEffect(() => {
    if (addingNew && newInputRef.current) newInputRef.current.focus()
  }, [addingNew])

  function handleToggleCR() {
    if (!crOn) {
      if (!hasContent) {
        setCrOn(true)
        setCrStatus('no-content')
        return
      }
      setCrOn(true)
      setCrStatus('generating')
      setTimeout(() => {
        setAiQuestions(savedAiQuestions.length > 0 ? savedAiQuestions : AI_QUESTIONS)
        setCrStatus('ready')
      }, 1800)
    } else {
      setSavedAiQuestions(aiQuestions)
      setAiQuestions([])
      setCrOn(false)
      setCrStatus('off')
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId = String(over.id)
    const inAi = (id: string) => aiQuestions.some(q => q.id === id)

    if (inAi(activeId) && inAi(overId)) {
      setAiQuestions(prev =>
        arrayMove(prev, prev.findIndex(q => q.id === activeId), prev.findIndex(q => q.id === overId))
      )
    } else if (!inAi(activeId) && !inAi(overId)) {
      setManualQuestions(prev =>
        arrayMove(prev, prev.findIndex(q => q.id === activeId), prev.findIndex(q => q.id === overId))
      )
    }
  }

  function startEdit(q: Question) {
    setEditingId(q.id)
    setEditText(q.text)
  }

  function saveEdit() {
    if (!editingId) return
    const trimmed = editText.trim()
    if (!trimmed) { cancelEdit(); return }
    const update = (prev: Question[]) =>
      prev.map(q => (q.id === editingId ? { ...q, text: trimmed } : q))
    setAiQuestions(update)
    setManualQuestions(update)
    setEditingId(null)
    setEditText('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditText('')
  }

  function deleteQuestion(q: Question) {
    const idx = displayedQuestions.findIndex(dq => dq.id === q.id)
    if (q.source === 'ai') setAiQuestions(prev => prev.filter(p => p.id !== q.id))
    else setManualQuestions(prev => prev.filter(p => p.id !== q.id))
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ question: q, originalIndex: idx })
    toastTimerRef.current = setTimeout(() => setToast(null), 5000)
  }

  function undoDelete() {
    if (!toast) return
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    const { question, originalIndex } = toast
    setToast(null)
    if (question.source === 'ai') {
      setAiQuestions(prev => {
        const arr = [...prev]
        arr.splice(originalIndex, 0, question)
        return arr
      })
    } else {
      setManualQuestions(prev => {
        const arr = [...prev]
        arr.splice(Math.max(0, originalIndex - aiQuestions.length), 0, question)
        return arr
      })
    }
  }

  function addQuestion() {
    const trimmed = newText.trim()
    if (!trimmed || atLimit) return
    setManualQuestions(prev => [
      ...prev,
      { id: `q-${Date.now()}`, text: trimmed, source: 'manual' },
    ])
    setNewText('')
    setAddingNew(false)
  }

  function StatusChip() {
    if (!crOn) return <span className="text-xs text-gray-400 font-medium">Manual only</span>
    if (crStatus === 'generating')
      return (
        <span className="flex items-center gap-1 text-xs text-indigo-500 font-medium">
          <Loader2 size={12} className="animate-spin" /> Generating…
        </span>
      )
    if (crStatus === 'no-content')
      return (
        <span className="flex items-center gap-1 text-xs text-amber-500 font-medium">
          <AlertCircle size={12} /> Add content first
        </span>
      )
    if (crStatus === 'error')
      return (
        <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
          <AlertCircle size={12} /> Generation failed
        </span>
      )
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
        <Sparkles size={12} /> {aiQuestions.length} AI questions ready
      </span>
    )
  }

  const rowProps = {
    editingId,
    editText,
    onEditStart: startEdit,
    onEditChange: setEditText,
    onEditSave: saveEdit,
    onEditCancel: cancelEdit,
    onDelete: deleteQuestion,
    editInputRef,
  }

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
          <Sparkles size={15} className="text-indigo-500" />
        </div>
        <h2 className="text-base font-semibold text-gray-900">Starter Questions</h2>
        <div className="group relative">
          <Info size={14} className="text-gray-400 cursor-help" />
          <div className="absolute left-5 top-0 z-10 hidden group-hover:block w-56 rounded-lg bg-gray-900 px-3 py-2 text-xs text-gray-100 shadow-lg">
            Shown to users when they open your agent. 3+ questions increases first-message rate.
          </div>
        </div>
      </div>

      {/* Empty state */}
      {totalCount === 0 && !addingNew && (
        <div className="mb-4 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 p-5 text-center">
          <p className="text-sm font-medium text-gray-700 mb-1">Help users start the conversation</p>
          <p className="text-xs text-gray-500 mb-3">
            Add 3+ questions to increase first-message rate. Or let AI generate them from your content.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setAddingNew(true)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Add manually
            </button>
            <button
              onClick={handleToggleCR}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
            >
              <Sparkles size={11} /> Enable AI questions
            </button>
          </div>
        </div>
      )}

      {/* AI questions toggle row */}
      <div
        className={`rounded-xl border p-4 mb-3 transition-colors ${
          crOn ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-200 bg-white'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-gray-800">AI-Generated Questions</span>
              <div className="group relative">
                <Info size={13} className="text-gray-400 cursor-help" />
                <div className="absolute left-5 top-0 z-10 hidden group-hover:block w-52 rounded-lg bg-gray-900 px-3 py-2 text-xs text-gray-100 shadow-lg">
                  Automatically generated from your uploaded documents and URLs.
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Auto-created from your content</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <StatusChip />
            <button
              onClick={handleToggleCR}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 ${
                crOn ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
              role="switch"
              aria-checked={crOn}
              aria-label="Enable AI-generated starter questions"
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-150 ${
                  crOn ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {crOn && crStatus === 'no-content' && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
            <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">
              AI questions need a knowledge source.{' '}
              <button className="underline font-medium">Upload a document or add a URL.</button>
            </p>
          </div>
        )}

        {crOn && crStatus === 'generating' && (
          <div className="mt-3 space-y-2">
            {[72, 56, 84, 60].map((w, i) => (
              <div
                key={i}
                className="h-4 rounded-md bg-indigo-100 animate-pulse"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Question list with drag-and-drop */}
      {displayedQuestions.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="mb-3 rounded-xl border border-gray-200 bg-white overflow-hidden">
            {/* AI group */}
            {crOn && aiQuestions.length > 0 && (
              <SortableContext
                items={aiQuestions.map(q => q.id)}
                strategy={verticalListSortingStrategy}
              >
                {aiQuestions.map(q => (
                  <SortableQuestionRow key={q.id} q={q} {...rowProps} />
                ))}
              </SortableContext>
            )}

            {/* Divider between groups */}
            {crOn && aiQuestions.length > 0 && manualQuestions.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-50 border-y border-gray-100">
                <span className="text-xs text-gray-400">Your questions</span>
              </div>
            )}

            {/* Manual group */}
            {manualQuestions.length > 0 && (
              <SortableContext
                items={manualQuestions.map(q => q.id)}
                strategy={verticalListSortingStrategy}
              >
                {manualQuestions.map(q => (
                  <SortableQuestionRow key={q.id} q={q} {...rowProps} />
                ))}
              </SortableContext>
            )}
          </div>
        </DndContext>
      )}

      {/* Add question */}
      {!atLimit && (
        <div className="mb-4">
          {addingNew ? (
            <div className="rounded-xl border border-indigo-300 bg-white px-4 py-3">
              <input
                ref={newInputRef}
                value={newText}
                onChange={e => setNewText(e.target.value.slice(0, MAX_CHARS))}
                onKeyDown={e => {
                  if (e.key === 'Enter') addQuestion()
                  if (e.key === 'Escape') { setAddingNew(false); setNewText('') }
                }}
                placeholder="Type a question your users often ask…"
                className="w-full text-sm focus:outline-none text-gray-800 placeholder-gray-400"
              />
              <div className="flex items-center justify-between mt-2">
                <span
                  className={`text-xs ${newText.length > MAX_CHARS * 0.85 ? 'text-amber-500' : 'text-gray-400'}`}
                >
                  {newText.length}/{MAX_CHARS} characters
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setAddingNew(false); setNewText('') }}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addQuestion}
                    disabled={!newText.trim()}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingNew(true)}
              className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors group"
            >
              <span className="w-6 h-6 rounded-full border-2 border-indigo-200 group-hover:border-indigo-400 flex items-center justify-center transition-colors">
                <Plus size={12} />
              </span>
              Add a starter question
            </button>
          )}
        </div>
      )}

      {/* Count + preview toggle */}
      <div className="flex items-center justify-between mb-4">
        <span className={`text-xs font-medium ${atLimit ? 'text-amber-500' : 'text-gray-400'}`}>
          {atLimit
            ? `Limit reached (${totalCount}/${MAX_QUESTIONS})`
            : `${totalCount} of ${MAX_QUESTIONS} questions`}
        </span>
        <button
          onClick={() => setPreviewOpen(v => !v)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 font-medium transition-colors"
        >
          {previewOpen ? <EyeOff size={13} /> : <Eye size={13} />}
          {previewOpen ? 'Hide preview' : 'Preview in widget'}
        </button>
      </div>

      {/* Widget preview */}
      {previewOpen && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs text-gray-400 font-medium mb-3">Widget preview</p>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 max-w-xs">
            <p className="text-xs text-gray-500 mb-3">How can I help you today?</p>
            <div className="space-y-1.5">
              {displayedQuestions.slice(0, 4).map(q => (
                <button
                  key={q.id}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-700 hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
                >
                  <span className="line-clamp-1">{q.text}</span>
                </button>
              ))}
              {displayedQuestions.length > 4 && (
                <p className="text-xs text-gray-400 text-center pt-1">
                  +{displayedQuestions.length - 4} more
                </p>
              )}
              {displayedQuestions.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">No questions yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Demo control */}
      <div className="pt-3 border-t border-gray-100">
        <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hasContent}
            onChange={e => setHasContent(e.target.checked)}
            className="rounded"
          />
          Demo: agent has a knowledge base
        </label>
      </div>

      {/* Undo toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-gray-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-xl z-50">
          <span className="text-gray-300">Starter question removed.</span>
          <button
            onClick={undoDelete}
            className="flex items-center gap-1 font-semibold text-white hover:text-indigo-300 transition-colors"
          >
            <RotateCcw size={11} /> Undo
          </button>
          <button
            onClick={() => {
              if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
              setToast(null)
            }}
            className="text-gray-500 hover:text-white ml-1"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  )
}
