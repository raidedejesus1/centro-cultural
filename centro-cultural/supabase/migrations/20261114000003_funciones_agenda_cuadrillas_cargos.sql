-- =====================================================================
-- Migración 3: agenda, inscripciones, cooperación, cuadrillas y partes,
-- cierre de orden, cargo interno, cierre de mes y permisos de las funciones
-- =====================================================================

-- ===== Agenda =====
create function rpc_agendar(p_espacio int, p_tipo text, p_titulo text, p_inicio timestamp, p_fin timestamp, p_orden int default null, p_cupo int default null, p_montaje_h int default null, p_desmontaje_h int default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_mon int; v_des int; v_bloque tsrange; v_c actividades; v_reub int := 0; v_id int; v_cupo int;
begin
  perform _req_rol('gestion','coordinacion');
  perform 1 from espacios where id=p_espacio for update;
  if not found then raise exception 'No encontramos ese espacio.'; end if;
  if p_fin<=p_inicio then raise exception 'El fin tiene que ser posterior al inicio.'; end if;
  if p_orden is not null and (select estado from ordenes where id=p_orden) in ('anulada','cerrada','cargada') then raise exception 'Esa orden ya no admite actividades.'; end if;
  if p_tipo in ('funcion','taller','seminario') then
    if extract(dow from p_inicio)=1 or p_inicio::date<>p_fin::date or p_inicio::time<'10:00' or p_fin::time>'23:00' then
      raise exception 'La sala abre de martes a domingo, de 10 a 23.'; end if;
  end if;
  v_mon := coalesce(p_montaje_h, case when p_tipo='funcion' then (select valor::int from config where clave='montaje_h') else 0 end);
  v_des := coalesce(p_desmontaje_h, case when p_tipo='funcion' then (select valor::int from config where clave='desmontaje_h') else 0 end);
  v_bloque := tsrange(p_inicio - make_interval(hours=>v_mon), p_fin + make_interval(hours=>v_des));
  for v_c in select * from actividades where espacio_id=p_espacio and estado='confirmada' and bloque && v_bloque loop
    if p_tipo='funcion' and v_c.tipo in ('taller','seminario') then
      update actividades set estado='por_reubicar' where id=v_c.id; v_reub := v_reub+1;
    else
      raise exception 'Choque con "%" (% a %). %', v_c.titulo, to_char(lower(v_c.bloque),'DD/MM HH24:MI'), to_char(upper(v_c.bloque),'DD/MM HH24:MI'),
        case when v_c.tipo='funcion' then 'Las funciones tienen prioridad: probá con otro espacio u horario.' else 'Probá con otro espacio u horario.' end;
    end if;
  end loop;
  v_cupo := coalesce(p_cupo, case when p_tipo in ('funcion','taller','seminario') then (select cupo from espacios where id=p_espacio) end);
  insert into actividades(orden_id,espacio_id,tipo,titulo,inicio,fin,montaje_h,desmontaje_h,cupo,cupo_disponible)
    values (p_orden,p_espacio,p_tipo,trim(p_titulo),p_inicio,p_fin,v_mon,v_des,v_cupo,v_cupo) returning id into v_id;
  return jsonb_build_object('actividad_id',v_id,'enviadas_a_reubicar',v_reub);
end $$;

create function rpc_reubicar_actividad(p_actividad int, p_espacio int, p_inicio timestamp, p_fin timestamp) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_a actividades; v_c actividades; v_bloque tsrange;
begin
  perform _req_rol('gestion','coordinacion');
  select * into v_a from actividades where id=p_actividad for update;
  if not found then raise exception 'No encontramos esa actividad.'; end if;
  if v_a.estado='anulada' then raise exception 'Esa actividad está anulada.'; end if;
  perform 1 from espacios where id=p_espacio for update;
  if v_a.tipo in ('funcion','taller','seminario') and (extract(dow from p_inicio)=1 or p_inicio::date<>p_fin::date or p_inicio::time<'10:00' or p_fin::time>'23:00') then
    raise exception 'La sala abre de martes a domingo, de 10 a 23.'; end if;
  v_bloque := tsrange(p_inicio - make_interval(hours=>v_a.montaje_h), p_fin + make_interval(hours=>v_a.desmontaje_h));
  select * into v_c from actividades where espacio_id=p_espacio and estado='confirmada' and id<>p_actividad and bloque && v_bloque limit 1;
  if found then raise exception 'Choque con "%" (% a %). Probá con otro espacio u horario.', v_c.titulo, to_char(lower(v_c.bloque),'DD/MM HH24:MI'), to_char(upper(v_c.bloque),'DD/MM HH24:MI'); end if;
  update actividades set espacio_id=p_espacio, inicio=p_inicio, fin=p_fin, estado='confirmada' where id=p_actividad;
  return jsonb_build_object('estado','confirmada');
end $$;

create function rpc_inscribir(p_actividad int, p_nombre text) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_a actividades;
begin
  perform _req_rol('gestion','coordinacion','responsable');
  select * into v_a from actividades where id=p_actividad for update;
  if not found or v_a.estado<>'confirmada' or v_a.cupo is null then raise exception 'Esa actividad no admite inscripciones.'; end if;
  if exists (select 1 from inscripciones where actividad_id=p_actividad and lower(nombre)=lower(trim(p_nombre)) and estado='confirmada') then
    return jsonb_build_object('ya_aplicado',true,'cupo_disponible',v_a.cupo_disponible); end if;
  if v_a.cupo_disponible<=0 then raise exception 'Completo: ya no quedan lugares.'; end if;
  insert into inscripciones(actividad_id,nombre) values (p_actividad,trim(p_nombre));
  update actividades set cupo_disponible=cupo_disponible-1 where id=p_actividad;
  return jsonb_build_object('cupo_disponible',v_a.cupo_disponible-1);
end $$;

create function rpc_baja_inscripcion(p_inscripcion int) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_i inscripciones;
begin
  perform _req_rol('gestion','coordinacion','responsable');
  select * into v_i from inscripciones where id=p_inscripcion for update;
  if not found then raise exception 'No encontramos esa inscripción.'; end if;
  if v_i.estado<>'confirmada' then return jsonb_build_object('ya_aplicado',true); end if;
  update inscripciones set estado='baja' where id=p_inscripcion;
  update actividades set cupo_disponible=least(cupo, cupo_disponible+1) where id=v_i.actividad_id;
  return jsonb_build_object('cupo_disponible',(select cupo_disponible from actividades where id=v_i.actividad_id));
end $$;

create function rpc_reiniciar_ciclo(p_actividad int) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  perform _req_rol('gestion','coordinacion');
  perform 1 from actividades where id=p_actividad for update;
  update inscripciones set estado='cerrada' where actividad_id=p_actividad and estado='confirmada';
  update actividades set cupo_disponible=cupo where id=p_actividad;
  return jsonb_build_object('cupo_disponible',(select cupo_disponible from actividades where id=p_actividad));
end $$;

create function rpc_registrar_cooperacion(p_actividad int, p_asistentes int, p_recaudado numeric) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_a actividades; v_o ordenes; v_pct numeric; v_el numeric; v_area int;
begin
  perform _req_rol('gestion','coordinacion');
  select * into v_a from actividades where id=p_actividad for update;
  if not found or v_a.tipo<>'funcion' then raise exception 'La cooperación se registra sobre una función.'; end if;
  if exists (select 1 from funciones_coop where actividad_id=p_actividad) then return jsonb_build_object('ya_aplicado',true); end if;
  if p_asistentes<0 or p_asistentes>coalesce(v_a.cupo,100) then raise exception 'Los asistentes no pueden pasar el cupo de la sala (%).', coalesce(v_a.cupo,100); end if;
  if p_recaudado<0 then raise exception 'El total recaudado no puede ser negativo.'; end if;
  select * into v_o from ordenes where id=v_a.orden_id;
  select coalesce((select pct_reparto from elencos where id=v_o.elenco_id),(select valor from config where clave='pct_elenco')) into v_pct;
  v_el := round(p_recaudado*v_pct/100,2);
  select id into v_area from areas where nombre='Programación artística';
  if v_area is null then raise exception 'Falta el área Programación artística.'; end if;
  insert into funciones_coop(actividad_id,asistentes,recaudado,pct_elenco,parte_elenco,parte_sala,elenco_id) values (p_actividad,p_asistentes,p_recaudado,v_pct,v_el,p_recaudado-v_el,v_o.elenco_id);
  insert into ingresos_area(area_id,concepto,monto,actividad_id) values (v_area,'Cooperación solidaria: '||v_a.titulo,p_recaudado-v_el,p_actividad);
  return jsonb_build_object('para_elenco',v_el,'para_sala',p_recaudado-v_el);
end $$;

-- ===== Cuadrillas y partes =====
create function rpc_crear_turno(p_orden int, p_integrante int, p_inicio timestamp, p_fin timestamp, p_voluntario boolean default false) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_o ordenes; v_cap numeric; v_usadas numeric; v_h numeric; v_ini timestamp; v_id int; v_nom text;
begin
  perform _req_rol('gestion','coordinacion');
  select * into v_o from ordenes where id=p_orden for update;
  if not found or v_o.estado not in ('aprobada','en_ejecucion','excedida') then raise exception 'Los turnos se arman con la orden aprobada o en ejecución.'; end if;
  if p_fin<=p_inicio or date_trunc('week',p_inicio)<>date_trunc('week',p_fin) then raise exception 'El turno tiene que terminar después de empezar y dentro de la misma semana.'; end if;
  select c.horas_semanales, i.nombre into v_cap, v_nom from integrantes i join cuadrillas c on c.id=i.cuadrilla_id where i.id=p_integrante for update of i;
  if v_cap is null then raise exception 'No encontramos a esa persona.'; end if;
  v_h := extract(epoch from (p_fin-p_inicio))/3600;
  v_ini := date_trunc('week',p_inicio);
  select coalesce(sum(horas),0) into v_usadas from turnos where integrante_id=p_integrante and estado='programado' and inicio>=v_ini and inicio<v_ini+interval '7 days';
  if v_usadas+v_h > v_cap then raise exception '% ya tiene % h esa semana y le quedan % h disponibles.', v_nom, v_usadas, greatest(v_cap-v_usadas,0); end if;
  begin
    insert into turnos(orden_id,integrante_id,inicio,fin,voluntario) values (p_orden,p_integrante,p_inicio,p_fin,p_voluntario) returning id into v_id;
  exception when exclusion_violation then
    raise exception '% ya tiene otro turno que se pisa con ese horario.', v_nom;
  end;
  return jsonb_build_object('turno_id',v_id,'horas_libres_semana',v_cap-v_usadas-v_h);
end $$;

create function rpc_anular_turno(p_turno int) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  perform _req_rol('gestion','coordinacion');
  if exists (select 1 from partes where turno_id=p_turno) then raise exception 'Ese turno ya tiene parte cargado.'; end if;
  update turnos set estado='anulado' where id=p_turno;
  return jsonb_build_object('estado','anulado');
end $$;

create function rpc_cargar_parte(p_turno int, p_horas numeric, p_nota text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_t turnos; v_est estado_orden; v_p partes;
begin
  perform _req_rol('gestion','coordinacion','cuadrilla');
  select * into v_t from turnos where id=p_turno for update;
  if not found then raise exception 'No encontramos ese turno.'; end if;
  if public.my_role()='cuadrilla' and v_t.integrante_id<>public.my_integrante() then raise exception 'Ese turno no es tuyo.' using errcode='42501'; end if;
  select * into v_p from partes where turno_id=p_turno;
  if found then return jsonb_build_object('ya_aplicado',true,'parte_id',v_p.id,'estado',v_p.estado); end if;
  select estado into v_est from ordenes where id=v_t.orden_id;
  if v_t.estado<>'programado' or v_est not in ('en_ejecucion','excedida') then raise exception 'Todavía no se pueden cargar horas en esta orden.'; end if;
  if p_horas is null or p_horas<=0 or p_horas>24 then raise exception 'Las horas tienen que estar entre 0 y 24.'; end if;
  insert into partes(turno_id,orden_id,integrante_id,horas,nota) values (p_turno,v_t.orden_id,v_t.integrante_id,p_horas,p_nota) returning * into v_p;
  return jsonb_build_object('parte_id',v_p.id,'estado','cargado');
end $$;

create function rpc_confirmar_parte(p_parte int, p_horas numeric default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_p partes; v_t turnos; v_est estado_orden; v_valor numeric; v_h numeric; v_monto numeric; v_nom text;
begin
  perform _req_rol('gestion','coordinacion');
  select * into v_p from partes where id=p_parte for update;
  if not found then raise exception 'No encontramos ese parte.'; end if;
  if v_p.estado='confirmado' then return jsonb_build_object('ya_aplicado',true); end if;
  select estado into v_est from ordenes where id=v_p.orden_id for update;
  if v_est not in ('en_ejecucion','excedida') then raise exception 'La orden no está en ejecución.'; end if;
  select * into v_t from turnos where id=v_p.turno_id;
  select c.valor_hora, i.nombre into v_valor, v_nom from integrantes i join cuadrillas c on c.id=i.cuadrilla_id where i.id=v_p.integrante_id;
  v_h := coalesce(p_horas, v_p.horas);
  if v_h<=0 then raise exception 'Las horas tienen que ser mayores a cero.'; end if;
  v_monto := case when v_t.voluntario then 0 else round(v_h*v_valor,2) end;
  update partes set estado='confirmado', horas=v_h, confirmado_por=auth.uid() where id=p_parte;
  insert into costos_reales(orden_id,categoria,concepto,monto,ref) values (v_p.orden_id,'horas', case when v_t.voluntario then 'Trabajo voluntario (aporte comunitario): ' else 'Horas de ' end || v_nom || ' (' || v_h || ' h)', v_monto, 'parte:'||p_parte);
  perform _revisar_desvio(v_p.orden_id);
  return jsonb_build_object('costo',v_monto,'voluntario',v_t.voluntario,'orden_estado',(select estado from ordenes where id=v_p.orden_id));
end $$;

-- ===== Cierre, cargo interno y mes =====
create function rpc_cerrar_orden(p_orden int) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_o ordenes; v_costo numeric; v_sin boolean; v_cargo cargos_internos; v_n int;
begin
  perform _req_rol('gestion','coordinacion');
  select * into v_o from ordenes where id=p_orden for update;
  if not found then raise exception 'No encontramos esa orden.'; end if;
  if v_o.estado in ('cerrada','cargada') then return jsonb_build_object('ya_aplicado',true); end if;
  if v_o.estado='excedida' then raise exception 'El costo real se pasó más del 10 %% de lo aprobado. Falta aprobar una versión nueva del presupuesto para poder cerrar.'; end if;
  if v_o.estado<>'en_ejecucion' then raise exception 'Solo se cierra una orden en ejecución (esta está %).', v_o.estado; end if;
  select count(*) into v_n from partes where orden_id=p_orden and estado='cargado';
  if v_n>0 then raise exception 'Quedan % partes de trabajo sin confirmar.', v_n; end if;
  select count(*) into v_n from reservas_material where orden_id=p_orden and estado='reservada';
  if v_n>0 then raise exception 'Quedan % materiales sin devolver o dar de baja.', v_n; end if;
  v_costo := _costo_real(p_orden);
  v_sin := v_o.area_ejecutora_id = v_o.area_solicitante_id;
  insert into cargos_internos(orden_id,area_origen_id,area_destino_id,monto,estado,sin_cargo,mes)
    values (p_orden,v_o.area_ejecutora_id,v_o.area_solicitante_id,v_costo, case when v_sin then 'conciliado' else 'emitido' end, v_sin, _mes_abierto()) returning * into v_cargo;
  update ordenes set estado = case when v_sin then 'cargada'::estado_orden else 'cerrada'::estado_orden end where id=p_orden;
  return jsonb_build_object('costo_real',v_costo,'cargo',v_cargo.numero,'sin_cargo',v_sin,'mes',v_cargo.mes);
end $$;

create function rpc_observar_cargo(p_cargo int, p_motivo text) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_c cargos_internos;
begin
  perform _req_rol('gestion');
  select * into v_c from cargos_internos where id=p_cargo for update;
  if not found then raise exception 'No encontramos ese cargo.'; end if;
  if v_c.estado='observado' then return jsonb_build_object('ya_aplicado',true); end if;
  if exists (select 1 from cierres_mes where mes=v_c.mes) then raise exception 'Ese mes ya está cerrado: corregí con un cargo de ajuste.'; end if;
  if v_c.estado<>'emitido' then raise exception 'Este cargo está %: no se puede observar.', v_c.estado; end if;
  if nullif(trim(coalesce(p_motivo,'')),'') is null then raise exception 'Contanos qué se observa del cargo.'; end if;
  update cargos_internos set estado='observado', motivo=trim(p_motivo) where id=p_cargo;
  return jsonb_build_object('estado','observado');
end $$;

create function rpc_conciliar_cargo(p_cargo int, p_nota text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_c cargos_internos;
begin
  perform _req_rol('gestion');
  select * into v_c from cargos_internos where id=p_cargo for update;
  if not found then raise exception 'No encontramos ese cargo.'; end if;
  if v_c.estado='conciliado' then return jsonb_build_object('ya_aplicado',true); end if;
  if v_c.estado not in ('emitido','observado') then raise exception 'Este cargo está %: no se puede conciliar.', v_c.estado; end if;
  if exists (select 1 from cierres_mes where mes=v_c.mes) then raise exception 'Ese mes ya está cerrado: corregí con un cargo de ajuste.'; end if;
  update cargos_internos set estado='conciliado', motivo=coalesce(nullif(trim(coalesce(p_nota,'')),''),motivo) where id=p_cargo;
  if not v_c.es_ajuste then update ordenes set estado='cargada' where id=v_c.orden_id and estado='cerrada'; end if;
  return jsonb_build_object('estado','conciliado');
end $$;

create function rpc_anular_cargo(p_cargo int, p_motivo text) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_c cargos_internos;
begin
  perform _req_rol('gestion');
  select * into v_c from cargos_internos where id=p_cargo for update;
  if not found then raise exception 'No encontramos ese cargo.'; end if;
  if v_c.estado='anulado' then return jsonb_build_object('ya_aplicado',true); end if;
  if exists (select 1 from cierres_mes where mes=v_c.mes) then raise exception 'Ese mes ya está cerrado: corregí con un cargo de ajuste.'; end if;
  if v_c.estado not in ('emitido','observado') then raise exception 'Un cargo conciliado no se anula: corregí con un cargo de ajuste.'; end if;
  if nullif(trim(coalesce(p_motivo,'')),'') is null then raise exception 'Escribí el motivo de la anulación.'; end if;
  update cargos_internos set estado='anulado', motivo=trim(p_motivo) where id=p_cargo;
  return jsonb_build_object('estado','anulado');
end $$;

create function rpc_cargo_ajuste(p_orden int, p_monto numeric, p_motivo text) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_o ordenes; v_c cargos_internos;
begin
  perform _req_rol('gestion');
  select * into v_o from ordenes where id=p_orden for update;
  if not found or v_o.estado not in ('cerrada','cargada') then raise exception 'Los ajustes se hacen sobre órdenes ya cerradas.'; end if;
  if p_monto is null or p_monto=0 then raise exception 'El ajuste no puede ser cero.'; end if;
  if nullif(trim(coalesce(p_motivo,'')),'') is null then raise exception 'Escribí el motivo del ajuste.'; end if;
  insert into cargos_internos(orden_id,area_origen_id,area_destino_id,monto,es_ajuste,mes,motivo)
    values (p_orden,v_o.area_ejecutora_id,v_o.area_solicitante_id,p_monto,true,_mes_abierto(),trim(p_motivo)) returning * into v_c;
  return jsonb_build_object('cargo',v_c.numero,'mes',v_c.mes);
end $$;

create function rpc_cerrar_mes(p_mes date) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_m date := date_trunc('month',p_mes)::date; v_n int;
begin
  perform _req_rol('gestion');
  perform pg_advisory_xact_lock(hashtext('cierre_mes'));
  if exists (select 1 from cierres_mes where mes=v_m) then return jsonb_build_object('ya_aplicado',true); end if;
  select count(*) into v_n from cargos_internos where mes=v_m and estado='observado';
  if v_n>0 then raise exception 'No se puede cerrar el mes: quedan % cargos observados. Resolvelos primero.', v_n; end if;
  insert into cierres_mes(mes,cerrado_por) values (v_m,auth.uid());
  return jsonb_build_object('mes_cerrado',v_m);
end $$;

-- ===== Permisos: solo rpc_* y ayudas de acceso llegan al navegador =====
do $$ declare r record; begin
 for r in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' loop
  execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  if r.proname like 'rpc\_%' or r.proname in ('my_role','my_area','my_integrante','my_elenco','is_staff','puede_ver_orden') then
   execute format('grant execute on function %s to authenticated', r.sig);
  end if;
 end loop; end $$;
