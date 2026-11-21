const p = (n: number) => String(n).padStart(2, '0')
const stamp = (s: string) => { const d = new Date(s); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00` }
const esc = (t: string) => String(t || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n')

export function descargarIcs(actividades: any[], espacios: Record<number, string>, nombre = 'agenda') {
  const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Centro cultural//Agenda//ES', 'CALSCALE:GREGORIAN']
  for (const a of actividades) {
    lineas.push('BEGIN:VEVENT', `UID:actividad-${a.id}@centro-cultural`, `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(a.inicio)}`, `DTEND:${stamp(a.fin)}`, `SUMMARY:${esc(a.titulo)}`, `LOCATION:${esc(espacios[a.espacio_id] || '')}`, 'END:VEVENT')
  }
  lineas.push('END:VCALENDAR')
  const blob = new Blob([lineas.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `${nombre}.ics`; a.click()
  URL.revokeObjectURL(url)
}

export function textoWhatsApp(a: any, espacio: string) {
  const ini = new Date(a.inicio), fin = new Date(a.fin)
  const dia = ini.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  const h = (d: Date) => `${p(d.getHours())}:${p(d.getMinutes())}`
  return `${a.titulo}\n${dia}, de ${h(ini)} a ${h(fin)}\nLugar: ${espacio}`
}
