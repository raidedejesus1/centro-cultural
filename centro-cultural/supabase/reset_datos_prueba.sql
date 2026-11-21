-- =====================================================================
-- Reiniciar los datos de prueba
-- Borra TODOS los datos de las tablas (catálogo, órdenes, cargos, agenda…) y las cuentas
-- de prueba @centro.test, y reinicia la numeración (OT-0001, CI-000001, ids).
-- NO toca: tablas, vistas, funciones, políticas RLS ni la tabla config (parámetros).
-- Después correr supabase/seed.sql para volver a cargar los datos de prueba.
-- ¡Cuidado!: si ya cargaste datos reales, también se borran.
-- =====================================================================
truncate table
  ingresos_area, funciones_coop, cierres_mes, cargos_internos, costos_reales, partes, turnos,
  inscripciones, actividades, movimientos_material, reservas_material, presupuesto_lineas,
  presupuestos, ordenes, profiles, catalogo_actividades, tipo_area_default, materiales,
  proveedores, integrantes, cuadrillas, elencos, espacios, areas
  restart identity cascade;

alter sequence orden_seq restart;
alter sequence ci_seq restart;

delete from auth.users where email like '%@centro.test';
