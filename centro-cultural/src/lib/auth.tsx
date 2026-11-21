import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from './supabase'

const Ctx = createContext<any>(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<any>(undefined)
  const [profile, setProfile] = useState<any>(null)
  const [perfilCargado, setPerfilCargado] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session === undefined) return
    if (!session) { setProfile(null); setPerfilCargado(true); return }
    setPerfilCargado(false)
    // El rol sale de la tabla de perfiles: no se elige ni se cambia desde ningún formulario.
    supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle().then(({ data }) => { setProfile(data); setPerfilCargado(true) })
  }, [session])

  const salir = () => supabase.auth.signOut()
  return <Ctx.Provider value={{ session, profile, cargando: session === undefined || !perfilCargado, salir }}>{children}</Ctx.Provider>
}
