import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ESTADO_CARGO } from '../lib/const'
import { Btn, Campo, Card, Cargando, Chip, Mensajes, Titulo, mesLabel, money, must, useAccion, useData } from '../lib/ui'

const colorCargo: Record<string, string> = { emitido: '#B57A12', observado: '#8C1D18', conciliado: '#3F6B4F', anulado: '#777' }

export default function Facturacion() {
  const { profile } = useAuth()
  const gestion = profile.rol === 'gestion'
  const [fm, setFm] = useState(''); const [fe, setFe] = useState('')
  const [motivos, setMotivos] = useState<Record<number, string>>({})
  const q = useData(async () => {
    const [cargos, areas, ordenes, cierres] = await Promise.all([
      supabase.from('cargos_internos').select('*').order('numero', { ascending: false }),
      supabase.from('areas').select('id,nombre'), supabase.from('ordenes').select('id,codigo,titulo,estado'), supabase.from('cierres_mes').select('*'),
    ])
    return { cargos: must(cargos), areas: must(areas), ordenes: must(ordenes), cierres: must(cierres) }
  })
  const acc = useAccion(q.reload); const mes = useAccion(q.reload); const aj = useAccion(q.reload)
  const [mesCerrar, setMesCerrar] = useState(''); const [ajOrden, setAjOrden] = useState(''); const [ajMonto, setAjMonto] = useState(0); const [ajMotivo, setAjMotivo] = useState('')
  const d: any = q.data
  const area = (id: number) => d.areas.find((a: any) => a.id === id)?.nombre
  const orden = (id: number) => d.ordenes.find((o: any) => o.id === id)
  const cerrado = (m: string) => d?.cierres.some((c: any) => c.mes === m)
  const meses: string[] = d ? Array.from(new Set([...d.cargos.map((c: any) => c.mes), ...d.cierres.map((c: any) => c.mes)])).sort().reverse() as string[] : []
  const lista = d ? d.cargos.filter((c: any) => (!fm || c.mes === fm) && (!fe || c.estado === fe)) : []
  const observadosPorMes = (m: string) => d.cargos.filter((c: any) => c.mes === m && c.estado === 'observado').length
  return (
    <div>
      <Titulo sub="Un registro entre áreas del propio centro. No emite comprobantes fiscales.">Facturación interna</Titulo>
      <Cargando q={q} />
      {d && (
        <>
          <Card>
            <div className="grid sm:grid-cols-3 gap-3">
              <Campo label="Mes"><select className="campo" value={fm} onChange={(e) => setFm(e.target.value)}><option value="">Todos</option>{meses.map((m) => <option key={m} value={m}>{mesLabel(m)}{cerrado(m) ? ' (cerrado)' : ''}</option>)}</select></Campo>
              <Campo label="Estado"><select className="campo" value={fe} onChange={(e) => setFe(e.target.value)}><option value="">Todos</option>{Object.entries(ESTADO_CARGO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
            </div>
          </Card>
          <Mensajes a={acc} reload={q.reload} />
          <div className="overflow-x-auto">
            <table className="tabla bg-[#FBF6EA]">
              <thead><tr><th>Cargo</th><th>Orden</th><th>De → a</th><th>Monto</th><th>Mes</th><th>Estado</th>{gestion && <th>Acciones</th>}</tr></thead>
              <tbody>
                {lista.map((c: any) => {
                  const o = orden(c.orden_id); const bloqueado = cerrado(c.mes)
                  return (
                    <tr key={c.id}>
                      <td className="num font-bold">{c.numero}{c.es_ajuste && <div className="ayuda">Ajuste</div>}{c.sin_cargo && <div className="ayuda">Sin cargo: misma área</div>}</td>
                      <td><Link className="underline" to={`/ordenes/${c.orden_id}`}>{o?.codigo}</Link><div className="ayuda">{o?.titulo}</div></td>
                      <td className="text-sm">{area(c.area_origen_id)} → {area(c.area_destino_id)}</td>
                      <td className="num">{money(c.monto)}</td>
                      <td>{mesLabel(c.mes)}{bloqueado && ' 🔒'}</td>
                      <td><Chip texto={ESTADO_CARGO[c.estado]} color={colorCargo[c.estado]} />{c.motivo && <div className="ayuda">{c.motivo}</div>}</td>
                      {gestion && <td>
                        {!bloqueado && (c.estado === 'emitido' || c.estado === 'observado') && (
                          <div className="space-y-1 min-w-[12rem]">
                            <input className="campo" placeholder="Motivo (para observar o anular)" value={motivos[c.id] || ''} onChange={(e) => setMotivos({ ...motivos, [c.id]: e.target.value })} />
                            <div className="flex flex-wrap gap-1">
                              <Btn busy={acc.busy} onClick={() => acc.run('rpc_conciliar_cargo', { p_cargo: c.id, p_nota: motivos[c.id] || null }, () => `Cargo ${c.numero} conciliado.`)}>Conciliar</Btn>
                              {c.estado === 'emitido' && <Btn claro busy={acc.busy} onClick={() => acc.run('rpc_observar_cargo', { p_cargo: c.id, p_motivo: motivos[c.id] || '' }, () => 'Cargo observado.')}>Observar</Btn>}
                              <Btn claro busy={acc.busy} onClick={() => acc.run('rpc_anular_cargo', { p_cargo: c.id, p_motivo: motivos[c.id] || '' }, () => 'Cargo anulado.')}>Anular</Btn>
                            </div>
                          </div>
                        )}
                      </td>}
                    </tr>
                  )
                })}
                {lista.length === 0 && <tr><td colSpan={7} className="ayuda">No hay cargos con esos filtros.</td></tr>}
              </tbody>
            </table>
          </div>
          {gestion && (
            <>
              <Card cinta>
                <h2 className="text-2xl">Cerrar el mes</h2>
                <p className="ayuda">Se puede cerrar cuando no quedan cargos observados. Después del cierre, las correcciones se hacen con un cargo de ajuste en el mes abierto.</p>
                <div className="flex flex-wrap gap-3 items-end mt-2">
                  <Campo label="Mes"><select className="campo" value={mesCerrar} onChange={(e) => setMesCerrar(e.target.value)}><option value="">Elegí</option>{meses.filter((m) => !cerrado(m)).map((m) => <option key={m} value={m}>{mesLabel(m)} ({observadosPorMes(m)} observados)</option>)}</select></Campo>
                  <Btn rojo busy={mes.busy} onClick={() => mes.run('rpc_cerrar_mes', { p_mes: mesCerrar }, () => 'Mes cerrado.')}>Cerrar mes</Btn>
                </div>
                <Mensajes a={mes} reload={q.reload} />
                {d.cierres.length > 0 && <p className="ayuda mt-2">Meses cerrados: {d.cierres.map((c: any) => mesLabel(c.mes)).join(', ')}.</p>}
              </Card>
              <Card>
                <h2 className="text-2xl">Cargo de ajuste</h2>
                <p className="ayuda">Corrige una orden ya cerrada. Puede ser negativo. Cae en el mes que esté abierto.</p>
                <div className="grid sm:grid-cols-4 gap-3 items-end mt-2">
                  <Campo label="Orden"><select className="campo" value={ajOrden} onChange={(e) => setAjOrden(e.target.value)}><option value="">Elegí</option>{d.ordenes.filter((o: any) => ['cerrada', 'cargada'].includes(o.estado)).map((o: any) => <option key={o.id} value={o.id}>{o.codigo} · {o.titulo}</option>)}</select></Campo>
                  <Campo label="Monto del ajuste"><input className="campo num" type="number" value={ajMonto} onChange={(e) => setAjMonto(Number(e.target.value))} /></Campo>
                  <Campo label="Motivo"><input className="campo" value={ajMotivo} onChange={(e) => setAjMotivo(e.target.value)} /></Campo>
                  <Btn busy={aj.busy} onClick={() => aj.run('rpc_cargo_ajuste', { p_orden: Number(ajOrden), p_monto: ajMonto, p_motivo: ajMotivo }, (r) => `Se creó el cargo de ajuste ${r.cargo}.`)}>Crear ajuste</Btn>
                </div>
                <Mensajes a={aj} reload={q.reload} />
              </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}
