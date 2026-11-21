import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { TIPO_ACT } from '../lib/const'
import { descargarIcs, textoWhatsApp } from '../lib/ics'
import { Btn, Campo, Card, Cargando, Chip, Mensajes, Titulo, fecha, money, must, num, toTs, useAccion, useData } from '../lib/ui'

const PX = 26, H0 = 8, H1 = 24
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const lunesDe = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }

function segmentos(a: any, dia: Date) {
  const d0 = dia.getTime(), d1 = d0 + 864e5
  const ini = new Date(a.inicio).getTime(), fin = new Date(a.fin).getTime()
  const oi = ini - a.montaje_h * 36e5, of = fin + a.desmontaje_h * 36e5
  const clip = (s: number, e: number) => { const S = Math.max(s, d0), E = Math.min(e, d1); return E <= S ? null : [(S - d0) / 36e5, (E - d0) / 36e5] }
  return { outer: clip(oi, of), inner: clip(ini, fin) }
}
const pos = (h: number) => (Math.min(Math.max(h, H0), H1) - H0) * PX

/* -------------------------------------------------------------- Pantalla */
export default function Agenda() {
  const { profile } = useAuth()
  const staff = profile.rol === 'gestion' || profile.rol === 'coordinacion'
  const [semana, setSemana] = useState(lunesDe(new Date()))
  const [espacio, setEspacio] = useState<number | null>(null)
  const [sel, setSel] = useState<any>(null)
  const q = useData(async () => {
    const espacios = must(await supabase.from('espacios').select('*').order('id'))
    const acts = must(await supabase.from('actividades').select('*').neq('estado', 'anulada').order('inicio'))
    return { espacios, acts }
  })
  const d: any = q.data
  const esp = espacio ?? d?.espacios?.[0]?.id
  const dias = DIAS.map((_, i) => { const x = new Date(semana); x.setDate(x.getDate() + i); return x })
  const nombresEsp: Record<number, string> = Object.fromEntries((d?.espacios || []).map((e: any) => [e.id, e.nombre]))
  const delEsp = (d?.acts || []).filter((a: any) => a.espacio_id === esp && a.estado === 'confirmada')
  const reubicar = (d?.acts || []).filter((a: any) => a.estado === 'por_reubicar')
  const semanaActs = (d?.acts || []).filter((a: any) => a.estado === 'confirmada' && new Date(a.inicio) < new Date(dias[6].getTime() + 864e5) && new Date(a.fin) >= semana)
  return (
    <div>
      <Titulo sub="Un espacio admite una sola actividad por vez. Montaje y desmontaje (la franja rayada) también ocupan la sala. Las funciones tienen prioridad.">Agenda</Titulo>
      <Cargando q={q} />
      {d && (
        <>
          <div className="flex flex-wrap gap-2 items-center">
            {d.espacios.map((e: any) => <button key={e.id} onClick={() => setEspacio(e.id)} className={`px-3 py-2 font-bold border-2 border-caja ${e.id === esp ? 'bg-caja text-papel' : 'bg-[#FBF6EA]'}`}>{e.nombre}</button>)}
            <span className="ml-auto flex gap-2 items-center">
              <Btn claro onClick={() => setSemana(new Date(semana.getTime() - 7 * 864e5))}>← Semana anterior</Btn>
              <Btn claro onClick={() => setSemana(lunesDe(new Date()))}>Hoy</Btn>
              <Btn claro onClick={() => setSemana(new Date(semana.getTime() + 7 * 864e5))}>Semana siguiente →</Btn>
            </span>
          </div>
          <p className="ayuda mt-1">Semana del {dias[0].toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })} al {dias[6].toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}.</p>
          <div className="flex flex-wrap gap-2 my-2">{Object.entries(TIPO_ACT).map(([k, v]) => <Chip key={k} texto={v.n} color={v.c} />)}</div>
          <div className="overflow-x-auto">
            <div className="grid min-w-[760px]" style={{ gridTemplateColumns: '38px repeat(7, 1fr)' }}>
              <div />
              {dias.map((x, i) => <div key={i} className="titulo text-lg text-center border-b-2 border-caja">{DIAS[i]} {x.getDate()}</div>)}
              <div className="relative" style={{ height: (H1 - H0) * PX }}>
                {Array.from({ length: H1 - H0 + 1 }, (_, i) => <div key={i} className="absolute right-1 text-[10px] text-tinta" style={{ top: i * PX - 6 }}>{H0 + i}</div>)}
              </div>
              {dias.map((dia, i) => (
                <div key={i} className="relative border-l border-tinta/30 bg-[#FBF6EA]" style={{ height: (H1 - H0) * PX }}>
                  {Array.from({ length: H1 - H0 }, (_, h) => <div key={h} className="absolute inset-x-0 border-t border-tinta/10" style={{ top: h * PX }} />)}
                  {delEsp.map((a: any) => {
                    const s = segmentos(a, dia); const c = TIPO_ACT[a.tipo]?.c || '#444'
                    if (!s.outer || s.outer[1] <= H0) return null
                    return (
                      <div key={a.id}>
                        <div className="absolute inset-x-0.5" style={{ top: pos(s.outer[0]), height: Math.max(pos(s.outer[1]) - pos(s.outer[0]), 2), background: c, opacity: 0.4 }}><div className="w-full h-full rayado" /></div>
                        {s.inner && s.inner[1] > H0 && (
                          <button onClick={() => setSel(a)} className="absolute inset-x-1 text-left text-papel text-[11px] leading-tight p-1 overflow-hidden"
                            style={{ top: pos(s.inner[0]), height: Math.max(pos(s.inner[1]) - pos(s.inner[0]), 16), background: c, transform: `rotate(${(a.id % 3) - 1}deg)`, boxShadow: '1px 2px 0 rgba(0,0,0,.25)' }}>
                            <b>{a.titulo}</b>
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Btn claro onClick={() => descargarIcs(semanaActs, nombresEsp, 'agenda-semana')}>Descargar la semana (.ics)</Btn>
          </div>

          {sel && <DetalleActividad key={sel.id} a={sel} espacios={d.espacios} staff={staff} rol={profile.rol} onClose={() => setSel(null)} onDone={() => { q.reload() }} />}

          {reubicar.length > 0 && (
            <Card cinta>
              <h2 className="text-2xl">Para reubicar</h2>
              <p className="ayuda">Estas actividades chocaron con una función nueva. Elegí otro espacio u horario.</p>
              {reubicar.map((a: any) => <Reubicar key={a.id} a={a} espacios={d.espacios} staff={staff} onDone={q.reload} />)}
            </Card>
          )}
          {staff && <AgendarForm espacios={d.espacios} onDone={q.reload} />}
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------- Lista (por orden) */
export function ListaActividades({ acts, espacios }: { acts: any[]; espacios: any[] }) {
  const esp = (id: number) => espacios.find((e) => e.id === id)?.nombre
  return (
    <Card>
      <h2 className="text-2xl">Actividades de esta orden</h2>
      <div className="overflow-x-auto"><table className="tabla"><thead><tr><th>Actividad</th><th>Espacio</th><th>Desde</th><th>Hasta</th><th>Montaje / desmontaje</th><th>Estado</th></tr></thead>
        <tbody>
          {acts.map((a) => <tr key={a.id}><td><Chip texto={TIPO_ACT[a.tipo]?.n} color={TIPO_ACT[a.tipo]?.c} /> {a.titulo}</td><td>{esp(a.espacio_id)}</td><td>{fecha(a.inicio)}</td><td>{fecha(a.fin)}</td><td>{a.montaje_h} h / {a.desmontaje_h} h</td><td>{{ confirmada: 'Confirmada', por_reubicar: 'Por reubicar', anulada: 'Anulada' }[a.estado as string]}</td></tr>)}
          {acts.length === 0 && <tr><td colSpan={6} className="ayuda">Todavía no hay nada agendado para esta orden.</td></tr>}
        </tbody></table></div>
    </Card>
  )
}

/* ------------------------------------------------------------- Agendar */
export function AgendarForm({ espacios, ordenId, onDone }: { espacios: any[]; ordenId?: number; onDone: () => void }) {
  const [tipo, setTipo] = useState('funcion'); const [titulo, setTitulo] = useState('')
  const [espacio, setEspacio] = useState(String(espacios[0]?.id || '')); const [ini, setIni] = useState(''); const [fin, setFin] = useState('')
  const [cupo, setCupo] = useState(''); const [mon, setMon] = useState(''); const [des, setDes] = useState('')
  const acc = useAccion(onDone)
  const args = (esp: string) => ({ p_espacio: Number(esp), p_tipo: tipo, p_titulo: titulo, p_inicio: `${ini}:00`, p_fin: `${fin}:00`, p_orden: ordenId ?? null, p_cupo: cupo ? Number(cupo) : null, p_montaje_h: mon !== '' ? Number(mon) : null, p_desmontaje_h: des !== '' ? Number(des) : null })
  const enviar = (esp: string) => acc.run('rpc_agendar', args(esp), (r) => r.enviadas_a_reubicar > 0 ? `Agendado. ${r.enviadas_a_reubicar} actividad(es) pasaron a la lista para reubicar porque las funciones tienen prioridad.` : 'Agendado.')
  const ensayo = espacios.find((e) => e.nombre === 'Sala de Ensayo')
  return (
    <Card cinta>
      <h2 className="text-2xl">Agendar una actividad</h2>
      <div className="grid sm:grid-cols-3 gap-3 mt-2">
        <Campo label="Tipo"><select className="campo" value={tipo} onChange={(e) => setTipo(e.target.value)}>{Object.entries(TIPO_ACT).map(([k, v]) => <option key={k} value={k}>{v.n}</option>)}</select></Campo>
        <Campo label="Título"><input className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} /></Campo>
        <Campo label="Espacio"><select className="campo" value={espacio} onChange={(e) => setEspacio(e.target.value)}>{espacios.map((e) => <option key={e.id} value={e.id}>{e.nombre} (cupo {e.cupo})</option>)}</select></Campo>
        <Campo label="Desde"><input className="campo" type="datetime-local" value={ini} onChange={(e) => setIni(e.target.value)} /></Campo>
        <Campo label="Hasta"><input className="campo" type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)} /></Campo>
        <Campo label="Cupo (opcional)"><input className="campo num" type="number" min="1" value={cupo} onChange={(e) => setCupo(e.target.value)} /></Campo>
        <Campo label="Horas de montaje antes" ayuda="Vacío: 4 h para funciones."><input className="campo num" type="number" min="0" value={mon} onChange={(e) => setMon(e.target.value)} /></Campo>
        <Campo label="Horas de desmontaje después" ayuda="Vacío: 2 h para funciones."><input className="campo num" type="number" min="0" value={des} onChange={(e) => setDes(e.target.value)} /></Campo>
      </div>
      <p className="ayuda mt-2">Funciones y talleres: martes a domingo, de 10 a 23.</p>
      <div className="mt-3"><Btn rojo busy={acc.busy} onClick={() => enviar(espacio)}>Agendar</Btn></div>
      <Mensajes a={acc} reload={onDone} />
      {acc.error && acc.error.startsWith('Choque') && ensayo && String(ensayo.id) !== espacio && (
        <div className="mt-2"><Btn claro onClick={() => { setEspacio(String(ensayo.id)); enviar(String(ensayo.id)) }}>Probar en Sala de Ensayo</Btn></div>
      )}
    </Card>
  )
}

function Reubicar({ a, espacios, staff, onDone }: any) {
  const [esp, setEsp] = useState(String(a.espacio_id)); const [ini, setIni] = useState(''); const [fin, setFin] = useState('')
  const acc = useAccion(onDone)
  return (
    <div className="border-t border-tinta/30 pt-2 mt-2">
      <p><Chip texto={TIPO_ACT[a.tipo]?.n} color={TIPO_ACT[a.tipo]?.c} /> <b>{a.titulo}</b> <span className="ayuda">(era {fecha(a.inicio)})</span></p>
      {staff && (
        <div className="grid sm:grid-cols-4 gap-2 items-end mt-1">
          <Campo label="Espacio"><select className="campo" value={esp} onChange={(e) => setEsp(e.target.value)}>{espacios.map((e: any) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></Campo>
          <Campo label="Desde"><input className="campo" type="datetime-local" value={ini} onChange={(e) => setIni(e.target.value)} /></Campo>
          <Campo label="Hasta"><input className="campo" type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)} /></Campo>
          <Btn rojo busy={acc.busy} onClick={() => acc.run('rpc_reubicar_actividad', { p_actividad: a.id, p_espacio: Number(esp), p_inicio: `${ini}:00`, p_fin: `${fin}:00` }, () => 'Reubicada y confirmada.')}>Reubicar</Btn>
        </div>
      )}
      <Mensajes a={acc} reload={onDone} />
    </div>
  )
}

/* ------------------------------------------------------------- Detalle */
function DetalleActividad({ a, espacios, staff, rol, onClose, onDone }: any) {
  const nombres: Record<number, string> = Object.fromEntries(espacios.map((e: any) => [e.id, e.nombre]))
  const conCupo = a.cupo != null
  const puedeInscribir = ['gestion', 'coordinacion', 'responsable'].includes(rol)
  const [nombre, setNombre] = useState(''); const [asist, setAsist] = useState(0); const [rec, setRec] = useState(0)
  const q = useData(async () => {
    const ins = conCupo && puedeInscribir ? must(await supabase.from('inscripciones').select('*').eq('actividad_id', a.id).order('id')) : []
    const coop = staff && a.tipo === 'funcion' ? must(await supabase.from('funciones_coop').select('*').eq('actividad_id', a.id).maybeSingle()) : null
    const actual = must(await supabase.from('actividades').select('cupo_disponible').eq('id', a.id).maybeSingle())
    return { ins, coop, disp: actual?.cupo_disponible }
  }, [a.id])
  const d: any = q.data
  const recargar = () => { q.reload(); onDone() }
  const ins = useAccion(recargar); const coop = useAccion(recargar); const ciclo = useAccion(recargar)
  const [copiado, setCopiado] = useState(false)
  return (
    <Card cinta className="mt-4">
      <div className="flex justify-between gap-3">
        <div><Chip texto={TIPO_ACT[a.tipo]?.n} color={TIPO_ACT[a.tipo]?.c} /> <h2 className="inline text-3xl align-middle ml-2">{a.titulo}</h2>
          <p>{nombres[a.espacio_id]} · {fecha(a.inicio)} a {fecha(a.fin)}</p>
          {(a.montaje_h > 0 || a.desmontaje_h > 0) && <p className="ayuda">Además reserva {a.montaje_h} h antes (montaje) y {a.desmontaje_h} h después (desmontaje).</p>}</div>
        <Btn claro onClick={onClose}>Cerrar</Btn>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        <Btn claro onClick={() => descargarIcs([a], nombres, `actividad-${a.id}`)}>Descargar .ics</Btn>
        <Btn claro onClick={async () => { await navigator.clipboard.writeText(textoWhatsApp(a, nombres[a.espacio_id])); setCopiado(true) }}>{copiado ? 'Texto copiado' : 'Copiar texto para WhatsApp'}</Btn>
      </div>
      {conCupo && d && (
        <div className="mt-4 border-t border-tinta/30 pt-3">
          <h3 className="text-xl">Cupo</h3>
          <p className="num">{d.disp <= 0 ? <b className="text-telon">Completo</b> : <>Quedan <b>{d.disp}</b> lugares de {a.cupo}.</>}</p>
          {puedeInscribir && (
            <>
              <div className="flex flex-wrap gap-2 items-end mt-2">
                <Campo label="Nombre de la persona"><input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} /></Campo>
                <Btn rojo busy={ins.busy} disabled={d.disp <= 0} onClick={() => ins.run('rpc_inscribir', { p_actividad: a.id, p_nombre: nombre }, () => 'Inscripción confirmada.')}>Inscribir</Btn>
                {staff && <Btn claro busy={ciclo.busy} onClick={() => ciclo.run('rpc_reiniciar_ciclo', { p_actividad: a.id }, () => 'Ciclo nuevo: el cupo volvió a estar completo.')}>Abrir ciclo nuevo</Btn>}
              </div>
              <ul className="mt-2 text-sm">
                {d.ins.filter((i: any) => i.estado === 'confirmada').map((i: any) => <li key={i.id} className="flex gap-3 items-center py-0.5">{i.nombre}<button className="underline text-telon" onClick={() => ins.run('rpc_baja_inscripcion', { p_inscripcion: i.id }, () => 'Baja registrada: se liberó un lugar.')}>dar de baja</button></li>)}
              </ul>
              <Mensajes a={ins} reload={recargar} /><Mensajes a={ciclo} reload={recargar} />
            </>
          )}
        </div>
      )}
      {staff && a.tipo === 'funcion' && d && (
        <div className="mt-4 border-t border-tinta/30 pt-3">
          <h3 className="text-xl">Cooperación solidaria</h3>
          {d.coop ? (
            <p className="num">Asistieron {d.coop.asistentes} personas y se recaudó {money(d.coop.recaudado)}. Para el elenco ({num(d.coop.pct_elenco)} %): {money(d.coop.parte_elenco)}. Para la sala: {money(d.coop.parte_sala)} (entró a la cuenta de Programación artística).</p>
          ) : (
            <>
              <p className="ayuda">Cada espectador decide cuánto aportar al salir. Cargá cuántos fueron y el total.</p>
              <div className="flex flex-wrap gap-2 items-end">
                <Campo label="Asistentes"><input className="campo num" type="number" min="0" max={a.cupo || 100} value={asist} onChange={(e) => setAsist(Number(e.target.value))} /></Campo>
                <Campo label="Total recaudado"><input className="campo num" type="number" min="0" value={rec} onChange={(e) => setRec(Number(e.target.value))} /></Campo>
                <Btn rojo busy={coop.busy} onClick={() => coop.run('rpc_registrar_cooperacion', { p_actividad: a.id, p_asistentes: asist, p_recaudado: rec }, (r) => `De ${money(rec)}, ${money(r.para_elenco)} van al elenco y ${money(r.para_sala)} quedan en la sala.`)}>Registrar</Btn>
              </div>
              <Mensajes a={coop} reload={recargar} />
            </>
          )}
        </div>
      )}
    </Card>
  )
}
