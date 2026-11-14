import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { TIPO_ORDEN } from '../lib/const'
import { Barra, Btn, Card, Cargando, Sello, Titulo, descargarCsv, money, must, num, useData } from '../lib/ui'

export default function Informes() {
  const q = useData(async () => {
    const [saldos, info, ordenes, coop, acts, elencos] = await Promise.all([
      supabase.from('v_saldo_area').select('*').order('area_id'), supabase.from('v_informe_orden').select('*').order('orden_id'),
      supabase.from('ordenes').select('id,tipo,elenco_id'), supabase.from('funciones_coop').select('*').order('id'),
      supabase.from('actividades').select('id,titulo,inicio,orden_id'), supabase.from('elencos').select('id,nombre'),
    ])
    return { saldos: must(saldos), info: must(info), ordenes: must(ordenes), coop: must(coop), acts: must(acts), elencos: must(elencos) }
  })
  const d: any = q.data
  const tipoDe = (id: number) => d.ordenes.find((o: any) => o.id === id)?.tipo
  const filas = d ? d.info.map((r: any) => ({ ...r, tipo: tipoDe(r.orden_id) })) : []
  const obras = filas.filter((r: any) => r.tipo === 'montaje_obra' && ['cerrada', 'cargada'].includes(r.estado))
  const voluntarias = filas.reduce((s: number, r: any) => s + Number(r.horas_voluntarias || 0), 0)
  const desvios = filas.filter((r: any) => r.aprobado && Number(r.costo_real) > Number(r.aprobado)).map((r: any) => ({ ...r, pct: Math.round((Number(r.costo_real) / Number(r.aprobado) - 1) * 1000) / 10 })).sort((a: any, b: any) => b.pct - a.pct)
  return (
    <div>
      <Titulo sub="Los números de todo el centro, explicados con palabras simples.">Informes</Titulo>
      <Cargando q={q} />
      {d && (
        <>
          <Card cinta>
            <div className="flex justify-between gap-2"><h2 className="text-2xl">Saldo por área</h2><Btn claro onClick={() => descargarCsv('saldo-por-area', d.saldos)}>Descargar CSV</Btn></div>
            <p className="ayuda">Saldo = presupuesto anual − lo comprometido (órdenes aprobadas sin cerrar) − lo ejecutado (lo que costó lo ya cerrado).</p>
            {d.saldos.map((s: any) => (
              <div key={s.area_id} className="my-3">
                <div className="flex justify-between flex-wrap"><b>{s.nombre}</b><span className="num">Saldo {money(s.saldo)} de {money(s.presupuesto_anual)} ({s.pct_consumido} % consumido)</span></div>
                <Barra total={Number(s.presupuesto_anual)} partes={[{ v: Number(s.ejecutado), c: '#16120F', t: 'Ejecutado' }, { v: Number(s.comprometido), c: '#C98A1B', t: 'Comprometido' }]} />
                {s.nivel !== 'ok' && <p className="font-bold text-telon">{s.nivel === 'tope' ? 'Llegó al tope: solo gestión aprueba, con motivo.' : 'Ya consumió el 80 % o más.'}</p>}
              </div>
            ))}
          </Card>

          <Card>
            <h2 className="text-2xl">¿La obra se pagó sola?</h2>
            <p className="ayuda">Sí si la parte de la sala de la cooperación solidaria cubre el costo real de la obra.</p>
            {obras.length === 0 && <p>Todavía no hay obras cerradas.</p>}
            {obras.map((r: any) => (
              <div key={r.orden_id} className="border-t border-tinta/30 py-2">
                <div className="flex flex-wrap items-center gap-3"><Link className="font-bold underline" to={`/ordenes/${r.orden_id}`}>{r.codigo} · {r.titulo}</Link>
                  <span className="sello" style={{ color: Number(r.resultado) >= 0 ? '#3F6B4F' : '#8C1D18' }}>{Number(r.resultado) >= 0 ? 'Sí, se pagó sola' : 'No alcanzó'}</span></div>
                <p className="num text-sm">La sala recibió {money(r.ingreso_sala)} de cooperación y la obra costó {money(r.costo_real)}. {Number(r.resultado) >= 0 ? `Sobraron ${money(r.resultado)}.` : `Faltaron ${money(-Number(r.resultado))}.`}</p>
              </div>
            ))}
          </Card>

          <Card>
            <div className="flex justify-between gap-2"><h2 className="text-2xl">Por orden</h2><Btn claro onClick={() => descargarCsv('informe-por-orden', filas)}>Descargar CSV</Btn></div>
            <div className="overflow-x-auto"><table className="tabla"><thead><tr><th>Orden</th><th>Tipo</th><th>Estado</th><th>Aprobado</th><th>Costo real</th><th>Horas voluntarias</th></tr></thead>
              <tbody>{filas.map((r: any) => <tr key={r.orden_id}><td><Link className="underline" to={`/ordenes/${r.orden_id}`}>{r.codigo}</Link></td><td>{TIPO_ORDEN[r.tipo]}</td><td><Sello estado={r.estado} /></td><td className="num">{r.aprobado != null ? money(r.aprobado) : '—'}</td><td className="num">{money(r.costo_real)}</td><td className="num">{num(r.horas_voluntarias)}</td></tr>)}</tbody></table></div>
          </Card>

          <Card>
            <h2 className="text-2xl">Aporte comunitario</h2>
            <p className="num text-3xl titulo">{num(voluntarias)} horas</p>
            <p className="ayuda">Trabajo voluntario registrado en las órdenes. Se cuenta en horas, nunca en pesos: no suma al costo.</p>
          </Card>

          <Card>
            <div className="flex justify-between gap-2"><h2 className="text-2xl">Cooperación solidaria por función</h2><Btn claro onClick={() => descargarCsv('cooperacion', d.coop)}>Descargar CSV</Btn></div>
            <div className="overflow-x-auto"><table className="tabla"><thead><tr><th>Función</th><th>Asistentes</th><th>Recaudado</th><th>Reparto</th><th>Elenco</th><th>Sala</th></tr></thead>
              <tbody>{d.coop.map((c: any) => <tr key={c.id}><td>{d.acts.find((a: any) => a.id === c.actividad_id)?.titulo}</td><td className="num">{c.asistentes}</td><td className="num">{money(c.recaudado)}</td><td className="num">{num(c.pct_elenco)} % / {num(100 - c.pct_elenco)} %</td><td className="num">{money(c.parte_elenco)}</td><td className="num">{money(c.parte_sala)}</td></tr>)}
                {d.coop.length === 0 && <tr><td colSpan={6} className="ayuda">Todavía no se registró cooperación.</td></tr>}</tbody></table></div>
          </Card>

          <Card>
            <div className="flex justify-between gap-2"><h2 className="text-2xl">Desvíos</h2><Btn claro onClick={() => descargarCsv('desvios', desvios)}>Descargar CSV</Btn></div>
            <p className="ayuda">Órdenes que gastaron más de lo aprobado. Pasar el 10 % exige una versión nueva aprobada para poder cerrar.</p>
            <div className="overflow-x-auto"><table className="tabla"><thead><tr><th>Orden</th><th>Aprobado</th><th>Costo real</th><th>Se pasó</th></tr></thead>
              <tbody>{desvios.map((r: any) => <tr key={r.orden_id}><td><Link className="underline" to={`/ordenes/${r.orden_id}`}>{r.codigo} · {r.titulo}</Link></td><td className="num">{money(r.aprobado)}</td><td className="num">{money(r.costo_real)}</td><td className="num font-bold" style={{ color: r.pct > 10 ? '#8C1D18' : undefined }}>{r.pct} %</td></tr>)}
                {desvios.length === 0 && <tr><td colSpan={4} className="ayuda">Ninguna orden se pasó de lo aprobado.</td></tr>}</tbody></table></div>
          </Card>
        </>
      )}
    </div>
  )
}
