export const TIPO_ORDEN: Record<string, string> = {
  montaje_obra: 'Montaje de obra', taller_curso: 'Taller o curso', festival_evento: 'Festival o evento',
  refaccion: 'Refacción y mantenimiento edilicio', prestamo: 'Préstamo de equipamiento',
}
export const ESTADO: Record<string, { n: string; c: string; ayuda: string }> = {
  borrador: { n: 'Borrador', c: '#4A3F36', ayuda: 'Todavía no tiene presupuesto.' },
  presupuestada: { n: 'Presupuestada', c: '#B57A12', ayuda: 'Tiene presupuesto y falta que gestión lo apruebe.' },
  aprobada: { n: 'Aprobada', c: '#3F6B4F', ayuda: 'Presupuesto aprobado: ya puede empezar.' },
  en_ejecucion: { n: 'En ejecución', c: '#2F7A7A', ayuda: 'Se está trabajando: se cargan horas, materiales y gastos.' },
  excedida: { n: 'Excedida', c: '#8C1D18', ayuda: 'El costo real se pasó más del 10 % de lo aprobado.' },
  cerrada: { n: 'Cerrada', c: '#4B5A6A', ayuda: 'Terminó y ya tiene su cargo interno.' },
  cargada: { n: 'Cargada', c: '#6B3F7A', ayuda: 'El cargo interno ya está conciliado.' },
  anulada: { n: 'Anulada', c: '#777', ayuda: 'Se anuló antes de empezar.' },
}
export const TIPO_ACT: Record<string, { n: string; c: string }> = {
  funcion: { n: 'Función', c: '#8C1D18' }, taller: { n: 'Taller', c: '#C98A1B' }, seminario: { n: 'Seminario', c: '#3F6B4F' },
  montaje: { n: 'Montaje', c: '#4B5A6A' }, refaccion: { n: 'Refacción', c: '#B5562B' }, evento: { n: 'Evento', c: '#6B3F7A' },
  prestamo: { n: 'Préstamo', c: '#2F7A7A' },
}
export const ESTADO_CARGO: Record<string, string> = { emitido: 'Emitido', observado: 'Observado', conciliado: 'Conciliado', anulado: 'Anulado' }
export const ESTADO_PRES: Record<string, string> = { pendiente: 'Esperando aprobación', aprobado: 'Aprobado', reemplazada: 'Reemplazada', anulado: 'Anulado' }
export const ROL: Record<string, string> = { gestion: 'Gestión', coordinacion: 'Coordinación técnica', responsable: 'Responsable de área', cuadrilla: 'Integrante de cuadrilla', elenco: 'Elenco' }

const STAFF: [string, string][] = [['/ordenes', 'Órdenes'], ['/presupuestos', 'Presupuestos'], ['/agenda', 'Agenda'], ['/materiales', 'Materiales'], ['/cuadrillas', 'Cuadrillas'], ['/facturacion', 'Facturación interna'], ['/informes', 'Informes']]
export const NAV: Record<string, [string, string][]> = {
  gestion: STAFF,
  coordinacion: STAFF,
  responsable: [['/ordenes', 'Mis órdenes'], ['/cuenta', 'Cuenta de mi área'], ['/agenda', 'Agenda']],
  cuadrilla: [['/turnos', 'Mis turnos']],
  elenco: [['/obra', 'Mi obra']],
}
