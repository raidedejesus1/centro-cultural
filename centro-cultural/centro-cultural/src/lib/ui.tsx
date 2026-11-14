import { useEffect, useState, ReactNode } from 'react'
import { supabase } from './supabase'
import { ESTADO } from './const'

export const money = (n: any) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(n || 0))
export const num = (n: any) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(Number(n || 0))
export const fecha = (s?: string) => (s ? new Date(s).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '')
export const mesLabel = (s: string) => { const [y, m] = s.split('-'); return new Date(+y, +m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) }
export const toTs = (d: Date) => { const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00` }
export const must = (r: any) => { if (r.error) throw new Error(r.error.message); return r.data }

export function useData<T = any>(fn: () => Promise<T>, deps: any[] = []) {
  const [st, setSt] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true })
  const [n, setN] = useState(0)
  useEffect(() => {
    let vivo = true
    setSt((s) => ({ ...s, loading: true }))
    fn().then((data) => vivo && setSt({ data, error: null, loading: false }))
      .catch((e) => vivo && setSt({ data: null, error: e.message, loading: false }))
    return () => { vivo = false }
  }, [...deps, n])
  return { ...st, reload: () => setN((x) => x + 1) }
}

// Una acción = una llamada a una función de la base. Deshabilita el botón mientras corre,
// muestra el error donde se originó y avisa si la acción ya estaba hecha.
export function useAccion(onDone?: () => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  async function run(nombre: string, args: any, ok?: (r: any) => string) {
    if (busy) return null
    setBusy(true); setError(null); setAviso(null)
    const { data, error } = await supabase.rpc(nombre, args)
    setBusy(false)
    if (error) { setError(error.message); return null }
    if (data && data.ya_aplicado) setAviso('Esto ya estaba hecho, no se repitió nada.')
    else if (ok) setAviso(ok(data))
    onDone && onDone()
    return data ?? {}
  }
  return { run, busy, error, aviso, limpiar: () => { setError(null); setAviso(null) } }
}

export function Mensajes({ a, reload }: { a: any; reload?: () => void }) {
  return (
    <>
      {a.error && (
        <div role="alert" className="my-2 border-2 border-telon bg-[#f6dcd6] text-caja px-3 py-2">
          <p className="font-bold">{a.error}</p>
          <button className="btn btn-claro mt-2" onClick={() => { a.limpiar(); reload && reload() }}>Actualizar datos</button>
        </div>
      )}
      {a.aviso && <div role="status" className="my-2 border-2 border-[#3F6B4F] bg-[#dfe8d6] px-3 py-2">{a.aviso}</div>}
    </>
  )
}

export function Cargando({ q }: { q: any }) {
  if (q.loading && !q.data) return <p className="ayuda py-6">Cargando…</p>
  if (q.error) return (
    <div role="alert" className="border-2 border-telon bg-[#f6dcd6] p-3 my-3">
      <p className="font-bold">No pudimos cargar los datos: {q.error}</p>
      <button className="btn btn-claro mt-2" onClick={q.reload}>Actualizar datos</button>
    </div>
  )
  return null
}

export function Sello({ estado }: { estado: string }) {
  const e = ESTADO[estado] || { n: estado, c: '#444' }
  return <span className="sello" style={{ color: e.c }}>{e.n}</span>
}
export function Chip({ texto, color }: { texto: string; color: string }) {
  return <span className="sello" style={{ color }}>{texto}</span>
}
export function Card({ children, cinta, className = '' }: { children: ReactNode; cinta?: boolean; className?: string }) {
  return <section className={`bg-[#FBF6EA] border border-tinta/40 p-4 my-4 ${cinta ? 'cinta' : ''} ${className}`}>{children}</section>
}
export function Titulo({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-3">
      <h1 className="text-4xl text-telon leading-none">{children}</h1>
      {sub && <p className="ayuda mt-1 max-w-2xl">{sub}</p>}
    </header>
  )
}
export function Campo({ label, ayuda, children }: { label: string; ayuda?: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-bold">
      {label}
      <div className="mt-1 font-normal">{children}</div>
      {ayuda && <span className="ayuda font-normal">{ayuda}</span>}
    </label>
  )
}
export function Btn({ children, onClick, busy, rojo, claro, type = 'button', disabled }: any) {
  return (
    <button type={type} onClick={onClick} disabled={busy || disabled} className={`btn ${rojo ? 'btn-rojo' : ''} ${claro ? 'btn-claro' : ''}`}>
      {busy ? 'Un momento…' : children}
    </button>
  )
}
export function Barra({ partes, total }: { partes: { v: number; c: string; t: string }[]; total: number }) {
  return (
    <div className="h-5 w-full bg-papel2 border border-tinta/50 flex overflow-hidden" role="img" aria-label={partes.map((p) => `${p.t}: ${num(p.v)}`).join(', ')}>
      {partes.map((p, i) => <div key={i} title={p.t} style={{ width: `${Math.min(100, (100 * Math.max(p.v, 0)) / (total || 1))}%`, background: p.c }} />)}
    </div>
  )
}
export function descargarCsv(nombre: string, filas: any[]) {
  if (!filas.length) return
  const cols = Object.keys(filas[0])
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const txt = [cols.join(','), ...filas.map((f) => cols.map((c) => esc(f[c])).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob(['\ufeff' + txt], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = `${nombre}.csv`; a.click(); URL.revokeObjectURL(url)
}
