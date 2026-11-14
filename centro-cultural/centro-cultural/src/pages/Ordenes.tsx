import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ESTADO, ESTADO_PRES, TIPO_ORDEN } from '../lib/const'
import { Barra, Btn, Campo, Card, Cargando, Mensajes, Sello, Titulo, fecha, money, must, num, toTs, useAccion, useData } from '../lib/ui'
import { AprobarPresupuesto } from './Presupuestos'
import { AgendarForm, ListaActividades } from './Agenda'

const veCostos = (rol: string) => ['gestion', 'coordinacion', 'responsable'].includes(rol)

/* ---------------------------------------------------------------- Lista */
export function Ordenes() {
  const { profile } = useAuth()
  const nav = useNavigate()
  const [fe, setFe] = useState(''); const [ft, setFt] = useState(''); const [fa, setFa] = useState(''); const [buscar, setBuscar] = useState('')
  const [nueva, setNueva] = useState(false)
  const q = useData(async () => {
    const ordenes = must(await supabase.from('ordenes').select('*').order('id', { ascending: false }))
    const areas = must(await supabase.from('areas').select('id,nombre'))
    const elencos = must(await supabase.from('elencos').select('id,nombre'))
    const costos = veCostos(profile.rol) ? must(await supabase.from('v_costo_orden').select('orden_id,aprobado,costo_real')) : []
    return { ordenes, areas, elencos, costos }
  })
  const d: any = q.data
  const area = (id: number) => d?.areas.find((a: any) => a.id === id)?.nombre || '—'
  const lista = (d?.ordenes || []).filter((o: any) => (!fe || o.estado === fe) && (!ft || o.tipo === ft) && (!fa || String(o.area_solicitante_id) === fa || String(o.area_ejecutora_id) === fa) &&
    (!buscar || (o.titulo + o.codigo).toLowerCase().includes(buscar.toLowerCase())))
  const puedeCrear = profile.rol !== 'cuadrilla' && profile.rol !== 'elenco'
  return (
    <div>
      <Titulo sub="Cada montaje, taller, evento, refacción o préstamo es una orden. La obra de teatro y la obra del edificio, las dos.">Órdenes</Titulo>
      {puedeCrear && <div className="mb-3"><Btn rojo onClick={() => setNueva(!nueva)}>{nueva ? 'Cerrar el formulario' : 'Nueva orden'}</Btn></div>}
      {nueva && d && <NuevaOrden areas={d.areas} elencos={d.elencos} onCreada={(id: number) => nav(`/ordenes/${id}`)} />}
      <Card>
        <div className="grid sm:grid-cols-4 gap-2">
          <Campo label="Buscar"><input className="campo" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Título o código" /></Campo>
          <Campo label="Estado"><select className="campo" value={fe} onChange={(e) => setFe(e.target.value)}><option value="">Todos</option>{Object.entries(ESTADO).map(([k, v]) => <option key={k} value={k}>{v.n}</option>)}</select></Campo>
          <Campo label="Tipo"><select className="campo" value={ft} onChange={(e) => setFt(e.target.value)}><option value="">Todos</option>{Object.entries(TIPO_ORDEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
          <Campo label="Área"><select className="campo" value={fa} onChange={(e) => setFa(e.target.value)}><option value="">Todas</option>{(d?.areas || []).map((a: any) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></Campo>
        </div>
      </Card>
      <Cargando q={q} />
      {d && (
        <div className="overflow-x-auto">
          <table className="tabla bg-[#FBF6EA]">
            <thead><tr><th>Código</th><th>Título</th><th>Tipo</th><th>Pide → ejecuta</th><th>Estado</th>{veCostos(profile.rol) && <><th>Aprobado</th><th>Costo real</th></>}</tr></thead>
            <tbody>
              {lista.map((o: any) => {
                const c = d.costos.find((x: any) => x.orden_id === o.id)
                return (
                  <tr key={o.id}>
                    <td className="num">{o.codigo}</td>
                    <td><Link className="underline font-bold" to={`/ordenes/${o.id}`}>{o.titulo}</Link></td>
                    <td>{TIPO_ORDEN[o.tipo]}</td>
                    <td className="text-sm">{area(o.area_solicitante_id)} → {area(o.area_ejecutora_id)}</td>
                    <td><Sello estado={o.estado} /></td>
                    {veCostos(profile.rol) && <><td className="num">{c?.aprobado != null ? money(c.aprobado) : '—'}</td><td className="num">{money(c?.costo_real)}</td></>}
                  </tr>
                )
              })}
              {lista.length === 0 && <tr><td colSpan={7} className="ayuda">No hay órdenes con esos filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function NuevaOrden({ areas, elencos, onCreada }: any) {
  const { profile } = useAuth()
  const [titulo, setTitulo] = useState(''); const [tipo, setTipo] = useState('montaje_obra')
  const [area, setArea] = useState(profile.area_id ? String(profile.area_id) : ''); const [elenco, setElenco] = useState('')
  const acc = useAccion()
  const elige = profile.rol === 'gestion' || profile.rol === 'coordinacion'
  async function crear() {
    const id = await acc.run('rpc_crear_orden', { p_titulo: titulo, p_tipo: tipo, p_area_solicitante: elige && area ? Number(area) : null, p_elenco: tipo === 'montaje_obra' && elenco ? Number(elenco) : null })
    if (id) onCreada(id.id ?? id)
  }
  return (
    <Card cinta>
      <h2 className="text-2xl">Nueva orden</h2>
      <div className="grid sm:grid-cols-2 gap-3 mt-2">
        <Campo label="Título"><input className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} /></Campo>
        <Campo label="Tipo" ayuda="El tipo define qué área la ejecuta por defecto."><select className="campo" value={tipo} onChange={(e) => setTipo(e.target.value)}>{Object.entries(TIPO_ORDEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
        {elige && <Campo label="Área que la pide"><select className="campo" value={area} onChange={(e) => setArea(e.target.value)}><option value="">Elegí un área</option>{areas.map((a: any) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></Campo>}
        {tipo === 'montaje_obra' && <Campo label="Elenco (opcional)"><select className="campo" value={elenco} onChange={(e) => setElenco(e.target.value)}><option value="">Sin elenco todavía</option>{elencos.map((a: any) => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></Campo>}
      </div>
      <div className="mt-3"><Btn rojo busy={acc.busy} onClick={crear}>Crear orden</Btn></div>
      <Mensajes a={acc} />
    </Card>
  )
}

/* -------------------------------------------------------------- Detalle */
const TABS = [['resumen', 'Resumen'], ['presupuesto', 'Presupuesto'], ['materiales', 'Materiales'], ['cuadrilla', 'Cuadrilla'], ['agenda', 'Agenda'], ['costos', 'Costos']]

export function OrdenDetalle() {
  const { id } = useParams()
  const oid = Number(id)
  const { profile } = useAuth()
  const [tab, setTab] = useState('resumen')
  const q = useData(async () => {
    const orden = must(await supabase.from('ordenes').select('*').eq('id', oid).maybeSingle())
    if (!orden) throw new Error('No encontramos esa orden o no tenés acceso a ella.')
    const [pres, reservas, turnos, partes, acts, costos, ct, mats, cuads, integ, provs, areas, espacios, elencos] = await Promise.all([
      supabase.from('presupuestos').select('*').eq('orden_id', oid).order('version'),
      supabase.from('reservas_material').select('*').eq('orden_id', oid),
      supabase.from('turnos').select('*').eq('orden_id', oid).order('inicio'),
      supabase.from('partes').select('*').eq('orden_id', oid),
      supabase.from('actividades').select('*').eq('orden_id', oid).order('inicio'),
      supabase.from('costos_reales').select('*').eq('orden_id', oid).order('id'),
      supabase.from('v_costo_orden').select('*').eq('orden_id', oid).maybeSingle(),
      supabase.from('materiales').select('*').order('nombre'),
      supabase.from('cuadrillas').select('*').order('nombre'),
      supabase.from('integrantes').select('*').order('nombre'),
      supabase.from('proveedores').select('*').order('nombre'),
      supabase.from('areas').select('id,nombre'),
      supabase.from('espacios').select('*').order('id'),
      supabase.from('elencos').select('id,nombre'),
    ])
    const p = pres.data || []
    const lineas = p.length ? must(await supabase.from('presupuesto_lineas').select('*').in('presupuesto_id', p.map((x: any) => x.id)).order('id')) : []
    return { orden, pres: p, lineas, reservas: reservas.data || [], turnos: turnos.data || [], partes: partes.data || [], acts: acts.data || [], costos: costos.data || [], ct: ct.data, mats: mats.data || [], cuads: cuads.data || [], integ: integ.data || [], provs: provs.data || [], areas: areas.data || [], espacios: espacios.data || [], elencos: elencos.data || [] }
  }, [oid])
  const d: any = q.data
  const edita = profile.rol === 'gestion' || profile.rol === 'coordinacion'
  return (
    <div>
      <Link to="/ordenes" className="ayuda underline">← Volver a las órdenes</Link>
      <Cargando q={q} />
      {d && (
        <>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <h1 className="text-4xl text-telon leading-none">{d.orden.codigo} · {d.orden.titulo}</h1>
            <Sello estado={d.orden.estado} />
          </div>
          <p className="ayuda">{TIPO_ORDEN[d.orden.tipo]} · {ESTADO[d.orden.estado].ayuda}</p>
          {d.orden.estado === 'excedida' && <div role="alert" className="mt-3 border-2 border-telon bg-[#f6dcd6] p-3 font-bold">Esta orden se pasó más del 10 % de lo aprobado. Para cerrarla falta una versión nueva del presupuesto aprobada por gestión.</div>}
          <div className="flex flex-wrap gap-1 mt-4 border-b-2 border-caja">
            {TABS.map(([k, n]) => <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 font-bold ${tab === k ? 'bg-caja text-papel' : 'hover:bg-papel2'}`}>{n}</button>)}
          </div>
          {tab === 'resumen' && <Resumen d={d} edita={edita} reload={q.reload} />}
          {tab === 'presupuesto' && <PresupuestoTab d={d} edita={edita} rol={profile.rol} reload={q.reload} />}
          {tab === 'materiales' && <MaterialesTab d={d} edita={edita} reload={q.reload} />}
          {tab === 'cuadrilla' && <CuadrillaTab d={d} edita={edita} reload={q.reload} />}
          {tab === 'agenda' && (
            <div>
              <ListaActividades acts={d.acts} espacios={d.espacios} />
              {edita && !['anulada', 'cerrada', 'cargada'].includes(d.orden.estado) && <AgendarForm ordenId={oid} espacios={d.espacios} onDone={q.reload} />}
            </div>
          )}
          {tab === 'costos' && <CostosTab d={d} edita={edita} reload={q.reload} rol={profile.rol} />}
        </>
      )}
    </div>
  )
}

function Resumen({ d, edita, reload }: any) {
  const o = d.orden
  const acc = useAccion(reload)
  const [motivo, setMotivo] = useState('')
  const area = (id: number) => d.areas.find((a: any) => a.id === id)?.nombre
  return (
    <Card>
      <dl className="grid sm:grid-cols-2 gap-2">
        <div><dt className="font-bold">Área que la pide</dt><dd>{area(o.area_solicitante_id)}</dd></div>
        <div><dt className="font-bold">Área que la ejecuta</dt><dd>{area(o.area_ejecutora_id)}</dd></div>
        {o.elenco_id && <div><dt className="font-bold">Elenco</dt><dd>{d.elencos.find((e: any) => e.id === o.elenco_id)?.nombre}</dd></div>}
        {o.motivo_anulacion && <div><dt className="font-bold">Motivo de la anulación</dt><dd>{o.motivo_anulacion}</dd></div>}
      </dl>
      {edita && (
        <div className="mt-4 space-y-3">
          {o.estado === 'aprobada' && <Btn rojo busy={acc.busy} onClick={() => acc.run('rpc_iniciar_orden', { p_orden: o.id }, () => 'La orden está en ejecución.')}>Empezar la orden</Btn>}
          {(o.estado === 'presupuestada' || o.estado === 'borrador') && <p className="ayuda">Sin presupuesto aprobado no puede empezar.</p>}
          {['borrador', 'presupuestada', 'aprobada'].includes(o.estado) && (
            <div className="border-t border-tinta/30 pt-3">
              <Campo label="Anular la orden" ayuda="Libera las reservas y las horas. Solo se puede antes de que empiece."><input className="campo" placeholder="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
              <div className="mt-2"><Btn claro busy={acc.busy} onClick={() => acc.run('rpc_anular_orden', { p_orden: o.id, p_motivo: motivo || null }, () => 'Orden anulada.')}>Anular</Btn></div>
            </div>
          )}
          <Mensajes a={acc} reload={reload} />
        </div>
      )}
    </Card>
  )
}

/* ---------------------------------------------------------- Presupuesto */
function PresupuestoTab({ d, edita, rol, reload }: any) {
  const [base, setBase] = useState<any[] | null>(null)
  const pendiente = d.pres.find((p: any) => p.estado === 'pendiente')
  const admite = ['borrador', 'presupuestada', 'aprobada', 'en_ejecucion', 'excedida'].includes(d.orden.estado)
  return (
    <div>
      {pendiente && <div className="mt-3 border-2 border-[#B57A12] bg-[#f3e7c9] p-3 font-bold">Falta aprobar la versión {pendiente.version} del presupuesto.</div>}
      {d.pres.length === 0 && <Card><p>Todavía no hay presupuesto. {edita ? 'Armá la versión 1 acá abajo.' : ''}</p></Card>}
      {[...d.pres].reverse().map((p: any) => {
        const ls = d.lineas.filter((l: any) => l.presupuesto_id === p.id)
        return (
          <Card key={p.id} cinta={p.estado === 'aprobado'}>
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <h2 className="text-2xl">Versión {p.version} {p.estado === 'aprobado' && '🔒'}</h2>
              <span className="sello" style={{ color: p.estado === 'aprobado' ? '#3F6B4F' : p.estado === 'pendiente' ? '#B57A12' : '#777' }}>{ESTADO_PRES[p.estado]}</span>
            </div>
            {p.notas && <p className="ayuda">{p.notas}</p>}
            <div className="overflow-x-auto"><table className="tabla"><thead><tr><th>Qué</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr></thead>
              <tbody>{ls.map((l: any) => <tr key={l.id}><td>{l.descripcion} <span className="ayuda">({l.categoria === 'horas' ? 'horas' : l.categoria === 'externo' ? 'gasto externo' : 'material'})</span></td><td className="num">{num(l.cantidad)}</td><td className="num">{money(l.costo_unitario)}</td><td className="num">{money(l.cantidad * l.costo_unitario)}</td></tr>)}</tbody></table></div>
            <dl className="num mt-2 text-sm grid grid-cols-2 max-w-md gap-x-4">
              <dt>Materiales</dt><dd className="text-right">{money(p.subtotal_materiales)}</dd>
              <dt>Gastos externos</dt><dd className="text-right">{money(p.subtotal_externos)}</dd>
              <dt>Horas de cuadrilla</dt><dd className="text-right">{money(p.subtotal_horas)}</dd>
              <dt>Imprevistos (10 % de materiales y gastos externos)</dt><dd className="text-right">{money(p.imprevistos)}</dd>
              <dt className="font-bold">Total</dt><dd className="text-right font-bold">{money(p.total)}</dd>
            </dl>
            <p className="ayuda mt-1">Los imprevistos son un colchón para sorpresas en lo que se compra. No se aplican a las horas de trabajo.</p>
            {p.motivo_aprobacion && <p className="ayuda">Motivo de aprobación: {p.motivo_aprobacion}</p>}
            {edita && admite && <div className="mt-2"><Btn claro onClick={() => setBase(ls)}>Usar como base para una versión nueva</Btn></div>}
            {rol === 'gestion' && p.estado === 'pendiente' && <AprobarPresupuesto presupuesto={p} onDone={reload} />}
          </Card>
        )
      })}
      {edita && admite && <EditorPresupuesto d={d} base={base} reload={reload} />}
    </div>
  )
}

function EditorPresupuesto({ d, base, reload }: any) {
  const vacia = (categoria: string) => ({ categoria, descripcion: '', material_id: null, cuadrilla_id: null, proveedor_id: null, cantidad: 1, costo_unitario: 0 })
  const ultima = d.pres.length ? d.lineas.filter((l: any) => l.presupuesto_id === d.pres[d.pres.length - 1].id) : []
  const [lineas, setLineas] = useState<any[]>(() => (ultima.length ? ultima : [vacia('material')]).map((l: any) => ({ ...l })))
  const [notas, setNotas] = useState('')
  const [cargadoBase, setCargadoBase] = useState<any>(null)
  if (base && base !== cargadoBase) { setCargadoBase(base); setLineas(base.map((l: any) => ({ ...l }))) }
  const acc = useAccion(reload)
  const set = (i: number, k: string, v: any) => setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)))
  const mat = lineas.filter((l) => l.categoria === 'material').reduce((s, l) => s + l.cantidad * l.costo_unitario, 0)
  const ext = lineas.filter((l) => l.categoria === 'externo').reduce((s, l) => s + l.cantidad * l.costo_unitario, 0)
  const hor = lineas.filter((l) => l.categoria === 'horas').reduce((s, l) => s + l.cantidad * l.costo_unitario, 0)
  const imp = Math.round((mat + ext) * 10) / 100
  return (
    <Card cinta>
      <h2 className="text-2xl">Armar una versión nueva ({d.pres.length ? `v${Math.max(...d.pres.map((p: any) => p.version)) + 1}` : 'v1'})</h2>
      <p className="ayuda">Nunca se edita una versión existente: cada cambio crea la siguiente y vuelve a pedir aprobación.</p>
      <div className="space-y-2 mt-3">
        {lineas.map((l, i) => (
          <div key={i} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end border-b border-tinta/20 pb-2">
            <Campo label="Tipo"><select className="campo" value={l.categoria} onChange={(e) => set(i, 'categoria', e.target.value)}><option value="material">Material</option><option value="horas">Horas de cuadrilla</option><option value="externo">Gasto externo</option></select></Campo>
            {l.categoria === 'material' && <Campo label="Material"><select className="campo" value={l.material_id || ''} onChange={(e) => { const m = d.mats.find((x: any) => x.id === Number(e.target.value)); setLineas((ls) => ls.map((x, j) => j === i ? { ...x, material_id: m?.id || null, descripcion: m?.nombre || '', costo_unitario: m?.costo || 0 } : x)) }}><option value="">Elegí</option>{d.mats.map((m: any) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></Campo>}
            {l.categoria === 'horas' && <Campo label="Cuadrilla"><select className="campo" value={l.cuadrilla_id || ''} onChange={(e) => { const c = d.cuads.find((x: any) => x.id === Number(e.target.value)); setLineas((ls) => ls.map((x, j) => j === i ? { ...x, cuadrilla_id: c?.id || null, descripcion: c ? `Horas de ${c.nombre}` : '', costo_unitario: c?.valor_hora || 0 } : x)) }}><option value="">Elegí</option>{d.cuads.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Campo>}
            {l.categoria === 'externo' && <Campo label="Concepto"><input className="campo" value={l.descripcion} onChange={(e) => set(i, 'descripcion', e.target.value)} /></Campo>}
            {l.categoria === 'externo' ? <Campo label="Proveedor"><select className="campo" value={l.proveedor_id || ''} onChange={(e) => set(i, 'proveedor_id', e.target.value ? Number(e.target.value) : null)}><option value="">—</option>{d.provs.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Campo> : <span />}
            <Campo label={l.categoria === 'horas' ? 'Horas' : 'Cantidad'}><input className="campo num" type="number" min="0" step="any" value={l.cantidad} onChange={(e) => set(i, 'cantidad', Number(e.target.value))} /></Campo>
            <Campo label="Precio"><input className="campo num" type="number" min="0" step="any" value={l.costo_unitario} onChange={(e) => set(i, 'costo_unitario', Number(e.target.value))} /></Campo>
            <Btn claro onClick={() => setLineas((ls) => ls.filter((_, j) => j !== i))}>Quitar</Btn>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-2"><Btn claro onClick={() => setLineas([...lineas, vacia('material')])}>+ Línea</Btn></div>
      <dl className="num mt-3 grid grid-cols-2 max-w-md gap-x-4 text-sm">
        <dt>Materiales</dt><dd className="text-right">{money(mat)}</dd>
        <dt>Gastos externos</dt><dd className="text-right">{money(ext)}</dd>
        <dt>Horas de cuadrilla</dt><dd className="text-right">{money(hor)}</dd>
        <dt>Imprevistos (10 % de materiales y gastos externos)</dt><dd className="text-right">{money(imp)}</dd>
        <dt className="font-bold">Total que se va a pedir aprobar</dt><dd className="text-right font-bold">{money(mat + ext + hor + imp)}</dd>
      </dl>
      <div className="mt-3 max-w-md"><Campo label="Nota de esta versión (opcional)"><input className="campo" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej.: el elenco pidió un panel más" /></Campo></div>
      <div className="mt-3"><Btn rojo busy={acc.busy} onClick={() => acc.run('rpc_nuevo_presupuesto', {
        p_orden: d.orden.id, p_notas: notas || null,
        p_lineas: lineas.filter((l) => l.cantidad > 0).map((l) => ({ categoria: l.categoria, descripcion: l.descripcion || null, material_id: l.material_id, cuadrilla_id: l.cuadrilla_id, proveedor_id: l.proveedor_id, cantidad: l.cantidad, costo_unitario: l.costo_unitario })),
      }, (r) => `Se creó la versión ${r.version} por ${money(r.total)}. Falta aprobarla.`)}>Guardar como versión nueva</Btn></div>
      <Mensajes a={acc} reload={reload} />
    </Card>
  )
}

/* ------------------------------------------------------------ Materiales */
function MaterialesTab({ d, edita, reload }: any) {
  const o = d.orden
  const [mat, setMat] = useState(''); const [cant, setCant] = useState(1)
  const acc = useAccion(reload)
  const puedeReservar = edita && ['presupuestada', 'aprobada', 'en_ejecucion', 'excedida'].includes(o.estado)
  return (
    <div>
      <Card>
        <h2 className="text-2xl">Reservas de esta orden</h2>
        <div className="overflow-x-auto"><table className="tabla"><thead><tr><th>Material</th><th>Cantidad</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {d.reservas.map((r: any) => {
              const m = d.mats.find((x: any) => x.id === r.material_id)
              return (
                <tr key={r.id}><td>{m?.nombre} <span className="ayuda">({m?.tipo})</span></td><td className="num">{num(r.cantidad)} {m?.unidad}</td><td>{{ reservada: 'Reservada', consumida: 'Consumida', devuelta: 'Devuelta', liberada: 'Liberada' }[r.estado as string]}</td>
                  <td>{edita && r.estado === 'reservada' && ['en_ejecucion', 'excedida'].includes(o.estado) && <Devolver reserva={r} material={m} orden={o} reload={reload} />}</td></tr>
              )
            })}
            {d.reservas.length === 0 && <tr><td colSpan={4} className="ayuda">Todavía no hay materiales reservados.</td></tr>}
          </tbody></table></div>
        <p className="ayuda mt-2">Los consumibles (madera, pintura…) se gastan. Los reutilizables (tachos, cables…) se prestan: al devolverlos aptos vuelven a estar disponibles.</p>
      </Card>
      {puedeReservar && (
        <Card cinta>
          <h2 className="text-2xl">Reservar material</h2>
          <div className="grid sm:grid-cols-3 gap-3 items-end mt-2">
            <Campo label="Material"><select className="campo" value={mat} onChange={(e) => setMat(e.target.value)}><option value="">Elegí</option>{d.mats.map((m: any) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></Campo>
            <Campo label="Cantidad"><input className="campo num" type="number" min="1" value={cant} onChange={(e) => setCant(Number(e.target.value))} /></Campo>
            <Btn rojo busy={acc.busy} onClick={() => acc.run('rpc_reservar_material', { p_orden: o.id, p_material: Number(mat), p_cantidad: cant }, (r) => `Reservado. Quedan ${num(r.disponible_restante)} disponibles para otras órdenes.`)}>Reservar</Btn>
          </div>
          <Mensajes a={acc} reload={reload} />
        </Card>
      )}
    </div>
  )
}

function Devolver({ reserva, material, orden, reload }: any) {
  const [abierto, setAbierto] = useState(false)
  const reut = material?.tipo === 'reutilizable'
  const [usado, setUsado] = useState(reserva.cantidad); const [ok, setOk] = useState(reserva.cantidad); const [dan, setDan] = useState(0); const [per, setPer] = useState(0)
  const acc = useAccion(reload)
  if (!abierto) return <Btn claro onClick={() => setAbierto(true)}>{reut ? 'Devolver' : 'Registrar uso'}</Btn>
  return (
    <div className="min-w-[16rem]">
      {reut ? (
        <div className="grid grid-cols-3 gap-2">
          <Campo label="Aptos"><input className="campo num" type="number" min="0" value={ok} onChange={(e) => setOk(Number(e.target.value))} /></Campo>
          <Campo label="Dañados"><input className="campo num" type="number" min="0" value={dan} onChange={(e) => setDan(Number(e.target.value))} /></Campo>
          <Campo label="Perdidos"><input className="campo num" type="number" min="0" value={per} onChange={(e) => setPer(Number(e.target.value))} /></Campo>
        </div>
      ) : <Campo label="Cuánto se usó"><input className="campo num" type="number" min="0" value={usado} onChange={(e) => setUsado(Number(e.target.value))} /></Campo>}
      {reut && <p className="ayuda">Tienen que sumar {num(reserva.cantidad)}. Dañado: se carga el 50 % y queda fuera de uso hasta repararlo. Perdido: se carga el 100 %.</p>}
      <div className="mt-2"><Btn rojo busy={acc.busy} onClick={() => acc.run('rpc_devolver_material', { p_orden: orden.id, p_material: material.id, p_usado: reut ? 0 : usado, p_ok: reut ? ok : 0, p_danado: reut ? dan : 0, p_perdido: reut ? per : 0 },
        (r) => `Listo. El costo real de la orden ahora es ${money(r.costo_real)}.`)}>Confirmar</Btn></div>
      <Mensajes a={acc} reload={reload} />
    </div>
  )
}

/* ------------------------------------------------------------- Cuadrilla */
function CuadrillaTab({ d, edita, reload }: any) {
  const o = d.orden
  const [integ, setInteg] = useState(''); const [ini, setIni] = useState(''); const [fin, setFin] = useState(''); const [vol, setVol] = useState(false)
  const acc = useAccion(reload); const acc2 = useAccion(reload)
  const nombre = (id: number) => d.integ.find((x: any) => x.id === id)?.nombre || `Persona ${id}`
  const parteDe = (t: any) => d.partes.find((p: any) => p.turno_id === t.id)
  const puede = edita && ['aprobada', 'en_ejecucion', 'excedida'].includes(o.estado)
  return (
    <div>
      <Card>
        <h2 className="text-2xl">Turnos</h2>
        <div className="overflow-x-auto"><table className="tabla"><thead><tr><th>Persona</th><th>Desde</th><th>Hasta</th><th>Horas</th><th>Tipo</th><th>Parte</th><th></th></tr></thead>
          <tbody>
            {d.turnos.map((t: any) => {
              const p = parteDe(t)
              return (
                <tr key={t.id} style={{ opacity: t.estado === 'anulado' ? 0.5 : 1 }}>
                  <td>{nombre(t.integrante_id)}</td><td>{fecha(t.inicio)}</td><td>{fecha(t.fin)}</td><td className="num">{num(t.horas)}</td>
                  <td>{t.voluntario ? 'Voluntario (valor cero)' : 'Con valor hora'}{t.estado === 'anulado' && ' · anulado'}</td>
                  <td>{p ? (p.estado === 'confirmado' ? `Confirmado (${num(p.horas)} h)` : `Cargado: ${num(p.horas)} h`) : '—'}</td>
                  <td>
                    {edita && p && p.estado === 'cargado' && <Btn claro busy={acc2.busy} onClick={() => acc2.run('rpc_confirmar_parte', { p_parte: p.id, p_horas: null }, (r) => r.voluntario ? 'Horas confirmadas como aporte comunitario.' : `Horas confirmadas: ${money(r.costo)}.`)}>Confirmar horas</Btn>}
                    {edita && !p && t.estado === 'programado' && <Btn claro busy={acc2.busy} onClick={() => acc2.run('rpc_anular_turno', { p_turno: t.id }, () => 'Turno anulado.')}>Anular</Btn>}
                  </td>
                </tr>
              )
            })}
            {d.turnos.length === 0 && <tr><td colSpan={7} className="ayuda">Todavía no hay turnos armados.</td></tr>}
          </tbody></table></div>
        <Mensajes a={acc2} reload={reload} />
      </Card>
      {puede && (
        <Card cinta>
          <h2 className="text-2xl">Armar un turno</h2>
          <div className="grid sm:grid-cols-4 gap-3 items-end mt-2">
            <Campo label="Persona"><select className="campo" value={integ} onChange={(e) => setInteg(e.target.value)}><option value="">Elegí</option>{d.cuads.map((c: any) => <optgroup key={c.id} label={c.nombre}>{d.integ.filter((i: any) => i.cuadrilla_id === c.id).map((i: any) => <option key={i.id} value={i.id}>{i.nombre}</option>)}</optgroup>)}</select></Campo>
            <Campo label="Desde"><input className="campo" type="datetime-local" value={ini} onChange={(e) => setIni(e.target.value)} /></Campo>
            <Campo label="Hasta"><input className="campo" type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)} /></Campo>
            <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={vol} onChange={(e) => setVol(e.target.checked)} />Trabajo voluntario (horas a valor cero)</label>
          </div>
          <div className="mt-3"><Btn rojo busy={acc.busy} onClick={() => acc.run('rpc_crear_turno', { p_orden: o.id, p_integrante: Number(integ), p_inicio: `${ini}:00`, p_fin: `${fin}:00`, p_voluntario: vol }, (r) => `Turno armado. Le quedan ${num(r.horas_libres_semana)} h libres esa semana.`)}>Armar turno</Btn></div>
          <p className="ayuda mt-1">Nadie puede pasar sus horas semanales ni tener dos turnos al mismo tiempo.</p>
          <Mensajes a={acc} reload={reload} />
        </Card>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- Costos */
function CostosTab({ d, edita, reload, rol }: any) {
  const o = d.orden
  const [concepto, setConcepto] = useState(''); const [monto, setMonto] = useState(0); const [prov, setProv] = useState('')
  const acc = useAccion(reload); const cerrar = useAccion(reload)
  if (!veCostos(rol)) return <Card><p>Los costos no se muestran para tu rol.</p></Card>
  const aprobado = Number(d.ct?.aprobado || 0); const real = Number(d.ct?.costo_real || 0)
  const pct = aprobado ? Math.round((real / aprobado) * 1000) / 10 : 0
  const enCurso = ['en_ejecucion', 'excedida'].includes(o.estado)
  return (
    <div>
      <Card cinta>
        <h2 className="text-2xl">Aprobado contra gasto real</h2>
        <p className="num mt-1">Aprobado: <b>{money(aprobado)}</b> · Costo real hasta hoy: <b>{money(real)}</b></p>
        <div className="my-2"><Barra total={Math.max(aprobado, real) * 1.0} partes={[{ v: Math.min(real, aprobado), c: '#3F6B4F', t: 'Dentro de lo aprobado' }, { v: Math.max(real - aprobado, 0), c: '#8C1D18', t: 'Pasado de lo aprobado' }]} /></div>
        <p className="ayuda">{aprobado ? `Gastaste el ${pct} % de lo aprobado. ${pct > 110 ? 'Pasaste el 10 % de margen: hace falta una versión nueva aprobada para poder cerrar.' : pct > 100 ? 'Estás pasado, pero dentro del 10 % de margen: se puede cerrar sin otra aprobación.' : 'Todavía dentro de lo aprobado.'}` : 'Todavía no hay presupuesto aprobado.'}</p>
        {Number(d.ct?.horas_voluntarias) > 0 && <p className="mt-1">Aporte comunitario: <b>{num(d.ct.horas_voluntarias)} horas</b> de trabajo voluntario (no suman al costo).</p>}
      </Card>
      <Card>
        <h2 className="text-2xl">Detalle del costo real</h2>
        <div className="overflow-x-auto"><table className="tabla"><thead><tr><th>Qué</th><th>Rubro</th><th>Monto</th></tr></thead>
          <tbody>{d.costos.map((c: any) => <tr key={c.id}><td>{c.concepto}</td><td>{{ horas: 'Horas', consumo: 'Consumo de material', danado: 'Material dañado', perdido: 'Material perdido', externo: 'Gasto externo' }[c.categoria as string]}</td><td className="num">{money(c.monto)}</td></tr>)}
            {d.costos.length === 0 && <tr><td colSpan={3} className="ayuda">Todavía no hay costos cargados.</td></tr>}</tbody></table></div>
      </Card>
      {edita && enCurso && (
        <Card>
          <h2 className="text-2xl">Cargar un gasto externo real</h2>
          <div className="grid sm:grid-cols-4 gap-3 items-end mt-2">
            <Campo label="Concepto"><input className="campo" value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej.: flete" /></Campo>
            <Campo label="Proveedor"><select className="campo" value={prov} onChange={(e) => setProv(e.target.value)}><option value="">—</option>{d.provs.map((p: any) => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}</select></Campo>
            <Campo label="Monto"><input className="campo num" type="number" min="0" value={monto} onChange={(e) => setMonto(Number(e.target.value))} /></Campo>
            <Btn busy={acc.busy} onClick={() => acc.run('rpc_registrar_gasto', { p_orden: o.id, p_concepto: concepto, p_monto: monto, p_proveedor: prov || null }, (r) => `Gasto cargado. Costo real: ${money(r.costo_real)}.`)}>Cargar gasto</Btn>
          </div>
          <Mensajes a={acc} reload={reload} />
        </Card>
      )}
      {edita && enCurso && (
        <Card>
          <h2 className="text-2xl">Cerrar la orden</h2>
          <p className="ayuda">Al cerrar se genera un solo cargo interno desde el área que ejecuta hacia el área que pidió, con el costo real. Antes tienen que estar confirmados los partes y devueltos los materiales.</p>
          <div className="mt-2"><Btn rojo busy={cerrar.busy} onClick={() => cerrar.run('rpc_cerrar_orden', { p_orden: o.id }, (r) => r.sin_cargo ? `Orden cerrada. Quedó registrada sin cargo (la misma área pide y ejecuta): ${money(r.costo_real)}.` : `Orden cerrada. Se generó el cargo ${r.cargo} por ${money(r.costo_real)}.`)}>Cerrar orden</Btn></div>
          <Mensajes a={cerrar} reload={reload} />
        </Card>
      )}
    </div>
  )
}
