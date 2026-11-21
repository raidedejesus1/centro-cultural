-- =====================================================================
-- Centro cultural · Órdenes de trabajo
-- Migración 1: tablas, ayudas de acceso, triggers de versiones, vistas, RLS y permisos
-- =====================================================================
create extension if not exists btree_gist;

create type rol_app as enum ('gestion','coordinacion','responsable','cuadrilla','elenco');
create type tipo_orden as enum ('montaje_obra','taller_curso','festival_evento','refaccion','prestamo');
create type estado_orden as enum ('borrador','presupuestada','aprobada','en_ejecucion','excedida','cerrada','cargada','anulada');

create table config(clave text primary key, valor numeric not null);
insert into config values ('imprevistos_pct',10),('desvio_pct',10),('alerta_pct',80),('pct_elenco',70),('montaje_h',4),('desmontaje_h',2);

create table areas(id serial primary key, nombre text unique not null, presupuesto_anual numeric not null check (presupuesto_anual>=0));
create table espacios(id serial primary key, nombre text unique not null, cupo int not null);
create table elencos(id serial primary key, nombre text unique not null, contacto text, integrantes int, obra text, pct_reparto numeric not null default 70 check (pct_reparto between 0 and 100));
create table cuadrillas(id serial primary key, nombre text unique not null, valor_hora numeric not null, horas_semanales numeric not null);
create table integrantes(id serial primary key, cuadrilla_id int not null references cuadrillas, nombre text not null);
create table proveedores(id serial primary key, nombre text unique not null);
create table tipo_area_default(tipo tipo_orden primary key, area_id int not null references areas);
create table catalogo_actividades(id serial primary key, nombre text not null, tipo text not null, espacio_id int references espacios, cupo int, horario text);
create table materiales(id serial primary key, nombre text unique not null, unidad text not null, fisico numeric not null check (fisico>=0), minimo numeric not null default 0, costo numeric not null check (costo>=0), tipo text not null check (tipo in ('consumible','reutilizable')), fuera_de_uso numeric not null default 0 check (fuera_de_uso>=0 and fuera_de_uso<=fisico));

create table profiles(id uuid primary key references auth.users on delete cascade, nombre text not null, rol rol_app not null, area_id int references areas, integrante_id int references integrantes, elenco_id int references elencos);

create sequence orden_seq;
create table ordenes(id serial primary key, codigo text unique not null default ('OT-'||lpad(nextval('orden_seq')::text,4,'0')), titulo text not null, tipo tipo_orden not null, estado estado_orden not null default 'borrador', area_solicitante_id int not null references areas, area_ejecutora_id int not null references areas, elenco_id int references elencos, creado_por uuid default auth.uid(), created_at timestamptz not null default now(), motivo_anulacion text);

create table presupuestos(id serial primary key, orden_id int not null references ordenes on delete cascade, version int not null, estado text not null default 'pendiente' check (estado in ('pendiente','aprobado','reemplazada','anulado')), subtotal_materiales numeric not null default 0, subtotal_externos numeric not null default 0, subtotal_horas numeric not null default 0, imprevistos numeric not null default 0, total numeric not null default 0, notas text, motivo_aprobacion text, aprobado_por uuid, aprobado_at timestamptz, created_at timestamptz not null default now(), unique(orden_id, version));
create unique index un_aprobado_por_orden on presupuestos(orden_id) where estado='aprobado';
create table presupuesto_lineas(id serial primary key, presupuesto_id int not null references presupuestos on delete cascade, categoria text not null check (categoria in ('material','horas','externo')), descripcion text not null, material_id int references materiales, cuadrilla_id int references cuadrillas, proveedor_id int references proveedores, cantidad numeric not null check (cantidad>0), costo_unitario numeric not null check (costo_unitario>=0));

create table reservas_material(id serial primary key, orden_id int not null references ordenes, material_id int not null references materiales, cantidad numeric not null check (cantidad>0), estado text not null default 'reservada' check (estado in ('reservada','consumida','devuelta','liberada')), created_at timestamptz not null default now(), unique(orden_id, material_id));
create table movimientos_material(id serial primary key, orden_id int not null references ordenes, material_id int not null references materiales, tipo text not null check (tipo in ('consumo','devolucion','danado','perdido','reparacion')), cantidad numeric not null, costo_cargado numeric not null default 0, usuario uuid default auth.uid(), created_at timestamptz not null default now());

create table actividades(id serial primary key, orden_id int references ordenes on delete set null, espacio_id int not null references espacios,
  tipo text not null check (tipo in ('funcion','taller','seminario','montaje','refaccion','evento','prestamo')),
  titulo text not null, inicio timestamp not null, fin timestamp not null, montaje_h int not null default 0, desmontaje_h int not null default 0,
  estado text not null default 'confirmada' check (estado in ('confirmada','por_reubicar','anulada')),
  cupo int, cupo_disponible int,
  bloque tsrange generated always as (tsrange(inicio - make_interval(hours => montaje_h), fin + make_interval(hours => desmontaje_h))) stored,
  check (fin>inicio),
  constraint sin_choque exclude using gist (espacio_id with =, bloque with &&) where (estado='confirmada'));
create table inscripciones(id serial primary key, actividad_id int not null references actividades, nombre text not null, estado text not null default 'confirmada' check (estado in ('confirmada','baja','cerrada')), created_at timestamptz not null default now());

create table turnos(id serial primary key, orden_id int not null references ordenes, integrante_id int not null references integrantes, inicio timestamp not null, fin timestamp not null, voluntario boolean not null default false,
  estado text not null default 'programado' check (estado in ('programado','anulado')),
  horas numeric generated always as (extract(epoch from (fin-inicio))/3600) stored,
  rango tsrange generated always as (tsrange(inicio,fin)) stored,
  check (fin>inicio),
  constraint sin_superposicion exclude using gist (integrante_id with =, rango with &&) where (estado<>'anulado'));
create table partes(id serial primary key, turno_id int not null unique references turnos, orden_id int not null references ordenes, integrante_id int not null references integrantes, horas numeric not null check (horas>0), nota text, estado text not null default 'cargado' check (estado in ('cargado','confirmado')), confirmado_por uuid, created_at timestamptz not null default now());
create table costos_reales(id serial primary key, orden_id int not null references ordenes, categoria text not null check (categoria in ('horas','consumo','danado','perdido','externo')), concepto text not null, monto numeric not null, ref text unique, created_at timestamptz not null default now());

create sequence ci_seq;
create table cargos_internos(id serial primary key, numero text unique not null default ('CI-'||lpad(nextval('ci_seq')::text,6,'0')), orden_id int not null references ordenes, area_origen_id int not null references areas, area_destino_id int not null references areas, monto numeric not null, estado text not null default 'emitido' check (estado in ('emitido','observado','conciliado','anulado')), es_ajuste boolean not null default false, sin_cargo boolean not null default false, mes date not null, motivo text, created_at timestamptz not null default now());
create unique index un_cargo_por_orden on cargos_internos(orden_id) where not es_ajuste;
create table cierres_mes(mes date primary key, cerrado_por uuid, cerrado_at timestamptz not null default now());
create table funciones_coop(id serial primary key, actividad_id int not null unique references actividades, asistentes int not null check (asistentes>=0), recaudado numeric not null check (recaudado>=0), pct_elenco numeric not null, parte_elenco numeric not null, parte_sala numeric not null, elenco_id int references elencos, created_at timestamptz not null default now());
create table ingresos_area(id serial primary key, area_id int not null references areas, concepto text not null, monto numeric not null, actividad_id int unique references actividades, created_at timestamptz not null default now());

-- ===== Ayudas de acceso =====
create function public.my_role() returns rol_app language sql stable security definer set search_path=public as $$ select rol from public.profiles where id=auth.uid() $$;
create function public.my_area() returns int language sql stable security definer set search_path=public as $$ select area_id from public.profiles where id=auth.uid() $$;
create function public.my_integrante() returns int language sql stable security definer set search_path=public as $$ select integrante_id from public.profiles where id=auth.uid() $$;
create function public.my_elenco() returns int language sql stable security definer set search_path=public as $$ select elenco_id from public.profiles where id=auth.uid() $$;
create function public.is_staff() returns boolean language sql stable security definer set search_path=public as $$ select coalesce(public.my_role() in ('gestion','coordinacion'), false) $$;
create function public.puede_ver_orden(p_orden int) returns boolean language sql stable security definer set search_path=public as $$
 select case public.my_role()
  when 'gestion' then true
  when 'coordinacion' then true
  when 'responsable' then exists(select 1 from public.ordenes o where o.id=p_orden and public.my_area() in (o.area_solicitante_id,o.area_ejecutora_id))
  when 'cuadrilla' then exists(select 1 from public.turnos t where t.orden_id=p_orden and t.integrante_id=public.my_integrante())
  when 'elenco' then exists(select 1 from public.ordenes o where o.id=p_orden and o.elenco_id=public.my_elenco())
  else false end $$;

-- ===== Versiones: lo aprobado no se toca =====
create function trg_presupuesto_inmutable() returns trigger language plpgsql as $$
begin
  if tg_op='DELETE' then
    if old.estado in ('aprobado','reemplazada') then raise exception 'Una versión aprobada no se borra: creá una versión nueva.'; end if;
    return old;
  end if;
  if old.estado='aprobado' and not (new.estado in ('aprobado','reemplazada') and new.total=old.total and new.version=old.version and new.orden_id=old.orden_id) then
    raise exception 'Una versión aprobada no se toca: creá una versión nueva.';
  end if;
  return new;
end $$;
create trigger presupuesto_inmutable before update or delete on presupuestos for each row execute function trg_presupuesto_inmutable();
create function trg_lineas_inmutables() returns trigger language plpgsql as $$
declare v_pid int; v_est text;
begin
  v_pid := case when tg_op='INSERT' then new.presupuesto_id else old.presupuesto_id end;
  select estado into v_est from presupuestos where id=v_pid;
  if v_est in ('aprobado','reemplazada') then raise exception 'Las líneas de una versión aprobada no se tocan: creá una versión nueva.'; end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
create trigger lineas_inmutables before insert or update or delete on presupuesto_lineas for each row execute function trg_lineas_inmutables();

-- ===== Vistas =====
create view v_saldo_area with (security_invoker=true) as
select t.*, t.presupuesto_anual - t.comprometido - t.ejecutado as saldo,
  round(100*(t.comprometido+t.ejecutado)/nullif(t.presupuesto_anual,0),1) as pct_consumido,
  case when (t.comprometido+t.ejecutado) >= t.presupuesto_anual then 'tope'
       when (t.comprometido+t.ejecutado) >= t.presupuesto_anual*0.8 then 'alerta' else 'ok' end as nivel
from (select a.id as area_id, a.nombre, a.presupuesto_anual,
  coalesce((select sum(p.total) from ordenes o join presupuestos p on p.orden_id=o.id and p.estado='aprobado' where o.area_solicitante_id=a.id and o.estado in ('aprobada','en_ejecucion','excedida')),0) as comprometido,
  coalesce((select sum(c.monto) from cargos_internos c where c.area_destino_id=a.id and c.estado<>'anulado'),0) as ejecutado,
  coalesce((select sum(i.monto) from ingresos_area i where i.area_id=a.id),0) as ingresos
 from areas a) t;

create view v_costo_orden with (security_invoker=true) as
select o.id as orden_id, o.codigo, o.titulo, o.estado, o.area_solicitante_id,
  (select p.total from presupuestos p where p.orden_id=o.id and p.estado='aprobado') as aprobado,
  coalesce((select sum(c.monto) from costos_reales c where c.orden_id=o.id),0) as costo_real,
  coalesce((select sum(pa.horas) from partes pa join turnos t on t.id=pa.turno_id where pa.orden_id=o.id and pa.estado='confirmado' and t.voluntario),0) as horas_voluntarias
from ordenes o where public.my_role() in ('gestion','coordinacion','responsable');

create view v_informe_orden with (security_invoker=true) as
select v.*, coalesce((select sum(f.parte_sala) from funciones_coop f join actividades a on a.id=f.actividad_id where a.orden_id=v.orden_id),0) as ingreso_sala,
  coalesce((select sum(f.parte_sala) from funciones_coop f join actividades a on a.id=f.actividad_id where a.orden_id=v.orden_id),0) - v.costo_real as resultado
from v_costo_orden v;

create view v_materiales as
select t.*, t.fisico - t.fuera_de_uso - t.reservado as disponible, (t.fisico - t.fuera_de_uso - t.reservado) < t.minimo as bajo_minimo
from (select m.*, coalesce((select sum(r.cantidad) from reservas_material r where r.material_id=m.id and r.estado='reservada'),0) as reservado from materiales m) t
where public.my_role() in ('gestion','coordinacion','responsable');

create view v_horas_libres as
select i.id as integrante_id, i.nombre, i.cuadrilla_id, c.horas_semanales,
  coalesce(sum(t.horas) filter (where t.estado='programado' and t.inicio >= date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires') and t.inicio < date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires') + interval '7 days'),0) as horas_usadas,
  c.horas_semanales - coalesce(sum(t.horas) filter (where t.estado='programado' and t.inicio >= date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires') and t.inicio < date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires') + interval '7 days'),0) as horas_libres
from integrantes i join cuadrillas c on c.id=i.cuadrilla_id left join turnos t on t.integrante_id=i.id
where public.is_staff() or i.id=public.my_integrante()
group by i.id, i.nombre, i.cuadrilla_id, c.horas_semanales;

create view v_cuadrilla_estado as
select c.id as cuadrilla_id, c.nombre, c.valor_hora, c.horas_semanales, count(h.integrante_id) as integrantes, coalesce(sum(h.horas_libres),0) as horas_libres,
  case when coalesce(sum(h.horas_libres),0)<=0 then 'Sin horas' else 'Con horas' end as estado
from cuadrillas c left join v_horas_libres h on h.cuadrilla_id=c.id
where public.is_staff() group by c.id;

-- ===== RLS =====
do $$ declare r record; begin
 for r in select tablename from pg_tables where schemaname='public' loop
  execute format('alter table public.%I enable row level security', r.tablename);
 end loop; end $$;

create policy sel on config for select to authenticated using (true);
create policy sel on tipo_area_default for select to authenticated using (true);
create policy sel on espacios for select to authenticated using (true);
create policy sel on catalogo_actividades for select to authenticated using (true);
create policy sel on areas for select to authenticated using (public.is_staff() or id=public.my_area());
create policy sel on elencos for select to authenticated using (public.is_staff() or id=public.my_elenco());
create policy sel on cuadrillas for select to authenticated using (public.is_staff());
create policy sel on integrantes for select to authenticated using (public.is_staff() or id=public.my_integrante());
create policy sel on proveedores for select to authenticated using (public.is_staff());
create policy sel on materiales for select to authenticated using (public.my_role() in ('gestion','coordinacion','responsable'));
create policy sel on profiles for select to authenticated using (id=auth.uid() or public.is_staff());
create policy sel on ordenes for select to authenticated using (public.puede_ver_orden(id));
create policy sel on presupuestos for select to authenticated using (public.is_staff() or (public.my_role()='responsable' and public.puede_ver_orden(orden_id)));
create policy sel on presupuesto_lineas for select to authenticated using (exists (select 1 from presupuestos p where p.id=presupuesto_id));
create policy sel on reservas_material for select to authenticated using (public.is_staff() or (public.my_role()='responsable' and public.puede_ver_orden(orden_id)));
create policy sel on movimientos_material for select to authenticated using (public.is_staff() or (public.my_role()='responsable' and public.puede_ver_orden(orden_id)));
create policy sel on costos_reales for select to authenticated using (public.is_staff() or (public.my_role()='responsable' and public.puede_ver_orden(orden_id)));
create policy sel on actividades for select to authenticated using (public.my_role() in ('gestion','coordinacion','responsable','cuadrilla') or (public.my_role()='elenco' and public.puede_ver_orden(orden_id)));
create policy sel on inscripciones for select to authenticated using (public.my_role() in ('gestion','coordinacion','responsable'));
create policy sel on turnos for select to authenticated using (public.is_staff() or integrante_id=public.my_integrante());
create policy sel on partes for select to authenticated using (public.is_staff() or integrante_id=public.my_integrante());
create policy sel on cargos_internos for select to authenticated using (public.is_staff() or (public.my_role()='responsable' and public.my_area() in (area_origen_id, area_destino_id)));
create policy sel on cierres_mes for select to authenticated using (public.my_role() in ('gestion','coordinacion'));
create policy sel on funciones_coop for select to authenticated using (public.is_staff() or (public.my_role()='responsable' and exists (select 1 from actividades a where a.id=actividad_id and public.puede_ver_orden(a.orden_id))));
create policy sel on ingresos_area for select to authenticated using (public.is_staff() or (public.my_role()='responsable' and area_id=public.my_area()));

-- Solo gestión edita catálogos y configuración
do $$ declare t text; begin
 foreach t in array array['config','areas','espacios','elencos','cuadrillas','integrantes','proveedores','tipo_area_default','catalogo_actividades','materiales'] loop
  execute format('create policy gestion_escribe on public.%I for all to authenticated using (public.my_role()=''gestion'') with check (public.my_role()=''gestion'')', t);
 end loop; end $$;

-- ===== Permisos =====
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update, delete on config, areas, espacios, elencos, cuadrillas, integrantes, proveedores, tipo_area_default, catalogo_actividades, materiales to authenticated;
grant usage on sequence areas_id_seq, espacios_id_seq, elencos_id_seq, cuadrillas_id_seq, integrantes_id_seq, proveedores_id_seq, catalogo_actividades_id_seq, materiales_id_seq to authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function public.my_role(), public.my_area(), public.my_integrante(), public.my_elenco(), public.is_staff(), public.puede_ver_orden(int) to authenticated;
