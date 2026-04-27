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
  IconAlertCircle,
  IconLoader2,
  IconX,
  IconInfoCircle,
  IconArrowBackUp,
  IconGripVertical,
  IconMessageQuestion,
  IconRefresh,
} from '@tabler/icons-react'

/* ── Types ──────────────────────────────────────────────────────────────── */

export type Tier = 'free' | 'premium' | 'enterprise'

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

const MAX_QUESTIONS = 4
const MAX_CHARS = 80

const AI_QUESTION_SETS: Question[][] = [
  [
    { id: 'ai-1', text: 'What are the key growth drivers in the analytical HPLC market?', source: 'ai' },
    { id: 'ai-2', text: 'Which regions have the highest LC/MS adoption rate?', source: 'ai' },
    { id: 'ai-3', text: 'How does column chemistry affect separation efficiency?', source: 'ai' },
    { id: 'ai-4', text: 'Who are the leading vendors in the GC/MS equipment market?', source: 'ai' },
  ],
  [
    { id: 'ai-5', text: 'What is the forecasted CAGR for the global HPLC market through 2030?', source: 'ai' },
    { id: 'ai-6', text: 'How do regulatory changes affect LC/MS instrument demand?', source: 'ai' },
    { id: 'ai-7', text: 'What are the main applications driving GC/MS market growth?', source: 'ai' },
    { id: 'ai-8', text: 'Which end-user segments spend the most on analytical columns?', source: 'ai' },
  ],
]

const AI_POOL: string[] = [
  'What is the total addressable market for HPLC instruments in pharma?',
  'How has mass spectrometry adoption changed in the last five years?',
  'What are the top competitive differentiators for GC/MS vendors?',
  'How does column selectivity influence method development time?',
  'What role does automation play in modern analytical workflows?',
  'Which emerging applications are driving demand for high-resolution LC/MS?',
  'How are supply chain disruptions affecting analytical instrument pricing?',
  'What is the market share breakdown between benchtop and portable GC systems?',
]

const INITIAL_MANUAL: Question[] = [
  { id: 'q-1', text: 'What is the global market for Analytical HPLC?', source: 'manual' },
  { id: 'q-2', text: 'Tell me about the LC/MS market.', source: 'manual' },
  { id: 'q-3', text: 'What is the combined GC and GC/MS market by geography?', source: 'manual' },
]

/* ── Design tokens ──────────────────────────────────────────────────────── */

const T = {
  // Brand
  primary:       '#7367F0',
  primaryHover:  '#685DD8',
  primaryActive: '#5C53C0',
  primary8:      'rgba(115,103,240,0.08)',
  primary16:     'rgba(115,103,240,0.16)',
  primary24:     'rgba(115,103,240,0.24)',
  primary100:    '#EAE8FD',  // --cg-primary-100
  primary200:    '#D5D1FB',  // --cg-primary-200
  primaryShadow: '0 2px 6px rgba(115,103,240,0.35)',
  // Neutrals
  fg1:    '#171717',
  fg2:    '#404040',
  fg3:    '#737373',
  fg4:    '#A3A3A3',
  gray50: '#FAFAFA',
  gray100:'#F5F5F5',
  gray200:'#E5E5E5',
  gray300:'#D4D4D4',
  divider:'#E5E5E5',   // --cg-divider
  border: '#E5E5E5',   // --cg-gray-200
  hoverBg:'rgba(38,38,38,0.04)',  // --cg-gray-hover-menu
  // Semantic
  success:    '#28C76F',
  success100: '#D6F5E3',  // --cg-success-100
  successText:'#1F9C57',
  warning:    '#FF9F43',
  warning100: '#FFE4C4',  // --cg-warning-100
  warningText:'#C27B34',
  danger:     '#EA5455',
  danger100:  '#FBDCDC',  // --cg-danger-100
  // Shadows (--cg-shadow-*)
  shadowSm:   '0 2px 4px rgba(23,23,23,0.08)',
  shadowCard: '0 4px 24px rgba(23,23,23,0.06)',
  shadowModal:'0 8px 32px rgba(23,23,23,0.16)',
  // Type
  font: '"Inter", system-ui, -apple-system, sans-serif',
} as const

const helper12: CSSProperties = { font: `400 12px/16px ${T.font}`, color: T.fg3 }
const body14: CSSProperties   = { font: `400 14px/20px ${T.font}`, color: T.fg2 }

const DraggingCtx = createContext(false)

/* ── AiBadge ────────────────────────────────────────────────────────────── */

function AiBadge() {
  return (
    <span style={{
      background: T.primary100,
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
          borderRadius: 6,
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

/* ── PlanTag ────────────────────────────────────────────────────────────── */

function LockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M5.33337 7.33333V4.66667C5.33337 3.19391 6.52728 2 8.00004 2C9.4728 2 10.6667 3.19391 10.6667 4.66667V7.33333M8.66671 10.6667C8.66671 11.0349 8.36823 11.3333 8.00004 11.3333C7.63185 11.3333 7.33337 11.0349 7.33337 10.6667C7.33337 10.2985 7.63185 10 8.00004 10C8.36823 10 8.66671 10.2985 8.66671 10.6667ZM4.66671 14H11.3334C12.0698 14 12.6667 13.403 12.6667 12.6667V8.66667C12.6667 7.93029 12.0698 7.33333 11.3334 7.33333H4.66671C3.93033 7.33333 3.33337 7.93029 3.33337 8.66667V12.6667C3.33337 13.403 3.93033 14 4.66671 14Z" stroke="#7367F0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function PlanTag({ plan }: { plan: 'Premium' | 'Enterprise' }) {
  return (
    <span style={{
      display: 'inline-flex',
      height: 24,
      padding: '8px 12px',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      background: '#E3E1FC',
      color: T.primaryActive,
      font: `600 11px/16px ${T.font}`,
      whiteSpace: 'nowrap',
      flexShrink: 0,
      boxSizing: 'border-box' as const,
    }}>
      <LockIcon />
      {plan}
    </span>
  )
}

/* ── Locked gate (Free tier) ────────────────────────────────────────────── */

const DOCS_URL = 'https://docs.customgpt.ai/docs/how-context-rich-starter-questions-work'

function LockedGate() {
  return (
    <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>

      {/* Ghost preview — faded */}
      <div style={{ opacity: 0.18, pointerEvents: 'none', userSelect: 'none' }}>
        {/* AI toggle ghost */}
        <div style={{
          border: `1px solid ${T.divider}`, borderRadius: 6,
          padding: '16px 20px', marginBottom: 12, background: '#fff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ font: `500 14px/20px ${T.font}`, color: T.fg1 }}>AI-generated questions</span>
              <p style={{ font: `400 12px/16px ${T.font}`, color: T.fg3, margin: '2px 0 0' }}>Auto-created from your content</p>
            </div>
            <div style={{
              width: 36, height: 20, borderRadius: 1000,
              background: T.gray300, position: 'relative', flexShrink: 0,
            }}>
              <span style={{
                position: 'absolute', top: 3, left: 3,
                width: 14, height: 14, borderRadius: '50%', background: '#fff',
              }} />
            </div>
          </div>
        </div>
        {/* Question rows ghost */}
        <div style={{ border: `1px solid ${T.divider}`, borderRadius: 6, background: '#fff' }}>
          {INITIAL_MANUAL.map((q, i) => (
            <div key={q.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px',
              borderBottom: i < INITIAL_MANUAL.length - 1 ? `1px solid ${T.divider}` : 'none',
            }}>
              <IconGripVertical size={16} style={{ color: T.fg4, flexShrink: 0 }} />
              <span style={{ width: 28, flexShrink: 0 }} />
              <span style={{ font: `400 14px/20px ${T.font}`, color: T.fg2 }}>{q.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Lock overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,255,255,0.92)',
        gap: 16, padding: 32,
        textAlign: 'center',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: T.primary100, color: T.primary,
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 16 16" fill="none">
            <path d="M5.33337 7.33333V4.66667C5.33337 3.19391 6.52728 2 8.00004 2C9.4728 2 10.6667 3.19391 10.6667 4.66667V7.33333M8.66671 10.6667C8.66671 11.0349 8.36823 11.3333 8.00004 11.3333C7.63185 11.3333 7.33337 11.0349 7.33337 10.6667C7.33337 10.2985 7.63185 10 8.00004 10C8.36823 10 8.66671 10.2985 8.66671 10.6667ZM4.66671 14H11.3334C12.0698 14 12.6667 13.403 12.6667 12.6667V8.66667C12.6667 7.93029 12.0698 7.33333 11.3334 7.33333H4.66671C3.93033 7.33333 3.33337 7.93029 3.33337 8.66667V12.6667C3.33337 13.403 3.93033 14 4.66671 14Z" stroke="#7367F0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <h3 style={{ font: `600 15px/22px ${T.font}`, color: T.fg1, margin: '0 0 6px' }}>
            Starter Questions is a Premium feature
          </h3>
          <p style={{ font: `400 13px/18px ${T.font}`, color: T.fg3, margin: 0, maxWidth: 320 }}>
            Add up to 4 questions to guide users from the very first message.
            On Enterprise, AI generates them automatically from your knowledge base.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            font: `600 13px/18px ${T.font}`, color: '#fff',
            background: T.primary, border: 'none',
            borderRadius: 8, padding: '9px 20px',
            cursor: 'pointer', boxShadow: T.primaryShadow,
          }}
            onMouseEnter={e => (e.currentTarget.style.background = T.primaryHover)}
            onMouseLeave={e => (e.currentTarget.style.background = T.primary)}>
            <IconBolt size={14} /> Upgrade to Premium
          </button>
          <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" style={{
            font: `500 13px/18px ${T.font}`, color: T.fg3,
            textDecoration: 'none',
          }}
            onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = T.fg2)}
            onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = T.fg3)}>
            Learn more ↗
          </a>
        </div>
      </div>
    </div>
  )
}

const HINT_MAX = 120

function AiHintInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false)
  const near = value.length > HINT_MAX * 0.85
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center',
        border: `1px solid ${focused ? T.primary : T.gray200}`,
        borderRadius: 8,
        background: '#fff',
        padding: '0 10px',
        gap: 6,
        transition: 'border-color 0.12s',
        boxShadow: focused ? `0 0 0 3px ${T.primary24}` : 'none',
      }}>
        <IconMessageQuestion size={13} style={{ color: T.fg4, flexShrink: 0 }} />
        <input
          value={value}
          onChange={e => onChange(e.target.value.slice(0, HINT_MAX))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder='e.g. "enterprise buyers asking about ROI and integration costs"'
          style={{
            flex: 1, border: 'none', outline: 'none', padding: '7px 0',
            font: `400 13px/18px ${T.font}`, color: T.fg1,
            background: 'transparent',
          }}
        />
        {value.length > 0 && (
          <span style={{ font: `400 11px/16px ${T.font}`, color: near ? T.warning : T.fg4, flexShrink: 0 }}>
            {value.length}/{HINT_MAX}
          </span>
        )}
      </div>
      <p style={{ ...helper12, margin: '4px 0 0', color: T.fg4 }}>
        Optional — used on the next Regenerate to tailor questions to your audience
      </p>
    </div>
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
  onRegenerate: (q: Question) => void
  regeneratingId: string | null
  editInputRef: React.RefObject<HTMLInputElement | null>
  isFirst?: boolean
  isLast?: boolean
}

function SortableRow(props: RowProps) {
  const {
    q, editingId, editText, savedId,
    onEditStart, onEditChange, onEditSave, onEditCancel,
    onDelete, onRegenerate, regeneratingId, editInputRef,
    isFirst, isLast,
  } = props

  const isRegenerating = regeneratingId === q.id
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
    borderRadius: isFirst && isLast ? 6 : isFirst ? '6px 6px 0 0' : isLast ? '0 0 6px 6px' : 0,
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
      {/* Drag handle — always visible at 30% opacity, full on hover */}
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

      {/* AI badge or spacer */}
      {q.source === 'ai' ? (
        <span style={{ flexShrink: 0 }}><AiBadge /></span>
      ) : (
        <span style={{ width: 28, flexShrink: 0 }} />
      )}

      {/* Text / editor */}
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
                borderRadius: 8,
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
            <button type="button" onClick={onEditSave}
              style={{ font: `600 12px/16px ${T.font}`, color: T.primary, background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Save
            </button>
          </div>
        ) : isRegenerating ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconLoader2 size={13} style={{ animation: 'spin 1s linear infinite', flexShrink: 0, color: T.fg4 }} />
            <span style={{ ...body14, color: T.fg4 }}>Generating…</span>
          </span>
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

      {/* Actions */}
      {!isEditing && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          opacity: showActions ? 1 : 0,
          transition: 'opacity 0.12s',
          flexShrink: 0,
        }}>
          {q.source === 'ai' && (
            <Tooltip label="Regenerate question" side="top">
              <button type="button" onClick={() => onRegenerate(q)}
                tabIndex={showActions ? 0 : -1}
                style={{ color: T.fg3, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px 6px', borderRadius: 4 }}
                onMouseEnter={e => (e.currentTarget.style.color = T.primary)}
                onMouseLeave={e => (e.currentTarget.style.color = T.fg3)}>
                <IconRefresh size={15} />
              </button>
            </Tooltip>
          )}
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
  const [manualQuestions, setManualQuestions] = useState<Question[]>(INITIAL_MANUAL)
  const [aiQuestions, setAiQuestions]         = useState<Question[]>([])
  const [crOn, setCrOn]               = useState(false)
  const [crStatus, setCrStatus]       = useState<CRStatus>('off')
  const [genCount, setGenCount]       = useState(0)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [anyDragging, setAnyDragging] = useState(false)
  const [savedId, setSavedId]         = useState<string | null>(null)
  const [showAiGuard, setShowAiGuard] = useState(false)
  const poolIndexRef    = useRef(0)
  const aiGuardShownRef = useRef(false)
  const savedTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText]   = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [newText, setNewText]     = useState('')
  const [aiHint, setAiHint] = useState('')
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editInputRef  = useRef<HTMLInputElement | null>(null)
  const newInputRef   = useRef<HTMLInputElement | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const displayedQuestions: Question[] = crOn ? aiQuestions : manualQuestions
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

  useEffect(() => {
    if (tier !== 'enterprise' && crOn) {
      setAiQuestions([]); setCrOn(false); setCrStatus('off')
    }
  }, [tier])

  /* ── Handlers ── */

  function handleToggleCR() {
    if (!crOn) {
      // One-time guard when manual questions exist
      if (manualQuestions.length > 0 && !aiGuardShownRef.current) {
        setShowAiGuard(true)
        return
      }
      enableAI()
    } else {
      setAiQuestions([])
      setCrOn(false); setCrStatus('off')
    }
  }

  function enableAI() {
    aiGuardShownRef.current = true
    setShowAiGuard(false)
    setCrOn(true); setCrStatus('generating')
    setTimeout(() => {
      setAiQuestions(AI_QUESTION_SETS[0])
      setCrStatus('ready')
      setGenCount(1)
    }, 1800)
  }

  function handleRegenerateOne(q: Question) {
    if (regeneratingId) return
    setRegeneratingId(q.id)
    setTimeout(() => {
      const currentTexts = aiQuestions.map(aq => aq.text)
      const available = AI_POOL.filter(t => !currentTexts.includes(t))
      const pool = available.length > 0 ? available : AI_POOL
      const next = pool[poolIndexRef.current % pool.length]
      poolIndexRef.current += 1
      setAiQuestions(prev => prev.map(aq =>
        aq.id === q.id ? { ...aq, id: `ai-${Date.now()}`, text: next } : aq
      ))
      setRegeneratingId(null)
    }, 1200)
  }

  function handleRegenerate() {
    setCrStatus('generating')
    setAiQuestions([])
    setTimeout(() => {
      const nextSet = AI_QUESTION_SETS[genCount % AI_QUESTION_SETS.length]
      setAiQuestions(nextSet)
      setCrStatus('ready')
      setGenCount(c => c + 1)
    }, 1800)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const aId = String(active.id), oId = String(over.id)
    const setter = crOn ? setAiQuestions : setManualQuestions
    setter(prev => arrayMove(prev, prev.findIndex(q => q.id === aId), prev.findIndex(q => q.id === oId)))
  }

  function startEdit(q: Question) { setEditingId(q.id); setEditText(q.text) }

  function saveEdit() {
    if (!editingId) return
    const t = editText.trim()
    if (!t) { cancelEdit(); return }
    const up = (prev: Question[]) => prev.map(q => q.id === editingId ? { ...q, text: t } : q)
    if (crOn) setAiQuestions(up); else setManualQuestions(up)
    // Flash green confirmation on the saved row
    const id = editingId
    setSavedId(id)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setSavedId(null), 700)
    setEditingId(null); setEditText('')
  }

  function cancelEdit() { setEditingId(null); setEditText('') }

  function deleteQuestion(q: Question) {
    const idx = displayedQuestions.findIndex(dq => dq.id === q.id)
    if (crOn) {
      setAiQuestions(prev => prev.filter(p => p.id !== q.id))
      if (aiQuestions.length === 1) {
        setCrOn(false)
        setCrStatus('off')
      }
    } else {
      setManualQuestions(prev => prev.filter(p => p.id !== q.id))
    }
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ question: q, originalIndex: idx })
    toastTimerRef.current = setTimeout(() => setToast(null), 10000)
  }

  function undoDelete() {
    if (!toast) return
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    const { question: q, originalIndex } = toast
    setToast(null)
    if (q.source === 'ai') {
      setAiQuestions(prev => { const a = [...prev]; a.splice(originalIndex, 0, q); return a })
      if (!crOn) { setCrOn(true); setCrStatus('ready') }
    } else {
      setManualQuestions(prev => { const a = [...prev]; a.splice(originalIndex, 0, q); return a })
    }
  }

  function addQuestion() {
    const t = newText.trim()
    if (!t || atLimit) return
    const source = crOn ? 'ai' : 'manual' as const
    const setter = crOn ? setAiQuestions : setManualQuestions
    setter(prev => [...prev, { id: `q-${Date.now()}`, text: t, source }])
    setNewText(''); setAddingNew(false)
  }

  /* ── Status chip ── */

  function StatusChip() {
    const base: CSSProperties = {
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 4,
      font: `500 12px/16px ${T.font}`, whiteSpace: 'nowrap',
    }
    if (!crOn) return (
      <span style={{ ...base, background: T.gray100, color: T.fg3 }}>Your questions</span>
    )
    if (crStatus === 'generating') return (
      <span style={{ ...base, background: T.primary100, color: '#5C53C0' }}>
        <IconLoader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Generating…
      </span>
    )
    if (crStatus === 'no-content') return (
      <span style={{ ...base, background: T.warning100, color: T.warningText }}>
        <IconAlertCircle size={11} /> Add content first
      </span>
    )
    if (crStatus === 'error') return (
      <span style={{ ...base, background: T.danger100, color: T.danger }}>
        <IconAlertCircle size={11} /> Generation failed
      </span>
    )
    return (
      <span style={{ ...base, background: T.success100, color: T.successText }}>
        <IconBolt size={11} /> {aiQuestions.length} AI questions ready
      </span>
    )
  }

  /* ── Shared row props ── */

  const rowProps = {
    editingId, editText, savedId,
    onEditStart: startEdit, onEditChange: setEditText, onEditSave: saveEdit, onEditCancel: cancelEdit,
    onDelete: deleteQuestion, onRegenerate: handleRegenerateOne,
    regeneratingId, editInputRef,
  }

  /* ── Render ── */

  return (
    <>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
        @keyframes fadeSlideIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes modalIn{from{opacity:0;transform:translate(-50%,calc(-50% + 8px))}to{opacity:1;transform:translate(-50%,-50%)}}
        @keyframes tooltipIn{from{opacity:0}to{opacity:1}}
      `}</style>

      {/* AI guard modal */}
      {showAiGuard && (
        <>
          <div
            onClick={() => setShowAiGuard(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(47,61,57,0.5)', zIndex: 60 }}
          />
          <div style={{
            position: 'fixed',
            top: '50%', left: '50%',
            background: '#fff',
            borderRadius: 8,
            padding: 24,
            width: 360,
            maxWidth: 'calc(100vw - 32px)',
            boxShadow: T.shadowModal,
            zIndex: 61,
            animation: 'modalIn 0.2s cubic-bezier(0.2,0.8,0.2,1) forwards',
          }}>
            <h3 style={{ font: `600 16px/24px ${T.font}`, color: T.fg1, margin: '0 0 8px' }}>
              Enable AI questions?
            </h3>
            <p style={{ font: `400 14px/20px ${T.font}`, color: T.fg3, margin: '0 0 20px' }}>
              AI questions will replace your current list. If you turn AI off, your questions are restored.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setShowAiGuard(false)}
                style={{
                  font: `600 13px/18px ${T.font}`, color: T.fg2,
                  background: '#fff', border: `1px solid ${T.border}`,
                  borderRadius: 8, padding: '7px 16px', cursor: 'pointer',
                }}>
                Cancel
              </button>
              <button type="button" onClick={enableAI}
                style={{
                  font: `600 13px/18px ${T.font}`, color: '#fff',
                  background: T.primary, border: 'none',
                  borderRadius: 8, padding: '7px 16px', cursor: 'pointer',
                  boxShadow: T.primaryShadow,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = T.primaryHover)}
                onMouseLeave={e => (e.currentTarget.style.background = T.primary)}>
                <IconBolt size={14} /> Enable AI
              </button>
            </div>
          </div>
        </>
      )}

      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{
          width: 36, height: 36, borderRadius: 8,
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
            {tier === 'free' && <PlanTag plan="Premium" />}
          </div>
          <p style={{ ...helper12, margin: 0 }}>
            Shown to users when they open your agent
          </p>
        </div>
        <Tip text="Add up to 4 questions to help users start the conversation." />
      </div>

      {/* Free tier — locked gate */}
      {tier === 'free' ? <LockedGate /> : (
      <>

      {/* AI toggle card */}
      <div style={{
        border: `1px solid ${crOn ? '#D5D1FB' : T.divider}`,
        borderRadius: 6,
        background: crOn ? T.primary8 : '#fff',
        padding: '16px 20px',
        marginBottom: 12,
        transition: 'all 0.15s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ font: `500 14px/20px ${T.font}`, color: tier === 'premium' ? T.fg3 : T.fg1 }}>
                AI-generated questions
              </span>
              {tier === 'premium'
                ? <PlanTag plan="Enterprise" />
                : <Tip text="Automatically generated from your uploaded documents and URLs." />}
            </div>
            <p style={{ ...helper12, margin: '2px 0 0' }}>Auto-created from your content</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {tier === 'enterprise' && <StatusChip />}
            {tier === 'enterprise' && crOn && crStatus === 'ready' && (
              <button type="button" onClick={handleRegenerate}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  font: `500 12px/16px ${T.font}`,
                  color: T.fg3, background: 'none',
                  border: `1px solid ${T.gray200}`,
                  borderRadius: 6, padding: '3px 8px',
                  cursor: 'pointer', flexShrink: 0,
                  transition: 'color 0.12s, border-color 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = T.primary; e.currentTarget.style.borderColor = T.primary }}
                onMouseLeave={e => { e.currentTarget.style.color = T.fg3; e.currentTarget.style.borderColor = T.gray200 }}
              >
                <IconRefresh size={13} /> Regenerate
              </button>
            )}
            {tier === 'enterprise' && crOn && crStatus === 'error' && (
              <button type="button" onClick={handleRegenerate}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  font: `500 12px/16px ${T.font}`,
                  color: T.danger, background: 'none',
                  border: `1px solid rgba(234,84,85,0.3)`,
                  borderRadius: 6, padding: '3px 8px',
                  cursor: 'pointer', flexShrink: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.danger }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(234,84,85,0.3)' }}
              >
                <IconRefresh size={13} /> Retry
              </button>
            )}
            {/* Toggle — disabled on Premium */}
            {tier === 'premium' ? (
              <Tooltip label="Upgrade to Enterprise to use AI questions" side="top" width={200}>
                <button type="button" disabled aria-disabled="true"
                  style={{
                    position: 'relative', width: 36, height: 20,
                    borderRadius: 1000, background: T.gray200,
                    border: 'none', cursor: 'not-allowed', padding: 0,
                    flexShrink: 0, outline: 'none', opacity: 0.6,
                  }}>
                  <span style={{
                    position: 'absolute', top: 3, left: 3,
                    width: 14, height: 14,
                    borderRadius: '50%', background: '#fff',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                  }} />
                </button>
              </Tooltip>
            ) : (
              <button
                type="button" role="switch"
                aria-checked={crOn}
                aria-label="Enable AI-generated starter questions"
                onClick={handleToggleCR}
                style={{
                  position: 'relative', width: 36, height: 20,
                  borderRadius: 1000,
                  background: crOn ? T.primary : T.gray300,
                  border: 'none', cursor: 'pointer', padding: 0,
                  transition: 'background 0.15s', flexShrink: 0, outline: 'none',
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, left: crOn ? 19 : 3,
                  width: 14, height: 14,
                  borderRadius: '50%', background: '#fff',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                  transition: 'left 0.15s',
                }} />
              </button>
            )}
          </div>
        </div>

        {/* Priming copy — visible only when AI is off */}
        {!crOn && tier !== 'premium' && (
          <p style={{ ...helper12, margin: '10px 0 0', color: T.fg4 }}>
            Generates 4 questions from your content. You can edit or regenerate any of them.
          </p>
        )}
        {tier === 'premium' && (
          <p style={{ ...helper12, margin: '10px 0 0', color: T.fg4 }}>
            AI question generation requires an Enterprise plan.{' '}
            <a href={DOCS_URL} target="_blank" rel="noopener noreferrer"
              style={{ color: T.fg3, textDecoration: 'underline' }}>
              Learn more ↗
            </a>
          </p>
        )}

        {/* Audience hint — refinement input */}
        {crOn && (crStatus === 'ready' || crStatus === 'error') && (
          <div style={{
            marginTop: 12, paddingTop: 12,
            borderTop: `1px solid ${T.divider}`,
          }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 4,
              font: `500 12px/16px ${T.font}`, color: T.fg3,
              marginBottom: 6,
            }}>
              Audience or topic focus
              <Tip text="Tell the AI who your users are or what topics matter most. Used on the next Regenerate." />
            </label>
            <AiHintInput value={aiHint} onChange={setAiHint} />
          </div>
        )}

        {/* No content warning */}
        {crOn && crStatus === 'no-content' && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            marginTop: 12, padding: '10px 12px',
            background: T.warning100, border: `1px solid rgba(255,159,67,0.24)`,
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
      </div>

      {/* Question list */}
      {crStatus === 'generating' ? (
        <div style={{
          border: `1px solid ${T.divider}`,
          borderRadius: 6, background: '#fff',
          marginBottom: 12, overflow: 'hidden',
        }}>
          {[72, 56, 84, 60].map((w, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px',
              borderBottom: i < 3 ? `1px solid ${T.divider}` : 'none',
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                background: 'linear-gradient(90deg,rgba(115,103,240,0.08) 0%,rgba(115,103,240,0.20) 50%,rgba(115,103,240,0.08) 100%)',
                backgroundSize: '600px 100%',
                animation: `shimmer 1.6s ease-in-out infinite`,
                animationDelay: `${i * 0.12}s`,
              }} />
              <div style={{ width: 28, flexShrink: 0 }} />
              <div style={{
                height: 20, borderRadius: 4,
                width: `${w}%`,
                background: 'linear-gradient(90deg,rgba(115,103,240,0.07) 0%,rgba(115,103,240,0.18) 50%,rgba(115,103,240,0.07) 100%)',
                backgroundSize: '600px 100%',
                animation: `shimmer 1.6s ease-in-out infinite`,
                animationDelay: `${i * 0.12}s`,
              }} />
            </div>
          ))}
        </div>
      ) : displayedQuestions.length > 0 ? (
        <DraggingCtx.Provider value={anyDragging}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={() => setAnyDragging(true)}
            onDragEnd={e => { setAnyDragging(false); handleDragEnd(e) }}
            onDragCancel={() => setAnyDragging(false)}
          >
            <div style={{
              border: `1px solid ${T.divider}`,
              borderRadius: 6,
              background: '#fff',
              marginBottom: 12,
              overflow: 'visible',
              animation: crOn ? 'fadeSlideIn 0.28s cubic-bezier(0.2,0.7,0.3,1) both' : undefined,
            }}>
              <SortableContext items={displayedQuestions.map(q => q.id)} strategy={verticalListSortingStrategy}>
                {displayedQuestions.map((q, i) => (
                  <SortableRow key={q.id} q={q} {...rowProps}
                    isFirst={i === 0} isLast={i === displayedQuestions.length - 1} />
                ))}
              </SortableContext>
            </div>
          </DndContext>
        </DraggingCtx.Provider>
      ) : null}

      {/* Add question + counter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        {!atLimit ? (
          addingNew ? (
            <div style={{
              flex: 1,
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
                borderRadius: 6, padding: '7px 12px',
                cursor: 'pointer',
                transition: 'background 0.12s, color 0.12s',
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

      {/* Undo toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24,
          left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 12,
          background: T.fg1, color: '#fff',
          padding: '10px 16px', borderRadius: 8,
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
      )}
    </>
  )
}
