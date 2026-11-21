# Centro cultural · Órdenes de trabajo

Aplicación web para que un centro cultural independiente (sala teatral de unos 100 lugares) organice cada montaje, taller, evento, refacción o préstamo como una **orden de trabajo**: con presupuesto versionado, materiales, cuadrillas, cargo interno entre áreas e informes. Una agenda de espacios atraviesa todo.

La facturación interna es solo un registro entre áreas del propio centro: **no emite comprobantes fiscales**. Todos los datos y valores en pesos argentinos son sintéticos, de prueba.

**Stack:** React + TypeScript + Tailwind + Vite, y Supabase (PostgreSQL + Auth + RLS). Pensado para desplegar en Vercel.

---

## 1. Poner a andar en tu computadora

Necesitás Node.js 18 o más nuevo.

```bash
npm install
cp .env.example .env     # y completá la clave publishable (anon)
npm run dev
```

El archivo `.env` necesita dos variables (ver `.env.example`):

| Variable | Qué es |
|---|---|
| `VITE_SUPABASE_URL` | La URL del proyecto de Supabase |
| `VITE_SUPABASE_ANON_KEY` | La clave **publishable (anon)**: Supabase → Settings → API |

> La clave `service_role` **nunca** va en el navegador, en `.env` ni en el repositorio. Esta aplicación no la usa.

## 2. Desplegar en Vercel

1. Subí esta carpeta a un repositorio de GitHub (el `.gitignore` ya deja afuera `node_modules` y `.env`).
2. En Vercel: **Add New → Project** y elegí el repositorio. Vercel detecta **Vite** solo (comando `npm run build`, salida `dist`).
3. En **Environment Variables** cargá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. **Deploy**. El archivo `vercel.json` ya redirige todas las rutas a `index.html`, así que recargar en `/ordenes/12` funciona.

Con la CLI también sirve: `npm i -g vercel`, `vercel`, y cargar las variables con `vercel env add`.

## 3. Configuración de Supabase (una sola vez)

La base ya trae tablas, funciones, políticas y datos de prueba. Revisá además:

- **Authentication → Providers → Email:** desactivá **Allow new users to sign up**. No hay registro público: las cuentas y su rol se crean desde la base.
- Sin confirmación ni recuperación por correo: las cuentas de prueba ya están confirmadas.

## 4. Cuentas de prueba

Contraseña de todas: `Teatro2026!` (solo para desarrollo: cambiala antes de mostrar el sistema a otras personas).

| Cuenta | Rol | Qué ve |
|---|---|---|
| `gestion@centro.test` | Gestión | Todo; aprueba presupuestos, concilia, cierra el mes y configura |
| `coordinacion@centro.test` | Coordinación técnica | Órdenes, presupuestos, materiales, cuadrillas, agenda y partes |
| `programacion@centro.test` | Responsable de área (Programación artística) | Solo las órdenes y la cuenta de su área |
| `cuadrilla@centro.test` | Integrante de cuadrilla (Bruno Paz) | Sus turnos y carga de partes |
| `elenco@centro.test` | Elenco (La Marea Quieta) | Órdenes y funciones de su obra, **sin costos** |

Cada cuenta tiene **un solo rol**, guardado en la tabla `profiles`. No se puede elegir ni cambiar desde ningún formulario de la aplicación.

## 5. Recorrido de punta a punta (para validar la entrega)

1. **Gestión o Coordinación:** *Órdenes → Nueva orden* («Montaje de obra»).
2. *Presupuesto → Guardar como versión nueva* → queda **v1**, la orden pasa a *Presupuestada*.
3. **Gestión:** *Presupuestos → Aprobar* (la orden pasa a *Aprobada*; el total pasa a «comprometido» del área).
4. **Cambio del elenco:** en la orden, *Usar como base para una versión nueva*, sumá el panel y guardá → **v2**. La orden vuelve a *Presupuestada*. Gestión aprueba la v2.
5. **Agenda:** agendá el montaje de lunes a jueves en Sala principal (tipo *Montaje*). Después intentá un taller el miércoles en Sala principal: aparece el **choque**; con «Probar en Sala de Ensayo» queda resuelto.
6. *Materiales → Reservar* (madera, tachos, etc.).
7. *Resumen → Empezar la orden*.
8. *Cuadrilla → Armar turno*. La cuadrilla carga su **parte** desde el celular (*Mis turnos*). Coordinación lo **confirma**.
9. *Materiales → Devolver* un reutilizable con una unidad **dañada**: se suma el 50 % de su costo a la orden y queda fuera de uso hasta repararla.
10. *Costos → Cerrar orden*: se genera el **cargo interno** `CI-…` desde Sala y técnica hacia Programación.
11. **Gestión:** *Facturación interna → Conciliar*, y después *Cerrar mes*.
12. **Informes:** saldo por área, «¿La obra se pagó sola?», aporte comunitario y desvíos.

## 6. Modelo de versiones del presupuesto

- Cada presupuesto tiene **versiones numeradas** (v1, v2…) en `presupuestos`. Estados: `pendiente` (espera aprobación), `aprobado`, `reemplazada` (superada) y `anulado`.
- Una versión **aprobada no se toca**: un trigger de la base lo impide, y también bloquea sus líneas. Cualquier cambio crea la versión siguiente con `rpc_nuevo_presupuesto`.
- Si la orden estaba *Aprobada*, vuelve a *Presupuestada* hasta que gestión apruebe la nueva versión. Al aprobarla, la anterior pasa a `reemplazada`.
- Solo puede haber **una versión aprobada por orden** (índice único parcial).
- Todo presupuesto suma un **10 % de imprevistos sobre materiales y gastos externos**, sin aplicarlo a las horas.
- Si el costo real supera en **más** del 10 % lo aprobado, la orden pasa a *Excedida* y no se puede cerrar sin una versión nueva aprobada. Un costo exactamente 10 % mayor **no** supera el umbral.

## 7. Cómo se calculan los saldos (y por qué)

**Con una vista, no con campos actualizados.** `v_saldo_area` calcula siempre desde los datos de origen:

- **Comprometido** = total de la versión aprobada de las órdenes *Aprobadas*, *En ejecución* o *Excedidas* del área que pide.
- **Ejecutado** = suma de los cargos internos no anulados hacia el área (incluye los cargos de ajuste).
- **Saldo** = presupuesto anual − comprometido − ejecutado. Con 80 % consumido hay alerta; con 100 %, solo gestión aprueba y con motivo.
- **Ingresos** (cooperación solidaria, parte de la sala) se muestran aparte y no entran en la fórmula del saldo.

**Por qué una vista:**

1. No hay contadores que se desfasen: si se anula un cargo, se corrige con un ajuste o una orden vuelve a *Presupuestada*, el saldo se corrige solo.
2. Repetir una confirmación no puede cobrar dos veces: no hay un contador que sumar, solo estados.
3. Es fácil de auditar: el número se puede reconstruir mirando las órdenes y los cargos.

## 8. Operaciones en la base

Toda acción que afecta saldo, stock o cupo y cambia el estado se resuelve **completa en una función SQL** (`rpc_*`): valida el estado actual, rechaza sin cambios parciales si alguna regla falla y es **idempotente** (repetirla devuelve `ya_aplicado` y no vuelve a cobrar, consumir ni liberar). La interfaz muestra el conflicto en la pantalla donde se originó la acción, con un botón **Actualizar datos**.

La aplicación no hace `insert`/`update` directos, salvo la edición de catálogos por gestión.

## 9. Seguridad

- **RLS en todas las tablas.** Cambiar un identificador en la URL nunca da acceso a filas fuera del alcance del rol.
- No hay tablas ni consultas públicas: sin sesión no se lee nada.
- El elenco no ve costos: ni presupuestos, ni costos reales, ni cargos.
- Las funciones internas (`_costo_real`, etc.) no son llamables desde el navegador; solo las `rpc_*`.
- `.env.example` contiene solo nombres de variables y valores de prueba.

## 10. Estructura

```
src/
  lib/       conexión, sesión, constantes, componentes base, .ics
  pages/     Ordenes, Presupuestos, Agenda, Materiales, Cuadrillas,
             Facturacion, Informes, Personales (cuenta de área, mis turnos, mi obra)
supabase/
  migrations/              tablas, vistas, triggers, políticas RLS y funciones rpc_* (en orden)
  seed.sql                 datos sintéticos de prueba (incluye las cuentas de prueba)
  reset_datos_prueba.sql   borra los datos de prueba para volver a empezar
.env.example               variables necesarias (solo nombres y valores de prueba)
```

**Identidad visual:** rojo telón y negro de caja escénica sobre papel crudo, títulos con Bebas Neue, texto con Libre Franklin, y bloques de color por tipo de actividad (función, taller, seminario, montaje, refacción, evento, préstamo). Las pantallas de gestión son sobrias; la agenda tiene más carácter.

## 11. Interpretaciones del encargo

- Las horas semanales de cada cuadrilla se toman **por integrante**.
- «Cerrada» es la orden terminada con su cargo emitido; pasa a «Cargada» cuando ese cargo se concilia (o de entrada si el área que ejecuta es la misma que pidió).
- Cuando una orden aprobada vuelve a *Presupuestada*, su monto deja de estar comprometido hasta la nueva aprobación.
- Las funciones, talleres y seminarios respetan el horario de martes a domingo de 10 a 23; montajes y refacciones pueden ocupar otros días.

---

## 12. Base de datos: archivos SQL

Todo lo que vive en Supabase está en la carpeta `supabase/`, para poder rearmar la base desde cero:

| Archivo | Qué contiene |
|---|---|
| `migrations/20261114000001_esquema_base.sql` | Tablas, restricciones (choques de agenda, turnos superpuestos), triggers que protegen las versiones aprobadas, vistas (`v_saldo_area`, `v_costo_orden`, `v_informe_orden`, `v_materiales`, `v_horas_libres`, `v_cuadrilla_estado`), **políticas RLS** y permisos |
| `migrations/20261114000002_funciones_ordenes_presupuestos_materiales.sql` | Funciones `rpc_*` de órdenes, presupuestos, aprobación, materiales y gastos |
| `migrations/20261114000003_funciones_agenda_cuadrillas_cargos.sql` | Funciones `rpc_*` de agenda, cupos, cooperación, turnos, partes, cierre de orden, cargos internos y cierre de mes, más los permisos de ejecución |
| `seed.sql` | Datos sintéticos: catálogo, 5 cuentas de prueba, 30 órdenes y ejemplos de agenda, cooperación, turnos y partes |
| `reset_datos_prueba.sql` | Borra los datos de prueba (ver sección 14) |

**Cómo armar una base nueva** (en un proyecto de Supabase vacío): abrí **SQL Editor** y corré, en este orden, los tres archivos de `migrations/` y después `seed.sql`. Con la CLI de Supabase: `supabase db push` y después correr `seed.sql`.

## 13. Qué queda simulado

Esta aplicación es un sistema interno con datos de prueba. Para el alcance del encargo, esto **no es real**:

| Elemento | Cómo está resuelto |
|---|---|
| Avisos por **email o SMS** | No existen. Los avisos son confirmaciones en pantalla, un texto para copiar y compartir por **WhatsApp** y descargas de calendario **.ics** |
| **Pagos** | No hay pasarela ni cobros. La cooperación solidaria se **registra a mano** (asistentes y total recaudado) y se reparte según el porcentaje configurado |
| **Mapas** | No hay mapas reales. Los espacios son una lista de salas |
| **Comprobantes fiscales** | No se emiten. La facturación interna es solo un registro entre áreas del propio centro |
| **Confirmación y recuperación de cuenta por correo** | No hay. Las cuentas de prueba ya están confirmadas y no hay registro público |
| **Datos** | Sintéticos: nombres, contactos (`@…ejemplo`), proveedores genéricos («Maderera del barrio»), elencos, órdenes y valores en pesos argentinos. Del negocio real solo se toma: sala de unos 100 lugares, entrada por cooperación solidaria, talleres y los treinta años de trabajo cumplidos en 2026 |
| **Cuentas** | Las cuentas `@centro.test` y su clave son de prueba |

## 14. Reiniciar los datos de prueba

Sirve para volver al estado inicial después de probar (por ejemplo, después de hacer el recorrido de la sección 5).

1. En Supabase abrí **SQL Editor**.
2. Pegá y corré **`supabase/reset_datos_prueba.sql`**. Borra los datos de todas las tablas y las cuentas `@centro.test`, y reinicia la numeración (`OT-0001`, `CI-000001`). **No** toca tablas, vistas, funciones, políticas RLS ni la tabla `config` (porcentajes de imprevistos, desvío, alerta y reparto).
3. Pegá y corré **`supabase/seed.sql`**. Vuelve a cargar el catálogo, las cuentas de prueba, las 30 órdenes y los ejemplos.
4. Recargá la aplicación. Si seguías con la sesión abierta, volvé a ingresar.

> Cuidado: el reinicio borra **todo**, incluso datos que hayas cargado a mano. Si ya hay datos reales, no lo corras.
> `seed.sql` solo se puede correr sobre una base sin datos; si lo corrés dos veces seguidas sin reiniciar, falla por duplicados y no deja nada a medias.
