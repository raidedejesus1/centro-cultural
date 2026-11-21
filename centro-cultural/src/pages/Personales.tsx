import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ESTADO_CARGO, TIPO_ACT, TIPO_ORDEN } from '../lib/const'
import { Barra, Btn, Campo, Card, Cargando, Chip, Mensajes, Sello, Titulo, fecha, money, must, num, useAccion, useData } from '../lib/ui'

/* ---------------------------------------------------- Cuenta de mi área */
export function CuentaArea() {
  const { profile } = useAuth()
  const q = useData(async () => {
    const [s, cargos, ingresos, ordenes] = await Promise.all([
      supabase.from('v_saldo_area').select('*').eq('area_id', profile.area_id).maybeSingle(),
      supabase.from('cargos_internos').select('*').order('numero', { ascending: false }),
      supabase.from('ingresos_area').select('*').eq('area_id', profile.area_id).order('id', { ascending: false }),
      supabase.from('ordenes').select('id,codigo,titulo'),
    ])
    return { s: must(s), cargos: must(cargos), ingresos: must(ingresos), ordenes: must(ordenes) }
  })
  const d: any = q.data
  const s = d?.s
  return (
    <div>
      <Titulo sub="Solo ves la cuenta de tu área.">Cuenta de mi área</Titulo>
      <Cargando q={q} />
      {s && (
        <>
          <Card cinta>
            <h2 className="text-3xl">{s.nombre}</h2>
            <p className="num mt-1">Presupuesto del año: <b>{money(s.presupuesto_anual)}</b></p>
            <div className="my-2"><Barra total={Number(s.presupuesto_anual)} partes={[{ v: Number(s.ejecutado), c: '#16120F', t: 'Ejecutado' }, { v: Number(s.comprometido), c: '#C98A1B', t: 'Comprometido' }]} /></div>
            <dl className="num grid sm:grid-cols-3 gap-3">
              <div><dt className="font-bold">Comprometido</dt><dd className="text-2xl titulo">{money(s.comprometido)}</dd><dd className="ayuda">Lo de órdenes ya aprobadas que todavía no se cerraron.</dd></div>
              <div><dt className="font-bold">Ejecutado</dt><dd className="text-2xl titulo">{money(s.ejecutado)}</dd><dd className="ayuda">Lo que costó de verdad lo que ya se cerró.</dd></div>
              <div><dt className="font-bold">Saldo</dt><dd className="text-2xl titulo">{money(s.saldo)}</dd><dd className="ayuda">Presupuesto anual menos comprometido menos ejecutado.</dd></div>
            </dl>
            {s.nivel === 'alerta' && <p className="mt-2 border-2 border-[#B57A12] bg-[#f3e7c9] p-2 font-bold">Tu área ya consumió el 80 % o más de su presupuesto.</p>}
            {s.nivel === 'tope' && <p className="mt-2 border-2 border-telon bg-[#f6dcd6] p-2 font-bold">Llegaron al tope: solo gestión puede aprobar nuevas órdenes, y con motivo.</p>}
          </Card>
          <Card>
            <h2 className="text-2xl">Cargos internos de mi área</h2>
            <div className="overflow-x-auto"><table className="tabla"><thead><tr><th>Cargo</th><th>Orden</th><th>Monto</th><th>Estado</th></tr></thead>
              <tbody>{d.cargos.map((c: any) => <tr key={c.id}><td className="num">{c.numero}</td><td><Link className="underline" to={`/ordenes/${c.orden_id}`}>{d.ordenes.find((o: any) => o.id === c.orden_id)?.codigo}</Link></td><td className="num">{c.area_destino_id === profile.area_id ? money(c.monto) : `+ ${money(c.monto)} (a favor)`}</td><td>{ESTADO_CARGO[c.estado]}</td></tr>)}
                {d.cargos.length === 0 && <tr><td colSpan={4} className="ayuda">Todavía no hay cargos.</td></tr>}</tbody></table></div>
          </Card>
          {d.ingresos.length > 0 && (
            <Card>
              <h2 className="text-2xl">Ingresos por cooperación solidaria</h2>
              <p className="ayuda">Total: <b className="num">{money(s.ingresos)}</b>. Es la parte de la sala de cada función.</p>
              <ul className="text-sm">{d.ingresos.map((i: any) => <li key={i.id} className="num">{i.concepto}: {money(i.monto)}</li>)}</ul>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ Mis turnos */
export function MisTurnos() {
  const { profile } = useAuth()
  const q = useData(async () => {
    const [t, p, h, o] = await Promise.all([
      supabase.from('turnos').select('*').eq('estado', 'programado').order('inicio'),
      supabase.from('partes').select('*'),
      supabase.from('v_horas_libres').select('*').eq('integrante_id', profile.integrante_id).maybeSingle(),
      supabase.from('ordenes').select('id,codigo,titulo'),
    ])
    return { t: must(t), p: must(p), h: must(h), o: must(o) }
  })
  const d: any = q.data
  return (
    <div>
      <Titulo sub="Tus turnos y las horas que cargás. Coordinación las confirma.">Mis turnos</Titulo>
      <Cargando q={q} />
      {d?.h && <Card cinta><p className="num">Esta semana tenés <b className="titulo text-3xl">{num(d.h.horas_libres)}</b> horas libres de {num(d.h.horas_semanales)}.</p><p className="ayuda">Ya tenés {num(d.h.horas_usadas)} h en turnos. Se reinicia cada lunes.</p></Card>}
      {d && d.t.length === 0 && <Card><p>No tenés turnos programados por ahora.</p></Card>}
      {d && d.t.map((t: any) => <TurnoCard key={t.id} t={t} parte={d.p.find((p: any) => p.turno_id === t.id)} orden={d.o.find((o: any) => o.id === t.orden_id)} reload={q.reload} />)}
    </div>
  )
}

function TurnoCard({ t, parte, orden, reload }: any) {
  const [horas, setHoras] = useState(t.horas); const [nota, setNota] = useState('')
  const acc = useAccion(reload)
  return (
    <Card>
      <p className="font-bold text-lg">{orden?.codigo} · {orden?.titulo}</p>
      <p className="num">{fecha(t.inicio)} a {fecha(t.fin)} · {num(t.horas)} h{t.voluntario && ' · voluntario'}</p>
      {parte ? <p className="mt-2"><Chip texto={parte.estado === 'confirmado' ? 'Confirmado' : 'Cargado'} color={parte.estado === 'confirmado' ? '#3F6B4F' : '#B57A12'} /> {num(parte.horas)} h</p> : (
        <div className="mt-2 grid grid-cols-2 gap-3 items-end">
          <Campo label="Horas trabajadas"><input className="campo num" type="number" min="0" step="0.25" value={horas} onChange={(e) => setHoras(Number(e.target.value))} /></Campo>
          <Campo label="Nota (opcional)"><input className="campo" value={nota} onChange={(e) => setNota(e.target.value)} /></Campo>
          <div className="col-span-2"><button className="btn btn-rojo w-full !py-3 text-lg" disabled={acc.busy} onClick={() => acc.run('rpc_cargar_parte', { p_turno: t.id, p_horas: horas, p_nota: nota || null }, () => 'Parte cargado. Coordinación lo va a confirmar.')}>{acc.busy ? 'Un momento…' : 'Cargar parte'}</button></div>
        </div>
      )}
      <Mensajes a={acc} reload={reload} />
    </Card>
  )
}

/* --------------------------------------------------------------- Mi obra */
export function MiObra() {
  const q = useData(async () => {
    const [o, a, e] = await Promise.all([
      supabase.from('ordenes').select('id,codigo,titulo,tipo,estado').order('id', { ascending: false }),
      supabase.from('actividades').select('*').neq('estado', 'anulada').order('inicio'),
      supabase.from('espacios').select('*'),
    ])
    return { o: must(o), a: must(a), e: must(e) }
  })
  const d: any = q.data
  return (
    <div>
      <Titulo sub="Las órdenes y funciones de tu obra. Acá no se muestran costos.">Mi obra</Titulo>
      <Cargando q={q} />
      {d && d.o.length === 0 && <Card><p>Todavía no hay órdenes asociadas a tu elenco.</p></Card>}
      {d && d.o.map((o: any) => (
        <Card key={o.id} cinta>
          <div className="flex flex-wrap gap-3 items-center"><h2 className="text-2xl">{o.codigo} · {o.titulo}</h2><Sello estado={o.estado} /></div>
          <p className="ayuda">{TIPO_ORDEN[o.tipo]}</p>
          <ul className="mt-2 space-y-1">
            {d.a.filter((a: any) => a.orden_id === o.id).map((a: any) => (
              <li key={a.id}><Chip texto={TIPO_ACT[a.tipo]?.n} color={TIPO_ACT[a.tipo]?.c} /> <span className="num">{fecha(a.inicio)} a {fecha(a.fin)}</span> · {d.e.find((x: any) => x.id === a.espacio_id)?.nombre}{a.montaje_h > 0 && <span className="ayuda"> (montaje {a.montaje_h} h antes)</span>}</li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  )
}
