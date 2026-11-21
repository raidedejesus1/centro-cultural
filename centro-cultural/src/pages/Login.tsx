import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function entrar(e: any) {
    e.preventDefault(); if (busy) return
    setBusy(true); setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: clave })
    setBusy(false)
    if (error) setError('El email o la clave no coinciden. Probá de nuevo.')
  }
  return (
    <div className="min-h-screen grid place-items-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-caja text-papel p-6 text-center cinta">
          <p className="titulo text-5xl leading-none">Centro cultural</p>
          <p className="mt-1">Órdenes de trabajo · treinta años de sala</p>
        </div>
        <form onSubmit={entrar} className="bg-[#FBF6EA] border border-tinta/40 p-5 space-y-3">
          <label className="block text-sm font-bold">Email<input className="campo mt-1 font-normal" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="block text-sm font-bold">Clave<input className="campo mt-1 font-normal" type="password" autoComplete="current-password" required value={clave} onChange={(e) => setClave(e.target.value)} /></label>
          {error && <p role="alert" className="border-2 border-telon bg-[#f6dcd6] px-3 py-2 font-bold">{error}</p>}
          <button className="btn btn-rojo w-full" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
          <p className="ayuda">Para probar: <code>gestion@</code>, <code>coordinacion@</code>, <code>programacion@</code>, <code>cuadrilla@</code> o <code>elenco@</code> más <code>centro.test</code>. La clave de prueba está en el README.</p>
        </form>
      </div>
    </div>
  )
}
