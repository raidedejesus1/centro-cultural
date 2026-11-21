import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { NAV, ROL } from './lib/const'
import { configurado } from './lib/supabase'
import Login from './pages/Login'
import { Ordenes, OrdenDetalle } from './pages/Ordenes'
import Presupuestos from './pages/Presupuestos'
import Agenda from './pages/Agenda'
import Materiales from './pages/Materiales'
import Cuadrillas from './pages/Cuadrillas'
import Facturacion from './pages/Facturacion'
import Informes from './pages/Informes'
import { CuentaArea, MisTurnos, MiObra } from './pages/Personales'

function Shell({ children }: { children: any }) {
  const { profile, salir } = useAuth()
  const menu = NAV[profile.rol] || []
  const clase = ({ isActive }: any) => `block px-3 py-2 font-bold border-l-4 ${isActive ? 'border-telon bg-papel2' : 'border-transparent hover:bg-papel2'}`
  return (
    <div className="min-h-screen md:flex">
      <aside className="md:w-56 md:min-h-screen bg-papel border-r border-tinta/30 hidden md:block">
        <div className="bg-caja text-papel px-4 py-4"><div className="titulo text-2xl leading-none">Centro cultural</div><div className="text-xs opacity-80">Órdenes de trabajo</div></div>
        <nav className="py-2">{menu.map(([to, n]) => <NavLink key={to} to={to} className={clase}>{n}</NavLink>)}</nav>
      </aside>
      <div className="flex-1 min-w-0 pb-16 md:pb-0">
        <header className="bg-caja text-papel px-4 py-2 flex items-center justify-between gap-3">
          <span className="titulo text-xl md:hidden">Centro cultural</span>
          <span className="text-sm ml-auto"><b>{profile.nombre}</b> · {ROL[profile.rol]}</span>
          <button className="btn btn-claro !text-papel !border-papel" onClick={salir}>Salir</button>
        </header>
        <main className="max-w-6xl mx-auto p-4">{children}</main>
      </div>
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-caja text-papel flex overflow-x-auto" aria-label="Menú">
        {menu.map(([to, n]) => (
          <NavLink key={to} to={to} className={({ isActive }) => `px-3 py-3 text-sm font-bold whitespace-nowrap ${isActive ? 'bg-telon' : ''}`}>{n}</NavLink>
        ))}
      </nav>
    </div>
  )
}

export default function App() {
  const { session, profile, cargando, salir } = useAuth()
  if (!configurado) return <div className="p-8 max-w-xl"><h1 className="text-4xl text-telon">Falta configurar</h1><p>Creá el archivo <code>.env</code> con <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> (mirá <code>.env.example</code>).</p></div>
  if (cargando) return <p className="p-8">Cargando…</p>
  if (!session) return <Login />
  if (!profile) return <div className="p-8 max-w-xl"><h1 className="text-4xl text-telon">Sin rol asignado</h1><p>Tu cuenta todavía no tiene un rol. Pedile a gestión que lo asigne en la base.</p><button className="btn mt-3" onClick={salir}>Salir</button></div>
  const inicio = (NAV[profile.rol] || [['/ordenes']])[0][0]
  const permitido = (ruta: string) => (NAV[profile.rol] || []).some(([to]) => to === ruta) || (ruta === '/ordenes' && profile.rol !== 'cuadrilla' && profile.rol !== 'elenco')
  const R = (ruta: string, el: any) => <Route path={ruta} element={permitido(ruta.split('/:')[0]) ? el : <Navigate to={inicio} replace />} />
  return (
    <Shell>
      <Routes>
        {R('/ordenes', <Ordenes />)}
        {R('/ordenes/:id', <OrdenDetalle />)}
        {R('/presupuestos', <Presupuestos />)}
        {R('/agenda', <Agenda />)}
        {R('/materiales', <Materiales />)}
        {R('/cuadrillas', <Cuadrillas />)}
        {R('/facturacion', <Facturacion />)}
        {R('/informes', <Informes />)}
        {R('/cuenta', <CuentaArea />)}
        {R('/turnos', <MisTurnos />)}
        {R('/obra', <MiObra />)}
        <Route path="*" element={<Navigate to={inicio} replace />} />
      </Routes>
    </Shell>
  )
}
