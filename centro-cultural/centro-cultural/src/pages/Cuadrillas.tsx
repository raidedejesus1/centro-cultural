import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Btn, Card, Cargando, Chip, Mensajes, Titulo, fecha, money, must, num, useAccion, useData } from '../lib/ui'

export default function Cuadrillas() {
  const q = useData(async () => {
    const [cuads, horas, partes, turnos, integ, ordenes] = await Promise.all([
      supabase.from('v_cuadrilla_estado').select('*').order('cuadrilla_id'),
      supabase.from('v_horas_libres').select('*').order('cuadrilla_id'),
      supabase.from('partes').select('*').eq('estado', 'cargado').order('id'),
      supabase.from('turnos').select('*').eq('estado', 'programado').order('inicio'),
      supabase.from('integrantes').select('*'),
      supabase.from('ordenes').select('id,codigo,titulo'),
    ])
    return { cuads: must(cuads), horas: must(horas), partes: must(partes), turnos: must(turnos), integ: must(integ), ordenes: must(ordenes) }
  })
  const acc = useAccion(q.reload); const acc2 = useAccion(q.reload)
  const d: any = q.data
  const nombre = (id: number) => d.integ.find((x: any) => x.id === id)?.nombre
  const orden = (id: number) => d.ordenes.find((x: any) => x.id === id)
  return (
    <div>
      <Titulo sub="Las horas libres arrancan en el total de la semana, bajan con cada turno y se reinician cada lunes. Los turnos se arman desde cada orden.">Cuadrillas</Titulo>
      <Cargando q={q} />
      {d && (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            {d.cuads.map((c: any) => (
              <Card key={c.cuadrilla_id} cinta>
                <div className="flex justify-between items-start gap-2"><h2 className="text-2xl">{c.nombre}</h2><Chip texto={c.estado} color={c.estado === 'Sin horas' ? '#8C1D18' : '#3F6B4F'} /></div>
                <p className="num">Valor hora: <b>{money(c.valor_hora)}</b> · {c.integrantes} integrantes · {num(c.horas_semanales)} h por persona por semana</p>
                <p className="num">Horas libres esta semana (entre todos): <b>{num(c.horas_libres)}</b></p>
                <ul className="mt-1 text-sm">{d.horas.filter((h: any) => h.cuadrilla_id === c.cuadrilla_id).map((h: any) => <li key={h.integrante_id} className="num">{h.nombre}: {num(h.horas_libres)} h libres de {num(h.horas_semanales)}</li>)}</ul>
              </Card>
            ))}
          </div>
          <Card>
            <h2 className="text-2xl">Partes esperando confirmación</h2>
            <p className="ayuda">La cuadrilla carga sus horas desde el celular; acá coordinación las confirma. Recién ahí cuentan en el costo.</p>
            <div className="overflow-x-auto"><table className="tabla"><thead><tr><th>Persona</th><th>Orden</th><th>Horas cargadas</th><th>Nota</th><th></th></tr></thead>
              <tbody>
                {d.partes.map((p: any) => (
                  <tr key={p.id}><td>{nombre(p.integrante_id)}</td><td><Link className="underline" to={`/ordenes/${p.orden_id}`}>{orden(p.orden_id)?.codigo}</Link></td><td className="num">{num(p.horas)}</td><td>{p.nota}</td>
                    <td><Btn claro busy={acc.busy} onClick={() => acc.run('rpc_confirmar_parte', { p_parte: p.id, p_horas: null }, (r) => r.voluntario ? 'Confirmado como aporte comunitario.' : `Confirmado: ${money(r.costo)}.`)}>Confirmar horas</Btn></td></tr>
                ))}
                {d.partes.length === 0 && <tr><td colSpan={5} className="ayuda">No hay partes pendientes.</td></tr>}
              </tbody></table></div>
            <Mensajes a={acc} reload={q.reload} />
          </Card>
          <Card>
            <h2 className="text-2xl">Turnos programados</h2>
            <div className="overflow-x-auto"><table className="tabla"><thead><tr><th>Persona</th><th>Orden</th><th>Desde</th><th>Hasta</th><th>Horas</th><th></th></tr></thead>
              <tbody>
                {d.turnos.map((t: any) => (
                  <tr key={t.id}><td>{nombre(t.integrante_id)}</td><td><Link className="underline" to={`/ordenes/${t.orden_id}`}>{orden(t.orden_id)?.codigo}</Link></td><td>{fecha(t.inicio)}</td><td>{fecha(t.fin)}</td><td className="num">{num(t.horas)}{t.voluntario && ' (voluntario)'}</td>
                    <td><Btn claro busy={acc2.busy} onClick={() => acc2.run('rpc_anular_turno', { p_turno: t.id }, () => 'Turno anulado.')}>Anular</Btn></td></tr>
                ))}
                {d.turnos.length === 0 && <tr><td colSpan={6} className="ayuda">No hay turnos programados.</td></tr>}
              </tbody></table></div>
            <Mensajes a={acc2} reload={q.reload} />
          </Card>
        </>
      )}
    </div>
  )
}
