import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const configurado = Boolean(url && key)
// Solo clave publishable (anon). La clave service_role nunca va en el navegador.
export const supabase = createClient(url || 'http://localhost', key || 'sin-clave')
