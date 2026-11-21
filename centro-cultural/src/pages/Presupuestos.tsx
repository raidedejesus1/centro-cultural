import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Btn, Campo, Card, Cargando, Mensajes, Sello, Titulo, money, must, useAccion, useData } from '../lib/ui'

// Botón de aprobación (solo gestión). Si el área llegó al tope, la base pide el motivo.
export function AprobarPresupuesto({ presupuesto, onDone }: { presupuesto: any; onDone: () => void }) {
  const acc = useAccion(onDone)
  const [motivo, setMotivo] = useState('')
  return (
    <div className="mt-2 border-t border-tinta/30 pt-2">
      <Campo label="Motivo (obligatorio si el área ya llegó al tope de su presupuesto)">
        <input className="campo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Campo>
      <div className="mt-2">
        <Btn rojo busy={acc.busy} onClick={() => acc.run('rpc_aprobar_presupuesto', { p_presupuesto: presupuesto.id, p_motivo: motivo || null }, (r) =>
          r.alerta ? `Aprobada. Ojo: el área ya consumió ${r.pct_consumido_despues} % de su presupuesto anual.` : `Aprobada: la orden quedó ${r.orden_estado}.`)}>
          Aprobar versión {presupuesto.version}
        </Btn>
      </div>
      <Mensajes a={acc} reload={onDone} />
    </div>
  )
}

export default function Presupuestos() {
  const { profile } = useAuth()
  const puedeAprobar = profile.rol === 'gestion'
  const q = useData(async () => {
    const pend = must(await supabase.from('presupuestos').select('*').eq('estado', 'pendiente').order('created_at'))
    const ids = pend.map((p: any) => p.orden_id)
    const ordenes = ids.length ? must(await supabase.from('ordenes').select('*').in('id', ids)) : []
    const areas = must(await supabase.from('areas').select('id,nombre'))
    const saldos = must(await supabase.from('v_saldo_area').select('*'))
    return { pend, ordenes, areas, saldos }
  })
  const d: any = q.data
  return (
    <div>
      <Titulo sub="Versiones de presupuesto que esperan aprobación. Una vez aprobada, una versión no se toca: cualquier cambio crea otra.">Presupuestos</Titulo>
      <Cargando q={q} />
      {d && d.pend.length === 0 && <Card><p>No hay presupuestos esperando aprobación. Cuando coordinación cargue uno, aparece acá.</p></Card>}
      {d && d.pend.map((p: any) => {
        const o = d.ordenes.find((x: any) => x.id === p.orden_id)
        const s = d.saldos.find((x: any) => x.area_id === o?.area_solicitante_id)
        return (
          <Card key={p.id} cinta>
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div>
                <Link className="titulo text-2xl text-telon underline" to={`/ordenes/${p.orden_id}`}>{o?.codigo} · {o?.titulo}</Link>
                <p className="ayuda">Falta aprobar la versión {p.version} del presupuesto.</p>
              </div>
              {o && <Sello estado={o.estado} />}
            </div>
            <p className="mt-2 num">Total: <b>{money(p.total)}</b> <span className="ayuda">(materiales y gastos externos más 10 % de imprevistos, más las horas)</span></p>
            {s && <p className="ayuda">Área que pide: {s.nombre}. Saldo hoy: {money(s.saldo)} ({s.pct_consumido} % consumido).{s.nivel === 'alerta' && ' Ya pasó el 80 %.'}{s.nivel === 'tope' && ' Llegó al tope: hace falta un motivo.'}</p>}
            {puedeAprobar ? <AprobarPresupuesto presupuesto={p} onDone={q.reload} /> : <p className="ayuda mt-2">Solo gestión aprueba presupuestos.</p>}
          </Card>
        )
      })}
    </div>
  )
}
