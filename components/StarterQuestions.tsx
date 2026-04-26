'use client'

import { useState, useRef, useEffect, CSSProperties } from 'react'
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
  IconBolt,
  IconPencil,
  IconTrash,
  IconPlus,
  IconAlertCircle,
  IconLoader2,
  IconX,
  IconEye,
  IconEyeOff,
  IconInfoCircle,
  IconArrowBackUp,
  IconGripVertical,
  IconMessageQuestion,
  IconCheckbox,
} from '@tabler/icons-react'

/* ── Types ──────────────────────────────────────────────────────────────── */

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

/* ── Constants ──────────────────────────────────────────────────────────── */

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

/* ── Design tokens (inline) ─────────────────────────────────────────────── */

const T = {
  primary:      '#7367F0',
  primaryHover: '#685DD8',
  primary8:     'rgba(115,103,240,0.08)',
  primary12:    'rgba(115,103,240,0.12)',
  primary24:    'rgba(115,103,240,0.24)',
  primaryShadow:'0 2px 6px rgba(115,103,240,0.35)',
  fg1:   '#171717',
  fg2:   '#404040',
  fg3:   '#737373',
  fg4:   '#A3A3A3',
  gray50:'#FAFAFA',
  gray100:'#F5F5F5',
  gray200:'#E5E5E5',
  gray300:'#D4D4D4',
  divider:'#EBE9F1',
  border: '#DBDADE',
  success:'#28C76F',
  success12:'rgba(40,199,111,0.12)',
  successText:'#1F9C57',
  warning:'#FF9F43',
  warning12:'rgba(255,159,67,0.12)',
  warningText:'#C27B34',
  danger: '#EA5455',
  cardShadow: '0 4px 24px rgba(75,70,92,0.08)',
  font: '"Inter", system-ui, -apple-system, sans-serif',
} as const

/* ── Shared micro-styles ────────────────────────────────────────────────── */

const label12: CSSProperties = { font: `500 12px/16px ${T.font}`, color: T.fg2 }
const helper12: CSSProperties = { font: `400 12px/16px ${T.font}`, color: T.fg3 }
const body14: CSSProperties   = { font: `400 14px/20px ${T.font}`, color: T.fg2 }

/* ── Badge ──────────────────────────────────────────────────────────────── */

function AiBadge() {
  return (
    <span style={{
      background: T.primary12,
      color: '#5C53C0',
      borderRadius: 4,
      padding: '1px 6px',
      font: `600 10px/14px ${T.font}`,
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }}>
      AI
    </span>
  )
}

/* ── Tooltip ────────────────────────────────────────────────────────────── */

function Tip({ text }: { text: string }) {
  const [vis, setVis] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onMouseEnter={() => setVis(true)}
        onMouseLeave={() => setVis(false)}
        style={{ color: T.fg4, display: 'flex', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'default' }}
      >
        <IconInfoCircle size={14} />
      </button>
      {vis && (
        <span style={{
          position: 'absolute', left: 20, top: -4, zIndex: 20,
          width: 220, background: T.fg1, color: '#fff',
          borderRadius: 6, padding: '8px 12px',
          font: `400 12px/16px ${T.font}`,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          pointerEvents: 'none',
        }}>
          {text}
        </span>
      )}
    </span>
  )
}

/* ── Sortable question row ──────────────────────────────────────────────── */

interface RowProps {
  q: Question
  editingId: string | null
  editText: string
  onEditStart: (q: Question) => void
  onEditChange: (t: string) => void
  onEditSave: () => void
  onEditCancel: () => void
  onDelete: (q: Question) => void
  editInputRef: React.RefObject<HTMLInputElement | null>
}

function SortableRow(props: RowProps) {
  const { q, editingId, editText, onEditStart, onEditChange, onEditSave, onEditCancel, onDelete, editInputRef } = props
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id })
  const [hovered, setHovered] = useState(false)
  const isEditing = editingId === q.id

  const rowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '10px 16px',
    borderBottom: `1px solid ${T.divider}`,
    background: isDragging ? T.primary8 : hovered && !isEditing ? 'rgba(75,70,92,0.04)' : '#fff',
    opacity: isDragging ? 0.6 : 1,
    transition: `background ${T.font} 0.12s`,
    transform: CSS.Transform.toString(transform),
  }

  return (
    <div
      ref={setNodeRef}
      style={{ ...rowStyle, transition }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Drag handle */}
      <button
        {...listeners}
        {...attributes}
        tabIndex={-1}
        type="button"
        style={{
          color: hovered ? T.fg3 : T.fg4,
          display: 'flex',
          alignItems: 'center',
          marginTop: 1,
          flexShrink: 0,
          cursor: 'grab',
          background: 'none',
          border: 'none',
          padding: 0,
          transition: `color 0.12s`,
          touchAction: 'none',
        }}
        title="Drag to reorder"
      >
        <IconGripVertical size={16} />
      </button>

      {/* AI badge or spacer */}
      {q.source === 'ai' ? (
        <span style={{ marginTop: 3, flexShrink: 0 }}><AiBadge /></span>
      ) : (
        <span style={{ width: 28, flexShrink: 0 }} />
      )}

      {/* Text / editor */}
      <div style={{ flex: 1, minWidth: 0 }}>
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
              style={{
                width: '100%',
                padding: '8px 12px',
                border: `1px solid ${T.primary}`,
                borderRadius: 8,
                boxShadow: `0 0 0 3px ${T.primary24}`,
                font: `400 14px/20px ${T.font}`,
                color: T.fg1,
                outline: 'none',
                background: '#fff',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <span style={{
                ...helper12,
                color: editText.length > MAX_CHARS * 0.85 ? T.warning : T.fg4,
              }}>
                {editText.length}/{MAX_CHARS}
              </span>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" onClick={onEditCancel}
                  style={{ ...helper12, background: 'none', border: 'none', cursor: 'pointer', color: T.fg3 }}>
                  Cancel
                </button>
                <button type="button" onClick={onEditSave}
                  style={{ font: `600 12px/16px ${T.font}`, color: T.primary, background: 'none', border: 'none', cursor: 'pointer' }}>
                  Save
                </button>
              </div>
            </div>
          </div>
        ) : (
          <span style={{ ...body14, display: 'block' }}>{q.text}</span>
        )}
      </div>

      {/* Actions */}
      {!isEditing && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.12s',
          flexShrink: 0,
        }}>
          <button type="button" onClick={() => onEditStart(q)}
            style={{ color: T.fg3, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px 6px', borderRadius: 4 }}
            title="Edit">
            <IconPencil size={15} />
          </button>
          <button type="button" onClick={() => onDelete(q)}
            style={{ color: T.fg3, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px 6px', borderRadius: 4 }}
            title="Delete"
            onMouseEnter={e => (e.currentTarget.style.color = T.danger)}
            onMouseLeave={e => (e.currentTarget.style.color = T.fg3)}>
            <IconTrash size={15} />
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Main component ─────────────────────────────────────────────────────── */

export default function StarterQuestions() {
  const [manualQuestions, setManualQuestions] = useState<Question[]>(INITIAL_MANUAL)
  const [aiQuestions, setAiQuestions]         = useState<Question[]>([])
  const [savedAiQuestions, setSavedAiQuestions] = useState<Question[]>([])
  const [crOn, setCrOn]         = useState(false)
  const [crStatus, setCrStatus] = useState<CRStatus>('off')
  const [hasContent, setHasContent] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText]   = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [newText, setNewText]     = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editInputRef  = useRef<HTMLInputElement | null>(null)
  const newInputRef   = useRef<HTMLInputElement | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const displayedQuestions: Question[] = crOn
    ? [...aiQuestions, ...manualQuestions]
    : manualQuestions

  const totalCount = displayedQuestions.length
  const atLimit    = totalCount >= MAX_QUESTIONS

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus(); editInputRef.current.select()
    }
  }, [editingId])

  useEffect(() => {
    if (addingNew && newInputRef.current) newInputRef.current.focus()
  }, [addingNew])

  /* ── Handlers ── */

  function handleToggleCR() {
    if (!crOn) {
      if (!hasContent) { setCrOn(true); setCrStatus('no-content'); return }
      setCrOn(true); setCrStatus('generating')
      setTimeout(() => {
        setAiQuestions(savedAiQuestions.length > 0 ? savedAiQuestions : AI_QUESTIONS)
        setCrStatus('ready')
      }, 1800)
    } else {
      setSavedAiQuestions(aiQuestions); setAiQuestions([])
      setCrOn(false); setCrStatus('off')
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const aId = String(active.id), oId = String(over.id)
    const inAi = (id: string) => aiQuestions.some(q => q.id === id)
    if (inAi(aId) && inAi(oId)) {
      setAiQuestions(prev => arrayMove(prev, prev.findIndex(q => q.id === aId), prev.findIndex(q => q.id === oId)))
    } else if (!inAi(aId) && !inAi(oId)) {
      setManualQuestions(prev => arrayMove(prev, prev.findIndex(q => q.id === aId), prev.findIndex(q => q.id === oId)))
    }
  }

  function startEdit(q: Question) { setEditingId(q.id); setEditText(q.text) }

  function saveEdit() {
    if (!editingId) return
    const t = editText.trim()
    if (!t) { cancelEdit(); return }
    const up = (prev: Question[]) => prev.map(q => q.id === editingId ? { ...q, text: t } : q)
    setAiQuestions(up); setManualQuestions(up)
    setEditingId(null); setEditText('')
  }

  function cancelEdit() { setEditingId(null); setEditText('') }

  function deleteQuestion(q: Question) {
    const idx = displayedQuestions.findIndex(dq => dq.id === q.id)
    q.source === 'ai'
      ? setAiQuestions(prev => prev.filter(p => p.id !== q.id))
      : setManualQuestions(prev => prev.filter(p => p.id !== q.id))
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ question: q, originalIndex: idx })
    toastTimerRef.current = setTimeout(() => setToast(null), 5000)
  }

  function undoDelete() {
    if (!toast) return
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    const { question: q, originalIndex } = toast
    setToast(null)
    if (q.source === 'ai') {
      setAiQuestions(prev => { const a = [...prev]; a.splice(originalIndex, 0, q); return a })
    } else {
      setManualQuestions(prev => {
        const a = [...prev]; a.splice(Math.max(0, originalIndex - aiQuestions.length), 0, q); return a
      })
    }
  }

  function addQuestion() {
    const t = newText.trim()
    if (!t || atLimit) return
    setManualQuestions(prev => [...prev, { id: `q-${Date.now()}`, text: t, source: 'manual' }])
    setNewText(''); setAddingNew(false)
  }

  /* ── Status chip ── */

  function StatusChip() {
    const base: CSSProperties = {
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 4,
      font: `600 11px/16px ${T.font}`, whiteSpace: 'nowrap',
    }
    if (!crOn) return (
      <span style={{ ...base, background: 'rgba(75,70,92,0.08)', color: T.fg3 }}>Manual only</span>
    )
    if (crStatus === 'generating') return (
      <span style={{ ...base, background: T.primary12, color: '#5C53C0' }}>
        <IconLoader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Generating…
      </span>
    )
    if (crStatus === 'no-content') return (
      <span style={{ ...base, background: T.warning12, color: T.warningText }}>
        <IconAlertCircle size={11} /> Add content first
      </span>
    )
    if (crStatus === 'error') return (
      <span style={{ ...base, background: 'rgba(234,84,85,0.12)', color: T.danger }}>
        <IconAlertCircle size={11} /> Generation failed
      </span>
    )
    return (
      <span style={{ ...base, background: T.success12, color: T.successText }}>
        <IconBolt size={11} /> {aiQuestions.length} AI questions ready
      </span>
    )
  }

  /* ── Shared row props ── */

  const rowProps = { editingId, editText, onEditStart: startEdit, onEditChange: setEditText, onEditSave: saveEdit, onEditCancel: cancelEdit, onDelete: deleteQuestion, editInputRef }

  /* ── Render ── */

  return (
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{
          width: 36, height: 36, borderRadius: 8,
          background: T.primary12, color: T.primary,
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <IconMessageQuestion size={18} />
        </span>
        <div>
          <h2 style={{ font: `600 16px/24px ${T.font}`, color: T.fg1, margin: 0 }}>
            Starter questions
          </h2>
          <p style={{ ...helper12, margin: 0 }}>
            Shown to users when they open your agent
          </p>
        </div>
        <Tip text="Add 3+ questions to increase first-message rate. Users click a question to start the conversation." />
      </div>

      {/* Empty state */}
      {totalCount === 0 && !addingNew && (
        <div style={{
          border: `1.5px dashed ${T.primary12}`,
          borderRadius: 6, padding: 20, textAlign: 'center',
          background: T.primary8, marginBottom: 16,
        }}>
          <p style={{ font: `500 14px/20px ${T.font}`, color: T.fg2, margin: '0 0 4px' }}>
            Help users start the conversation
          </p>
          <p style={{ ...helper12, margin: '0 0 12px' }}>
            Add 3+ questions to increase first-message rate, or generate them from your content.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button type="button" onClick={() => setAddingNew(true)} style={{
              font: `500 13px/18px ${T.font}`, letterSpacing: '.43px',
              padding: '7px 14px', borderRadius: 8,
              border: `1px solid ${T.border}`, background: '#fff',
              color: T.fg2, cursor: 'pointer',
            }}>
              Add manually
            </button>
            <button type="button" onClick={handleToggleCR} style={{
              font: `500 13px/18px ${T.font}`, letterSpacing: '.43px',
              padding: '7px 14px', borderRadius: 8,
              background: T.primary, color: '#fff', border: 'none',
              boxShadow: T.primaryShadow, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <IconBolt size={14} /> Enable AI questions
            </button>
          </div>
        </div>
      )}

      {/* AI toggle card */}
      <div style={{
        border: `1px solid ${crOn ? '#D5D1FB' : T.divider}`,
        borderRadius: 6,
        background: crOn ? 'rgba(115,103,240,0.04)' : '#fff',
        padding: '16px 20px',
        marginBottom: 12,
        transition: 'all 0.15s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ font: `500 14px/20px ${T.font}`, color: T.fg1 }}>
                AI-generated questions
              </span>
              <Tip text="Automatically generated from your uploaded documents and URLs." />
            </div>
            <p style={{ ...helper12, margin: '2px 0 0' }}>Auto-created from your content</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <StatusChip />
            {/* Toggle */}
            <button
              type="button"
              role="switch"
              aria-checked={crOn}
              aria-label="Enable AI-generated starter questions"
              onClick={handleToggleCR}
              style={{
                position: 'relative',
                width: 36, height: 20,
                borderRadius: 1000,
                background: crOn ? T.primary : T.gray300,
                border: 'none', cursor: 'pointer', padding: 0,
                transition: `background 0.15s`,
                flexShrink: 0,
                outline: 'none',
              }}
            >
              <span style={{
                position: 'absolute',
                top: 3, left: crOn ? 19 : 3,
                width: 14, height: 14,
                borderRadius: '50%', background: '#fff',
                boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                transition: 'left 0.15s',
              }} />
            </button>
          </div>
        </div>

        {/* No content warning */}
        {crOn && crStatus === 'no-content' && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            marginTop: 12, padding: '10px 12px',
            background: T.warning12, border: `1px solid rgba(255,159,67,0.24)`,
            borderRadius: 6,
          }}>
            <IconAlertCircle size={14} style={{ color: T.warning, flexShrink: 0, marginTop: 1 }} />
            <p style={{ font: `400 12px/18px ${T.font}`, color: T.warningText, margin: 0 }}>
              AI questions need a knowledge source.{' '}
              <button type="button" style={{ font: `600 12px/18px ${T.font}`, color: T.warningText, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                Upload a document or add a URL.
              </button>
            </p>
          </div>
        )}

        {/* Generating skeleton */}
        {crOn && crStatus === 'generating' && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[68, 52, 80, 58].map((w, i) => (
              <div key={i} style={{
                height: 14, borderRadius: 4,
                background: 'rgba(115,103,240,0.12)',
                width: `${w}%`,
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Question list */}
      {displayedQuestions.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div style={{
            border: `1px solid ${T.divider}`,
            borderRadius: 6,
            background: '#fff',
            marginBottom: 12,
            overflow: 'hidden',
          }}>
            {crOn && aiQuestions.length > 0 && (
              <SortableContext items={aiQuestions.map(q => q.id)} strategy={verticalListSortingStrategy}>
                {aiQuestions.map(q => <SortableRow key={q.id} q={q} {...rowProps} />)}
              </SortableContext>
            )}

            {crOn && aiQuestions.length > 0 && manualQuestions.length > 0 && (
              <div style={{
                padding: '6px 16px',
                background: T.gray50,
                borderTop: `1px solid ${T.divider}`,
                borderBottom: `1px solid ${T.divider}`,
                font: `600 11px/16px ${T.font}`,
                color: T.fg4,
                letterSpacing: '.06em',
                textTransform: 'uppercase',
              }}>
                Your questions
              </div>
            )}

            {manualQuestions.length > 0 && (
              <SortableContext items={manualQuestions.map(q => q.id)} strategy={verticalListSortingStrategy}>
                {manualQuestions.map(q => <SortableRow key={q.id} q={q} {...rowProps} />)}
              </SortableContext>
            )}
          </div>
        </DndContext>
      )}

      {/* Add question */}
      {!atLimit && (
        <div style={{ marginBottom: 16 }}>
          {addingNew ? (
            <div style={{
              border: `1px solid ${T.primary}`,
              boxShadow: `0 0 0 3px ${T.primary24}`,
              borderRadius: 8, padding: '10px 16px',
              background: '#fff',
            }}>
              <input
                ref={newInputRef}
                value={newText}
                onChange={e => setNewText(e.target.value.slice(0, MAX_CHARS))}
                onKeyDown={e => {
                  if (e.key === 'Enter') addQuestion()
                  if (e.key === 'Escape') { setAddingNew(false); setNewText('') }
                }}
                placeholder="Type a question your users often ask…"
                style={{
                  width: '100%', border: 'none', outline: 'none', padding: 0,
                  font: `400 14px/20px ${T.font}`, color: T.fg1,
                  background: 'transparent',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <span style={{
                  ...helper12,
                  color: newText.length > MAX_CHARS * 0.85 ? T.warning : T.fg4,
                }}>
                  {newText.length}/{MAX_CHARS} characters
                </span>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="button"
                    onClick={() => { setAddingNew(false); setNewText('') }}
                    style={{ ...helper12, background: 'none', border: 'none', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button type="button" onClick={addQuestion} disabled={!newText.trim()}
                    style={{
                      font: `600 12px/16px ${T.font}`, color: newText.trim() ? T.primary : T.fg4,
                      background: 'none', border: 'none', cursor: newText.trim() ? 'pointer' : 'default',
                    }}>
                    Add
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setAddingNew(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                font: `500 13px/18px ${T.font}`, color: T.primary,
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                letterSpacing: '.43px',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = T.primaryHover)}
              onMouseLeave={e => (e.currentTarget.style.color = T.primary)}>
              <span style={{
                width: 24, height: 24, borderRadius: '50%',
                border: `1.5px solid ${T.primary}`,
                display: 'grid', placeItems: 'center',
                flexShrink: 0,
              }}>
                <IconPlus size={13} />
              </span>
              Add a starter question
            </button>
          )}
        </div>
      )}

      {/* Footer: count + preview */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{
          ...helper12,
          color: atLimit ? T.warning : T.fg4,
        }}>
          {atLimit ? `Limit reached (${totalCount}/${MAX_QUESTIONS})` : `${totalCount} of ${MAX_QUESTIONS} questions`}
        </span>
        <button type="button"
          onClick={() => setPreviewOpen(v => !v)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            font: `500 12px/16px ${T.font}`, color: T.fg3,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = T.fg2)}
          onMouseLeave={e => (e.currentTarget.style.color = T.fg3)}>
          {previewOpen ? <IconEyeOff size={14} /> : <IconEye size={14} />}
          {previewOpen ? 'Hide preview' : 'Preview in widget'}
        </button>
      </div>

      {/* Widget preview */}
      {previewOpen && (
        <div style={{
          border: `1px solid ${T.divider}`,
          borderRadius: 6,
          background: T.gray50,
          padding: 16,
          marginBottom: 16,
        }}>
          <p style={{ ...helper12, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600, color: T.fg4, margin: '0 0 12px' }}>
            Widget preview
          </p>
          <div style={{
            background: '#fff',
            border: `1px solid ${T.divider}`,
            borderRadius: 12,
            padding: 16, maxWidth: 320,
            boxShadow: '0 4px 24px rgba(75,70,92,0.08)',
          }}>
            <p style={{ font: `400 12px/16px ${T.font}`, color: T.fg3, margin: '0 0 10px' }}>
              How can I help you today?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {displayedQuestions.slice(0, 4).map(q => (
                <button key={q.id} type="button" style={{
                  textAlign: 'left',
                  font: `400 12px/16px ${T.font}`,
                  color: T.fg2, padding: '8px 12px',
                  border: `1px solid ${T.divider}`,
                  borderRadius: 8, background: T.gray50,
                  cursor: 'pointer', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.primary8; e.currentTarget.style.borderColor = '#D5D1FB' }}
                  onMouseLeave={e => { e.currentTarget.style.background = T.gray50; e.currentTarget.style.borderColor = T.divider }}>
                  {q.text}
                </button>
              ))}
              {displayedQuestions.length > 4 && (
                <p style={{ font: `400 11px/16px ${T.font}`, color: T.fg4, textAlign: 'center', margin: '4px 0 0' }}>
                  +{displayedQuestions.length - 4} more
                </p>
              )}
              {displayedQuestions.length === 0 && (
                <p style={{ font: `400 12px/16px ${T.font}`, color: T.fg4, textAlign: 'center', padding: '8px 0' }}>
                  No questions yet
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Demo control */}
      <div style={{ paddingTop: 12, borderTop: `1px solid ${T.divider}` }}>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8,
          font: `400 12px/16px ${T.font}`, color: T.fg4,
          cursor: 'pointer', userSelect: 'none',
        }}>
          <input type="checkbox" checked={hasContent} onChange={e => setHasContent(e.target.checked)} style={{ accentColor: T.primary }} />
          Demo: agent has a knowledge base
        </label>
      </div>

      {/* Undo toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24,
          left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 12,
          background: T.fg1, color: '#fff',
          padding: '10px 16px', borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          font: `400 13px/18px ${T.font}`,
          zIndex: 50, whiteSpace: 'nowrap',
        }}>
          <span style={{ color: T.fg4 }}>Starter question removed.</span>
          <button type="button" onClick={undoDelete}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              font: `600 13px/18px ${T.font}`, color: '#fff',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#A39BF6')}
            onMouseLeave={e => (e.currentTarget.style.color = '#fff')}>
            <IconArrowBackUp size={13} /> Undo
          </button>
          <button type="button" onClick={() => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); setToast(null) }}
            style={{ color: T.fg3, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: 4 }}>
            <IconX size={14} />
          </button>
        </div>
      )}
    </>
  )
}
