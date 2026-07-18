import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiRequestError } from '../lib/api'
import { formatRelativeTime } from '../lib/formatRelativeTime'

import {
  HiOutlinePlus,
  HiOutlineRefresh,
  HiOutlineDocumentText,
  HiOutlineClock,
  HiOutlineSearch,
  HiOutlineX,
} from 'react-icons/hi'

type Note = {
  id: number
  title: string
  content: string
  updatedAt?: string | null
}


function clampPreview(text: string) {
  const normalized = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return normalized
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-4 shadow-xl overflow-hidden">
      <div className="h-4 w-3/4 rounded bg-white/10 animate-pulse" />
      <div className="mt-3 h-3 w-1/2 rounded bg-white/8 animate-pulse" />
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full rounded bg-white/8 animate-pulse" />
        <div className="h-3 w-11/12 rounded bg-white/8 animate-pulse" />
        <div className="h-3 w-9/12 rounded bg-white/8 animate-pulse" />
      </div>
    </div>
  )
}

function NoteCard({ note, onOpen }: { note: Note; onOpen: (id: number) => void }) {
  const preview = useMemo(() => {
    return clampPreview(note.content).slice(0, 120)
  }, [note.content])


  return (
    <button
      type="button"
      onClick={() => onOpen(note.id)}
      className="text-left rounded-2xl border border-white/[0.07] bg-[#111118] p-4 shadow-xl transition-all hover:border-white/[0.12] hover:bg-[#16161F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF] overflow-hidden w-full"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <HiOutlineDocumentText className="w-4 h-4 text-[#6C63FF] shrink-0" />
            <h3 className="text-sm font-semibold text-white truncate">{note.title}</h3>
          </div>

          <div className="mt-2 flex items-center gap-1 text-xs text-[#94A3B8]">
            <HiOutlineClock className="w-3.5 h-3.5" />
            <span>Updated {formatRelativeTime(note.updatedAt)}</span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-[#94A3B8] leading-snug line-clamp-3">
        {preview || 'No preview available'}
      </p>

      {/* Subtle accent */}
      <div
        aria-hidden="true"
        className="pointer-events-none mt-3 h-px w-full"
        style={{ background: 'linear-gradient(90deg, rgba(108,99,255,0.0), rgba(108,99,255,0.35), rgba(108,99,255,0.0))' }}
      />
    </button>
  )
}

export default function NotesPage() {
  const navigate = useNavigate()

  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return notes
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    )
  }, [notes, search])

  const fetchNotes = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.notes.list()
      const mapped: Note[] = (res.notes ?? []).map((n: any) => ({
        id: Number(n.id),
        title: String(n.title ?? ''),
        content: String(n.content ?? ''),
        updatedAt: (n.updatedAt ?? n.updated_at ?? null) as string | null,
      }))
      setNotes(mapped)

    } catch (e: unknown) {
      // A 401 means api.ts already cleared the token and the global
      // AuthEventHandler (see App.tsx) is already redirecting to Login —
      // skip showing an inline error while that happens.
      if (e instanceof ApiRequestError && e.status === 401) return

      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onOpenNote = (id: number) => {
    // Editor will be implemented next step.
    // For now navigate to the intended editor route.
    navigate(`/notes/${id}`)
  }

  const onCreateNote = () => {
    // Next step will implement editor for creating.
    navigate('/notes/new')
  }

  return (
    <div className="relative min-h-screen bg-[#0A0A0F] px-4 pt-10 pb-[calc(7rem+env(safe-area-inset-bottom))] overflow-x-hidden">
      {/* Ambient orb */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[-110px] left-1/2 -translate-x-1/2 w-[480px] h-[340px] rounded-full"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(108,99,255,0.16) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      <div className="relative mx-auto max-w-sm space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-white" style={{ letterSpacing: '-0.03em' }}>
            Notes
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">Your saved DBMS study notes.</p>
        </div>

        {/* Search */}
        {!loading && !error && notes.length > 0 && (
          <div className="relative">
            <HiOutlineSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4B5563]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes…"
              aria-label="Search notes"
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-9 text-sm text-[#E2E8F0] placeholder-[#4B5563] outline-none transition-colors focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4B5563] hover:text-[#94A3B8] transition-colors"
              >
                <HiOutlineX className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-red-200">Couldn’t load notes</p>
                <p className="mt-1 text-xs text-red-200/80">{error}</p>
              </div>
              <div className="mt-1">
                <button
                  type="button"
                  onClick={fetchNotes}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#6C63FF] px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-[#6C63FF]/20 hover:bg-[#7C6FFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]"
                >
                  <HiOutlineRefresh className="w-4 h-4" /> Retry
                </button>
              </div>
            </div>
          </div>
        ) : notes.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5 text-center shadow-xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#6C63FF]/12 ring-1 ring-[#6C63FF]/20">
              <HiOutlineDocumentText className="w-5 h-5 text-[#6C63FF]" />
            </div>
            <p className="mt-4 text-sm font-semibold text-white">📝 No notes yet</p>
            <p className="mt-2 text-xs text-[#64748B]">Create your first note to get started.</p>

            <button
              type="button"
              onClick={onCreateNote}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#6C63FF]/30 bg-[#6C63FF]/10 px-4 py-2 text-xs font-semibold text-[#A5A0FF] hover:bg-[#6C63FF]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]"
            >
              <span className="text-[#6C63FF]">[ + Create Note ]</span>
            </button>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5 text-center shadow-xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.05] ring-1 ring-white/[0.08]">
              <HiOutlineSearch className="w-5 h-5 text-[#64748B]" />
            </div>
            <p className="mt-4 text-sm font-semibold text-white">No matching notes</p>
            <p className="mt-2 text-xs text-[#64748B]">Try a different search term.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotes.map((note) => (
              <NoteCard key={note.id} note={note} onOpen={onOpenNote} />
            ))}
          </div>
        )}
      </div>

      {/* Floating action button */}
      <button
        type="button"
        aria-label="New note"
        onClick={onCreateNote}
        className="fixed right-4 bottom-[calc(88px+env(safe-area-inset-bottom))] z-50 h-14 w-14 rounded-2xl bg-[#6C63FF] shadow-lg shadow-[#6C63FF]/25 flex items-center justify-center hover:bg-[#7C6FFF] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]"
      >
        <HiOutlinePlus className="w-6 h-6 text-white" />
      </button>
    </div>
  )
}

