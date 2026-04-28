'use client'

import { useState, useRef, useEffect, useContext, createContext, CSSProperties } from 'react'
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
  IconX,
  IconInfoCircle,
  IconArrowBackUp,
  IconGripVertical,
  IconCheck,
  IconMessageQuestion,
} from '@tabler/icons-react'

/* ── Types ──────────────────────────────────────────────────────────────── */

export type Tier = 'free' | 'premium' | 'enterprise'

interface Question {
  id: string
  text: string
  source: 'manual' | 'page'
}

interface ToastState {
  question: Question
  originalIndex: number
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const MAX_QUESTIONS = 4
const MAX_CHARS = 80
const DOCS_URL = 'https://docs.customgpt.ai/docs/how-context-rich-starter-questions-work'

const INITIAL_QUESTIONS: Question[] = [
  { id: 'q-0', text: 'What are the key growth drivers in the analytical HPLC market?', source: 'page' },
  { id: 'q-1', text: 'What is the global market for Analytical HPLC?', source: 'manual' },
  { id: 'q-2', text: 'Tell me about the LC/MS market.', source: 'manual' },
  { id: 'q-3', text: 'What is the combined GC and GC/MS market by geography?', source: 'manual' },
]

/* ── Design tokens ──────────────────────────────────────────────────────── */

const T = {
  primary:       '#7367F0',
  primaryHover:  '#685DD8',
  primaryActive: '#5C53C0',
  primary8:      'rgba(115,103,240,0.08)',
  primary24:     'rgba(115,103,240,0.24)',
  primary100:    '#EAE8FD',
  primary200:    '#D5D1FB',
  primaryShadow: '0 2px 6px rgba(115,103,240,0.35)',
  fg1:    '#171717',
  fg2:    '#404040',
  fg3:    '#737373',
  fg4:    '#A3A3A3',
  gray100:'#F5F5F5',
  gray200:'#E5E5E5',
  gray300:'#D4D4D4',
  divider:'#E5E5E5',
  border: '#E5E5E5',
  hoverBg:'rgba(38,38,38,0.04)',
  success100: '#D6F5E3',
  warning:    '#FF9F43',
  danger:     '#EA5455',
  shadowModal:'0 8px 32px rgba(23,23,23,0.16)',
  font: '"Inter", system-ui, -apple-system, sans-serif',
} as const

const helper12: CSSProperties = { font: `400 12px/16px ${T.font}`, color: T.fg3 }
const body14: CSSProperties   = { font: `400 14px/20px ${T.font}`, color: T.fg2 }

const DraggingCtx = createContext(false)

/* ── Tooltip ────────────────────────────────────────────────────────────── */

function Tooltip({ label, children, side = 'top', width }: {
  label: string
  children: React.ReactNode
  side?: 'top' | 'bottom' | 'right'
  width?: number
}) {
  const anyDragging = useContext(DraggingCtx)
  const [vis, setVis] = useState(false)

  const position: CSSProperties =
    side === 'top'    ? { bottom: 'calc(100% + 7px)', left: '50%', transform: 'translateX(-50%)' } :
    side === 'bottom' ? { top:    'calc(100% + 7px)', left: '50%', transform: 'translateX(-50%)' } :
                        { left:   'calc(100% + 7px)', top:  '50%', transform: 'translateY(-50%)' }

  const arrowPos: CSSProperties =
    side === 'top'    ? { bottom: -3, left: '50%', transform: 'translateX(-50%) rotate(45deg)' } :
    side === 'bottom' ? { top:    -3, left: '50%', transform: 'translateX(-50%) rotate(45deg)' } :
                        { left:   -3, top:  '50%', transform: 'translateY(-50%) rotate(45deg)' }

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setVis(true)}
      onMouseLeave={() => setVis(false)}
    >
      {children}
      {vis && !anyDragging && (
        <span role="tooltip" style={{
          position: 'absolute',
          zIndex: 40,
          display: 'inline-flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#fff',
          color: T.fg2,
          borderRadius: 16,
          padding: '5px 10px',
          font: `400 12px/16px ${T.font}`,
          whiteSpace: width ? 'normal' : 'nowrap',
          width: width ?? 'max-content',
          maxWidth: width ?? 240,
          boxShadow: '0 1px 2.2px 0 rgba(0,0,0,0.25)',
          pointerEvents: 'none',
          animation: 'tooltipIn 120ms ease both',
          animationDelay: '133ms',
          ...position,
        }}>
          {label}
          <span style={{
            position: 'absolute',
            width: 6, height: 6,
            background: '#fff',
            boxShadow: '0 1px 2.2px 0 rgba(0,0,0,0.25)',
            ...arrowPos,
          }} />
        </span>
      )}
    </span>
  )
}

function Tip({ text }: { text: string }) {
  return (
    <Tooltip label={text} side="right" width={220}>
      <button type="button" style={{ color: T.fg4, display: 'flex', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'default' }}>
        <IconInfoCircle size={14} />
      </button>
    </Tooltip>
  )
}

/* ── PageBadge ──────────────────────────────────────────────────────────── */

function PageBadge() {
  return (
    <Tooltip label="Relevant to the page this visitor is on right now" side="top">
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        background: T.primary100,
        color: T.primaryActive,
        borderRadius: 4,
        padding: '1px 6px',
        font: `500 10px/14px ${T.font}`,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        cursor: 'default',
      }}>
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M6 1C6 1 4 3.5 4 6s2 5 2 5M6 1c0 0 2 2.5 2 5s-2 5-2 5M1 6h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        Page
      </span>
    </Tooltip>
  )
}

/* ── PlanTag ────────────────────────────────────────────────────────────── */


function PlanTag({ plan, onClick }: { plan: 'Premium' | 'Enterprise'; onClick?: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <span
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex',
        height: 24,
        padding: '8px 12px',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        borderRadius: 999,
        background: hov && onClick ? T.primary200 : '#E3E1FC',
        color: T.primaryActive,
        font: `600 11px/16px ${T.font}`,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        boxSizing: 'border-box' as const,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.12s',
        userSelect: 'none',
      }}>
      <IconBolt size={13} />
      {plan}
    </span>
  )
}

/* ── Upsell modal ───────────────────────────────────────────────────────── */

const UPSELL: Record<'Premium' | 'Enterprise', {
  title: string
  description: string
  features: string[]
  cta: string
}> = {
  Premium: {
    title: 'Upgrade to Premium',
    description: 'Greet every user with up to 4 questions the moment they open your agent — so every conversation starts with context.',
    features: [
      'Up to 4 custom starter questions',
      'Drag-and-drop reordering',
      'Inline editing with undo',
    ],
    cta: 'Upgrade to Premium',
  },
  Enterprise: {
    title: 'Upgrade to Enterprise',
    description: 'Context-rich questions are tailored to exactly what your visitor is reading — generated from the live page your chatbot is on, not your knowledge base. Every question is relevant to that specific moment.',
    features: [
      'Instantly relevant to the page your visitor is on',
      'Questions auto-refresh every 30 days',
      'View, edit, and manage saved questions anytime',
    ],
    cta: 'Upgrade to Enterprise',
  },
}

function UpsellModal({ plan, onClose }: { plan: 'Premium' | 'Enterprise'; onClose: () => void }) {
  const content = UPSELL[plan]
  return (
    <>
      <div onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(23,23,23,0.4)', zIndex: 60 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 32,
        padding: 32, width: 400,
        maxWidth: 'calc(100vw - 32px)',
        borderRadius: 16,
        borderTop: '2px solid #FFF',
        background: '#FAF8F8',
        boxShadow: T.shadowModal,
        zIndex: 61,
        animation: 'modalIn 0.2s cubic-bezier(0.2,0.8,0.2,1) forwards',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12, alignSelf: 'stretch' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', alignSelf: 'stretch' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 16,
              background: '#E3E1FC',
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <IconMessageQuestion size={22} style={{ color: T.primaryActive }} />
            </div>
            <button type="button" onClick={onClose}
              style={{ color: T.fg4, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}
              onMouseEnter={e => (e.currentTarget.style.color = T.fg2)}
              onMouseLeave={e => (e.currentTarget.style.color = T.fg4)}>
              <IconX size={16} />
            </button>
          </div>
          <div>
            <h3 style={{ font: `600 17px/24px ${T.font}`, color: T.fg1, margin: '0 0 6px' }}>
              {content.title}
            </h3>
            <p style={{ font: `400 14px/20px ${T.font}`, color: T.fg3, margin: 0 }}>
              {content.description}
            </p>
          </div>
        </div>

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12, alignSelf: 'stretch' }}>
          {content.features.map(f => (
            <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                background: '#E3E1FC', display: 'grid', placeItems: 'center',
              }}>
                <IconCheck size={11} style={{ color: T.primary }} />
              </span>
              <span style={{ font: `400 13px/18px ${T.font}`, color: T.fg2 }}>{f}</span>
            </li>
          ))}
        </ul>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignSelf: 'stretch' }}>
          <button type="button"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              font: `600 14px/20px ${T.font}`, color: '#fff',
              background: T.primary, border: 'none',
              borderRadius: 16, padding: '10px 20px',
              cursor: 'pointer', boxShadow: T.primaryShadow,
              width: '100%',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = T.primaryHover)}
            onMouseLeave={e => (e.currentTarget.style.background = T.primary)}>
            <IconBolt size={15} /> {content.cta}
          </button>
          <a href={DOCS_URL} target="_blank" rel="noopener noreferrer"
            style={{
              display: 'block', textAlign: 'center',
              font: `500 13px/18px ${T.font}`, color: T.fg3,
              textDecoration: 'none',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = T.fg2)}
            onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = T.fg3)}>
            Learn more ↗
          </a>
        </div>
      </div>
    </>
  )
}

/* ── Sortable question row ──────────────────────────────────────────────── */

interface RowProps {
  q: Question
  editingId: string | null
  editText: string
  savedId: string | null
  onEditStart: (q: Question) => void
  onEditChange: (t: string) => void
  onEditSave: () => void
  onEditCancel: () => void
  onDelete: (q: Question) => void
  editInputRef: React.RefObject<HTMLInputElement | null>
  isFirst?: boolean
  isLast?: boolean
  radius?: number
}

function SortableRow(props: RowProps) {
  const {
    q, editingId, editText, savedId,
    onEditStart, onEditChange, onEditSave, onEditCancel,
    onDelete, editInputRef,
    isFirst, isLast, radius = 6,
  } = props

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id })
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const isEditing = editingId === q.id
  const isSaved   = savedId === q.id
  const showActions = (hovered || focused) && !isEditing

  const rowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    borderBottom: isLast ? 'none' : `1px solid ${T.divider}`,
    borderRadius: isFirst && isLast ? radius : isFirst ? `${radius}px ${radius}px 0 0` : isLast ? `0 0 ${radius}px ${radius}px` : 0,
    background: isDragging
      ? T.primary8
      : isSaved
      ? T.success100
      : (hovered || focused) && !isEditing
      ? T.hoverBg
      : '#fff',
    opacity: isDragging ? 0.6 : 1,
    transition: 'background 0.15s',
    transform: CSS.Transform.toString(transform),
  }

  return (
    <div
      ref={setNodeRef}
      style={{ ...rowStyle, transition }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false) }}
    >
      <Tooltip label="Drag to reorder" side="top">
        <button
          {...listeners}
          {...attributes}
          tabIndex={-1}
          type="button"
          style={{
            color: T.fg2,
            opacity: hovered ? 1 : 0.3,
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            cursor: 'grab',
            background: 'none',
            border: 'none',
            padding: 0,
            transition: 'opacity 0.12s',
            touchAction: 'none',
          }}
        >
          <IconGripVertical size={16} />
        </button>
      </Tooltip>

      <div style={{ flex: 1, minWidth: 0 }}>
        {isEditing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              ref={editInputRef}
              value={editText}
              onChange={e => onEditChange(e.target.value.slice(0, MAX_CHARS))}
              onKeyDown={e => {
                if (e.key === 'Enter') onEditSave()
                if (e.key === 'Escape') onEditCancel()
              }}
              style={{
                flex: 1, minWidth: 0,
                padding: '0 8px',
                border: `1px solid ${T.primary}`,
                borderRadius: 16,
                boxShadow: `0 0 0 3px ${T.primary24}`,
                font: `400 14px/20px ${T.font}`,
                lineHeight: '20px',
                color: T.fg1,
                outline: 'none',
                background: '#fff',
              }}
            />
            <button type="button" onClick={onEditCancel}
              style={{ ...helper12, background: 'none', border: 'none', cursor: 'pointer', color: T.fg3, whiteSpace: 'nowrap', flexShrink: 0 }}>
              Cancel
            </button>
            <button type="button" onClick={onEditSave} disabled={!editText.trim()}
              style={{ font: `600 12px/16px ${T.font}`, color: editText.trim() ? T.primary : T.fg4, background: 'none', border: 'none', cursor: editText.trim() ? 'pointer' : 'default', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Save
            </button>
          </div>
        ) : (
          <span
            tabIndex={0}
            role="button"
            style={{ ...body14, display: 'block', cursor: 'text', outline: 'none' }}
            onDoubleClick={() => onEditStart(q)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'F2') onEditStart(q) }}
            title="Double-click or press Enter to edit"
          >
            {q.text}
          </span>
        )}
      </div>

      {!isEditing && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          opacity: showActions ? 1 : 0,
          transition: 'opacity 0.12s',
          flexShrink: 0,
        }}>
          <Tooltip label="Edit" side="top">
            <button type="button" onClick={() => onEditStart(q)}
              tabIndex={showActions ? 0 : -1}
              style={{ color: T.fg3, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px 6px', borderRadius: 4 }}>
              <IconPencil size={15} />
            </button>
          </Tooltip>
          <Tooltip label="Delete" side="top">
            <button type="button" onClick={() => onDelete(q)}
              tabIndex={showActions ? 0 : -1}
              style={{ color: T.fg3, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px 6px', borderRadius: 4 }}
              onMouseEnter={e => (e.currentTarget.style.color = T.danger)}
              onMouseLeave={e => (e.currentTarget.style.color = T.fg3)}>
              <IconTrash size={15} />
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  )
}

/* ── Main component ─────────────────────────────────────────────────────── */

export default function StarterQuestions({ tier = 'enterprise' }: { tier?: Tier }) {
  const [questions, setQuestions] = useState<Question[]>(INITIAL_QUESTIONS)
  const [anyDragging, setAnyDragging] = useState(false)
  const [savedId, setSavedId]         = useState<string | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText]   = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [newText, setNewText]     = useState('')
  const [upsellPlan, setUpsellPlan] = useState<'Premium' | 'Enterprise' | null>(null)
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editInputRef  = useRef<HTMLInputElement | null>(null)
  const newInputRef   = useRef<HTMLInputElement | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const pageQuestions   = questions.filter(q => q.source === 'page')
  const manualQuestions = questions.filter(q => q.source === 'manual')
  const totalCount = questions.length
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

  function handleDragEnd(source: 'page' | 'manual') {
    return (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const aId = String(active.id), oId = String(over.id)
      setQuestions(prev => {
        const group = prev.filter(q => q.source === source)
        const rest  = prev.filter(q => q.source !== source)
        const reordered = arrayMove(group, group.findIndex(q => q.id === aId), group.findIndex(q => q.id === oId))
        return source === 'page' ? [...reordered, ...rest] : [...rest, ...reordered]
      })
    }
  }

  function startEdit(q: Question) { setEditingId(q.id); setEditText(q.text) }

  function saveEdit() {
    if (!editingId) return
    const t = editText.trim()
    if (!t) { cancelEdit(); return }
    setQuestions(prev => prev.map(q => q.id === editingId ? { ...q, text: t } : q))
    const id = editingId
    setSavedId(id)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setSavedId(null), 700)
    setEditingId(null); setEditText('')
  }

  function cancelEdit() { setEditingId(null); setEditText('') }

  function deleteQuestion(q: Question) {
    const idx = questions.findIndex(mq => mq.id === q.id)
    setQuestions(prev => prev.filter(p => p.id !== q.id))
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ question: q, originalIndex: idx })
    toastTimerRef.current = setTimeout(() => setToast(null), 10000)
  }

  function undoDelete() {
    if (!toast) return
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    const { question: q, originalIndex } = toast
    setToast(null)
    setQuestions(prev => { const a = [...prev]; a.splice(originalIndex, 0, q); return a })
  }

  function addQuestion() {
    const t = newText.trim()
    if (!t || atLimit) return
    setQuestions(prev => [...prev, { id: `q-${Date.now()}`, text: t, source: 'manual' }])
    setNewText(''); setAddingNew(false)
  }

  const rowProps = {
    editingId, editText, savedId,
    onEditStart: startEdit, onEditChange: setEditText, onEditSave: saveEdit, onEditCancel: cancelEdit,
    onDelete: deleteQuestion, editInputRef,
  }

  /* ── Render ── */

  return (
    <>
      <style>{`
        @keyframes tooltipIn{from{opacity:0}to{opacity:1}}
        @keyframes modalIn{from{opacity:0;transform:translate(-50%,calc(-50% + 8px))}to{opacity:1;transform:translate(-50%,-50%)}}
        @keyframes fadeSlideIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {upsellPlan && <UpsellModal plan={upsellPlan} onClose={() => setUpsellPlan(null)} />}

      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{
          width: 36, height: 36, borderRadius: 16,
          background: tier === 'free' ? T.gray100 : T.primary100,
          color: tier === 'free' ? T.fg4 : T.primary,
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <IconMessageQuestion size={18} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ font: `600 16px/24px ${T.font}`, color: T.fg1, margin: 0 }}>
              Starter questions
            </h2>
            {tier === 'free' && <PlanTag plan="Premium" onClick={() => setUpsellPlan('Premium')} />}
          </div>
          <p style={{ ...helper12, margin: 0 }}>
            Shown to users the moment they open your agent — including questions tailored to the page they're on
          </p>
        </div>
        <Tip text="Up to 4 questions shown before the first message is sent. On Enterprise, context-rich questions are added automatically — tailored to the exact page your visitor is reading." />
      </div>

      {/* Content wrapper */}
      <div style={{ position: 'relative' }}>
      <div style={tier === 'free' ? {
        opacity: 0.4, pointerEvents: 'none', userSelect: 'none',
      } : {}}>

      {/* Context-rich group — Enterprise */}
      {tier === 'enterprise' && pageQuestions.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0 4px', marginBottom: 6,
          }}>
            <span style={{ font: `500 11px/16px ${T.font}`, color: T.fg4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Context-rich
            </span>
            <div style={{ flex: 1, height: 1, background: T.divider }} />
          </div>
          <DraggingCtx.Provider value={anyDragging}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={() => setAnyDragging(true)}
              onDragEnd={e => { setAnyDragging(false); handleDragEnd('page')(e) }}
              onDragCancel={() => setAnyDragging(false)}
            >
              <div style={{
                border: `1px solid ${T.divider}`,
                borderRadius: 16, background: '#fff', overflow: 'hidden',
              }}>
                <SortableContext items={pageQuestions.map(q => q.id)} strategy={verticalListSortingStrategy}>
                  {pageQuestions.map((q, i) => (
                    <SortableRow key={q.id} q={q} {...rowProps} radius={16}
                      isFirst={i === 0} isLast={i === pageQuestions.length - 1} />
                  ))}
                </SortableContext>
              </div>
            </DndContext>
          </DraggingCtx.Provider>
        </div>
      )}

      {/* Context-rich locked — Premium */}

      {tier === 'premium' && (
        <div style={{ marginBottom: 16 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0 4px', marginBottom: 6,
          }}>
            <span style={{ font: `500 11px/16px ${T.font}`, color: T.fg4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Context-rich
            </span>
            <div style={{ flex: 1, height: 1, background: T.divider }} />
          </div>
          <div
            onClick={() => setUpsellPlan('Enterprise')}
            style={{
              border: `1px dashed ${T.gray300}`,
              borderRadius: 16,
              padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              background: T.gray100,
              cursor: 'pointer',
              transition: 'border-color 0.12s, background 0.12s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = T.primary; (e.currentTarget as HTMLDivElement).style.background = T.primary8 }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = T.gray300; (e.currentTarget as HTMLDivElement).style.background = T.gray100 }}
          >
            <span style={{ font: `400 13px/18px ${T.font}`, color: T.fg4 }}>
              Questions tailored to the exact page your visitor is reading
            </span>
            <PlanTag plan="Enterprise" />
          </div>
        </div>
      )}

      {/* Manual group */}
      {((tier === 'enterprise' && pageQuestions.length > 0) || tier === 'premium') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px', marginBottom: 6 }}>
          <span style={{ font: `500 11px/16px ${T.font}`, color: T.fg4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Your questions
          </span>
          <div style={{ flex: 1, height: 1, background: T.divider }} />
        </div>
      )}
      <DraggingCtx.Provider value={anyDragging}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={() => setAnyDragging(true)}
          onDragEnd={e => { setAnyDragging(false); handleDragEnd('manual')(e) }}
          onDragCancel={() => setAnyDragging(false)}
        >
          <div style={{ marginBottom: 12 }}>
            {manualQuestions.length > 0 && (
              <div style={{
                border: `1px solid ${T.divider}`,
                borderRadius: 16, background: '#fff', overflow: 'hidden',
              }}>
                <SortableContext items={manualQuestions.map(q => q.id)} strategy={verticalListSortingStrategy}>
                  {manualQuestions.map((q, i) => (
                    <SortableRow key={q.id} q={q} {...rowProps}
                      isFirst={i === 0} isLast={i === manualQuestions.length - 1} />
                  ))}
                </SortableContext>
              </div>
            )}
          </div>
        </DndContext>
      </DraggingCtx.Provider>

      {/* Add question + counter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        {!atLimit ? (
          addingNew ? (
            <div style={{
              flex: 1,
              border: `1px solid ${T.primary}`,
              boxShadow: `0 0 0 3px ${T.primary24}`,
              borderRadius: 16, padding: '10px 16px',
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
                placeholder="What do your users typically ask first?"
                style={{
                  width: '100%', border: 'none', outline: 'none', padding: 0,
                  font: `400 14px/20px ${T.font}`, color: T.fg1,
                  background: 'transparent',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <span style={{ ...helper12, color: newText.length > MAX_CHARS * 0.85 ? T.warning : T.fg4 }}>
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
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                font: `500 13px/18px ${T.font}`, color: T.primary,
                background: 'transparent',
                border: '1px solid transparent',
                borderRadius: 16, padding: '7px 12px',
                cursor: 'pointer',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = T.primary100)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onMouseDown={e => { e.currentTarget.style.background = T.primary200; e.currentTarget.style.color = T.primaryActive }}
              onMouseUp={e => { e.currentTarget.style.background = T.primary100; e.currentTarget.style.color = T.primary }}>
              <IconPlus size={14} />
              Add a starter question
            </button>
          )
        ) : <span />}
        <span style={{ ...helper12, color: atLimit ? T.warning : T.fg4 }}>
          {atLimit ? `Limit reached (${totalCount}/${MAX_QUESTIONS})` : `${totalCount} of ${MAX_QUESTIONS} questions`}
        </span>
      </div>

      {/* Context-rich entry point */}
      <div style={{
        marginTop: 4,
        paddingTop: 16,
        borderTop: `1px solid ${T.divider}`,
      }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{ font: `500 13px/18px ${T.font}`, color: T.fg2 }}>
                Context-rich starter questions
              </span>
            </div>
            <p style={{ ...helper12, margin: '0 0 6px', color: T.fg4 }}>
              Questions tailored to exactly what your visitor is reading — generated from the live page in real time
            </p>
            <button
              type="button"
              onClick={() => setShowHowItWorks(v => !v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                font: `500 12px/16px ${T.font}`, color: T.primary,
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              }}
            >
              How it works
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{
                transform: showHowItWorks ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s',
              }}>
                <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {tier === 'enterprise' ? (
            <a
              href={DOCS_URL}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                font: `500 13px/18px ${T.font}`, color: T.fg2,
                background: '#fff',
                border: `1px solid ${T.border}`,
                borderRadius: 16, padding: '6px 12px',
                textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
                transition: 'border-color 0.12s, color 0.12s',
              }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = T.gray300; el.style.color = T.fg1 }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = T.border; el.style.color = T.fg2 }}
            >
              Manage context-rich starter questions
            </a>
          ) : (
            <button
              type="button"
              onClick={() => setUpsellPlan('Enterprise')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                font: `500 13px/18px ${T.font}`, color: T.fg3,
                background: '#fff',
                border: `1px solid ${T.border}`,
                borderRadius: 16, padding: '6px 12px',
                cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                transition: 'border-color 0.12s, color 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.gray300; e.currentTarget.style.color = T.fg2 }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.fg3 }}
            >
              Manage context-rich starter questions
            </button>
          )}
        </div>

        {/* How it works — expandable */}
        {showHowItWorks && (
          <ol style={{
            margin: '12px 0 0',
            padding: 0,
            listStyle: 'none',
            display: 'flex', flexDirection: 'column', gap: 0,
            border: `1px solid ${T.divider}`,
            borderRadius: 16,
            background: T.gray100,
            overflow: 'hidden',
            animation: 'fadeSlideIn 0.18s ease both',
          }}>
            {[
              {
                step: '1',
                text: 'Set up the Webpage Awareness Action to embed your agent on a website.',
              },
              {
                step: '2',
                text: 'When a visitor lands on the page, CustomGPT.ai reads the page content instantly.',
              },
              {
                step: '3',
                text: 'CustomGPT.ai generates a question immediately relevant to what that visitor is reading and places it at the top of your starter list.',
              },
              {
                step: '4',
                text: 'Questions are saved for 30 days and refreshed automatically. Manage them anytime from this page.',
              },
            ].map((item, i, arr) => (
              <li key={item.step} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 14px',
                borderBottom: i < arr.length - 1 ? `1px solid ${T.divider}` : 'none',
              }}>
                <span style={{
                  width: 18, height: 18,
                  borderRadius: '50%',
                  background: T.primary100,
                  color: T.primaryActive,
                  font: `600 10px/18px ${T.font}`,
                  textAlign: 'center',
                  flexShrink: 0,
                  marginTop: 1,
                }}>
                  {item.step}
                </span>
                <span style={{ font: `400 12px/18px ${T.font}`, color: T.fg3 }}>
                  {item.text}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      </div>{/* end disabled wrapper */}

      {/* Free overlay */}
      {tier === 'free' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 16, padding: 24,
          background: 'rgba(250,248,248,0.90)',
          borderRadius: 16,
          textAlign: 'center',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 16,
            background: '#E3E1FC',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 16 16" fill="none">
              <path d="M5.33337 7.33333V4.66667C5.33337 3.19391 6.52728 2 8.00004 2C9.4728 2 10.6667 3.19391 10.6667 4.66667V7.33333M8.66671 10.6667C8.66671 11.0349 8.36823 11.3333 8.00004 11.3333C7.63185 11.3333 7.33337 11.0349 7.33337 10.6667C7.33337 10.2985 7.63185 10 8.00004 10C8.66671 10.2985 8.66671 10.6667ZM4.66671 14H11.3334C12.0698 14 12.6667 13.403 12.6667 12.6667V8.66667C12.6667 7.93029 12.0698 7.33333 11.3334 7.33333H4.66671C3.93033 7.33333 3.33337 7.93029 3.33337 8.66667V12.6667C3.33337 13.403 3.93033 14 4.66671 14Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h3 style={{ font: `600 15px/22px ${T.font}`, color: T.fg1, margin: '0 0 6px' }}>
              Starter Questions is a Premium feature
            </h3>
            <p style={{ font: `400 13px/18px ${T.font}`, color: T.fg3, margin: 0, maxWidth: 300 }}>
              Add up to 4 questions that greet users the moment they open your agent.
              On Enterprise, context-rich questions are added automatically — tailored to the exact page your visitor is reading.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" onClick={() => setUpsellPlan('Premium')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                font: `600 13px/18px ${T.font}`, color: '#fff',
                background: T.primary, border: 'none',
                borderRadius: 16, padding: '9px 20px',
                cursor: 'pointer', boxShadow: T.primaryShadow,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = T.primaryHover)}
              onMouseLeave={e => (e.currentTarget.style.background = T.primary)}>
              <IconBolt size={14} /> Upgrade to Premium
            </button>
            <a href={DOCS_URL} target="_blank" rel="noopener noreferrer"
              style={{ font: `500 13px/18px ${T.font}`, color: T.fg3, textDecoration: 'none' }}
              onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = T.fg2)}
              onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = T.fg3)}>
              Learn more ↗
            </a>
          </div>
        </div>
      )}

      </div>{/* end relative wrapper */}

      {/* Undo toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24,
          left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 12,
          background: T.fg1, color: '#fff',
          padding: '10px 16px', borderRadius: 16,
          boxShadow: T.shadowModal,
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
