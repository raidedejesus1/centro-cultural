import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Btn, Card, Cargando, Mensajes, Titulo, money, must, num, useAccion, useData } from '../lib/ui'

export default function Materiales() {
  const { profile } = useAuth()
  const staff = profile.rol === 'gestion' || profile.rol === 'coordinacion'
  const q = useData(async () => must(await supabase.from('v_materiales').select('*').order('nombre')))
  const acc = useAccion(q.reload)
  const [cant, setCant] = useState<Record<number, number>>({})
  const lista: any[] = (q.data as any) || []
  return (
    <div>
      <Titulo sub="Físico es lo que hay en el depósito. Disponible es lo que podés reservar hoy: lo que hay, menos lo reservado y lo que está fuera de uso.">Materiales</Titulo>
      <Cargando q={q} />
      <Mensajes a={acc} reload={q.reload} />
      <div className="overflow-x-auto">
        <table className="tabla bg-[#FBF6EA]">
          <thead><tr><th>Material</th><th>Tipo</th><th>Físico</th><th>Reservado</th><th>Fuera de uso</th><th>Disponible</th><th>Mínimo</th><th>Costo</th>{staff && <th></th>}</tr></thead>
          <tbody>
            {lista.map((m) => (
              <tr key={m.id} style={m.bajo_minimo ? { background: '#f3e7c9' } : undefined}>
                <td><b>{m.nombre}</b> <span className="ayuda">({m.unidad})</span>{m.bajo_minimo && <div className="ayuda text-telon font-bold">Por debajo del mínimo: conviene reponer.</div>}</td>
                <td>{m.tipo === 'consumible' ? 'Se consume' : 'Se presta'}</td>
                <td className="num">{num(m.fisico)}</td><td className="num">{num(m.reservado)}</td><td className="num">{num(m.fuera_de_uso)}</td>
                <td className="num font-bold">{num(m.disponible)}</td><td className="num">{num(m.minimo)}</td><td className="num">{money(m.costo)}</td>
                {staff && <td>{Number(m.fuera_de_uso) > 0 && (
                  <div className="flex gap-1 items-center">
                    <input className="campo num !w-16" type="number" min="1" max={m.fuera_de_uso} value={cant[m.id] ?? m.fuera_de_uso} onChange={(e) => setCant({ ...cant, [m.id]: Number(e.target.value) })} />
                    <Btn claro busy={acc.busy} onClick={() => acc.run('rpc_reparar_material', { p_material: m.id, p_cantidad: cant[m.id] ?? m.fuera_de_uso }, () => 'Marcado como reparado: vuelve a estar disponible.')}>Marcar reparado</Btn>
                  </div>
                )}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Card><p className="ayuda">Los consumibles bajan el físico por lo realmente usado. Los reutilizables vuelven al devolverlos aptos; si vuelven dañados, quedan fuera de uso hasta repararlos; si se pierden, bajan del físico.</p></Card>
    </div>
  )
}
