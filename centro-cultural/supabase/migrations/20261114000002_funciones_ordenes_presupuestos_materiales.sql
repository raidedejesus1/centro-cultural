-- =====================================================================
-- Migración 2: funciones internas y rpc_* de órdenes, presupuestos y materiales
-- Cada acción valida el estado actual y es atómica: si una regla falla, no queda nada a medias.
-- Repetir una confirmación devuelve {"ya_aplicado": true} y no vuelve a cobrar, consumir ni liberar.
-- =====================================================================

-- ===== Internas (no se exponen al navegador) =====
create function _req_rol(variadic p_roles text[]) returns void language plpgsql stable security definer set search_path=public as $$
begin
  if public.my_role() is null or public.my_role()::text <> all(p_roles) then
    raise exception 'No tenés permiso para hacer esto.' using errcode='42501';
  end if;
end $$;

create function _total_aprobado(p_orden int) returns numeric language sql stable security definer set search_path=public as $$
  select coalesce((select total from presupuestos where orden_id=p_orden and estado='aprobado'),0) $$;

create function _costo_real(p_orden int) returns numeric language sql stable security definer set search_path=public as $$
  select coalesce(sum(monto),0) from costos_reales where orden_id=p_orden $$;

create function _revisar_desvio(p_orden int) returns void language plpgsql security definer set search_path=public as $$
begin
  update ordenes set estado='excedida'
   where id=p_orden and estado='en_ejecucion'
     and _costo_real(p_orden) > _total_aprobado(p_orden) * (1 + (select valor from config where clave='desvio_pct')/100);
end $$;

create function _mes_abierto() returns date language plpgsql stable security definer set search_path=public as $$
declare v_m date := date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  while exists (select 1 from cierres_mes where mes=v_m) loop v_m := (v_m + interval '1 month')::date; end loop;
  return v_m;
end $$;

-- ===== Órdenes y presupuestos =====
create function rpc_crear_orden(p_titulo text, p_tipo tipo_orden, p_area_solicitante int default null, p_elenco int default null)
returns int language plpgsql security definer set search_path=public as $$
declare v_area int; v_eje int; v_id int;
begin
  perform _req_rol('gestion','coordinacion','responsable');
  v_area := case when public.my_role()='responsable' then public.my_area() else coalesce(p_area_solicitante, public.my_area()) end;
  if v_area is null then raise exception 'Elegí qué área pide la orden.'; end if;
  if nullif(trim(coalesce(p_titulo,'')),'') is null then raise exception 'Ponele un título a la orden.'; end if;
  select area_id into v_eje from tipo_area_default where tipo=p_tipo;
  insert into ordenes(titulo,tipo,area_solicitante_id,area_ejecutora_id,elenco_id) values (trim(p_titulo),p_tipo,v_area,v_eje,p_elenco) returning id into v_id;
  return v_id;
end $$;

create function rpc_nuevo_presupuesto(p_orden int, p_lineas jsonb, p_notas text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_o ordenes; v_ver int; v_pid int; v_mat numeric; v_ext numeric; v_hor numeric; v_imp numeric; v_pct numeric;
begin
  perform _req_rol('gestion','coordinacion');
  select * into v_o from ordenes where id=p_orden for update;
  if not found then raise exception 'No encontramos esa orden.'; end if;
  if v_o.estado not in ('borrador','presupuestada','aprobada','en_ejecucion','excedida') then
    raise exception 'Esta orden ya está %: no admite presupuestos nuevos.', v_o.estado; end if;
  if p_lineas is null or jsonb_typeof(p_lineas)<>'array' or jsonb_array_length(p_lineas)=0 then
    raise exception 'Agregá al menos una línea al presupuesto.'; end if;
  update presupuestos set estado='reemplazada' where orden_id=p_orden and estado='pendiente';
  select coalesce(max(version),0)+1 into v_ver from presupuestos where orden_id=p_orden;
  insert into presupuestos(orden_id,version,notas) values (p_orden,v_ver,p_notas) returning id into v_pid;
  insert into presupuesto_lineas(presupuesto_id,categoria,descripcion,material_id,cuadrilla_id,proveedor_id,cantidad,costo_unitario)
  select v_pid, l.categoria, coalesce(l.descripcion, m.nombre, c.nombre, 'Ítem'), l.material_id, l.cuadrilla_id, l.proveedor_id, l.cantidad,
         coalesce(l.costo_unitario, m.costo, c.valor_hora, 0)
  from jsonb_to_recordset(p_lineas) as l(categoria text, descripcion text, material_id int, cuadrilla_id int, proveedor_id int, cantidad numeric, costo_unitario numeric)
  left join materiales m on m.id=l.material_id left join cuadrillas c on c.id=l.cuadrilla_id;
  select coalesce(sum(cantidad*costo_unitario) filter (where categoria='material'),0),
         coalesce(sum(cantidad*costo_unitario) filter (where categoria='externo'),0),
         coalesce(sum(cantidad*costo_unitario) filter (where categoria='horas'),0)
    into v_mat, v_ext, v_hor from presupuesto_lineas where presupuesto_id=v_pid;
  select valor into v_pct from config where clave='imprevistos_pct';
  v_imp := round((v_mat+v_ext)*v_pct/100, 2);
  update presupuestos set subtotal_materiales=v_mat, subtotal_externos=v_ext, subtotal_horas=v_hor, imprevistos=v_imp, total=v_mat+v_ext+v_hor+v_imp where id=v_pid;
  if v_o.estado in ('borrador','aprobada') then update ordenes set estado='presupuestada' where id=p_orden; end if;
  return jsonb_build_object('presupuesto_id',v_pid,'version',v_ver,'total',v_mat+v_ext+v_hor+v_imp);
end $$;

create function rpc_aprobar_presupuesto(p_presupuesto int, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_p presupuestos; v_o ordenes; v_s record; v_actual numeric; v_delta numeric; v_despues numeric; v_estado estado_orden; v_motivo text;
begin
  perform _req_rol('gestion');
  select * into v_p from presupuestos where id=p_presupuesto for update;
  if not found then raise exception 'No encontramos ese presupuesto.'; end if;
  select * into v_o from ordenes where id=v_p.orden_id for update;
  if v_p.estado='aprobado' then return jsonb_build_object('ya_aplicado',true,'orden_estado',v_o.estado); end if;
  if v_p.estado<>'pendiente' then raise exception 'Esta versión ya no está pendiente de aprobación. Actualizá la pantalla.'; end if;
  v_motivo := nullif(trim(coalesce(p_motivo,'')),'');
  select comprometido, ejecutado, presupuesto_anual into v_s from v_saldo_area where area_id=v_o.area_solicitante_id;
  v_actual := _total_aprobado(v_o.id);
  v_delta := v_p.total - case when v_o.estado in ('aprobada','en_ejecucion','excedida') then v_actual else 0 end;
  v_despues := v_s.comprometido + v_s.ejecutado + v_delta;
  if (v_s.comprometido + v_s.ejecutado >= v_s.presupuesto_anual or v_despues > v_s.presupuesto_anual) and v_motivo is null then
    raise exception 'El área ya llegó al tope de su presupuesto anual. Para aprobar escribí el motivo.'; end if;
  update presupuestos set estado='reemplazada' where orden_id=v_o.id and estado='aprobado';
  update presupuestos set estado='aprobado', aprobado_por=auth.uid(), aprobado_at=now(), motivo_aprobacion=v_motivo where id=p_presupuesto;
  v_estado := v_o.estado;
  if v_o.estado in ('borrador','presupuestada') then v_estado := 'aprobada'::estado_orden;
  elsif v_o.estado='excedida' then
    v_estado := case when _costo_real(v_o.id) > v_p.total * (1 + (select valor from config where clave='desvio_pct')/100)
                     then 'excedida'::estado_orden else 'en_ejecucion'::estado_orden end;
  end if;
  update ordenes set estado=v_estado where id=v_o.id;
  return jsonb_build_object('orden_estado',v_estado,'pct_consumido_despues', round(100*v_despues/nullif(v_s.presupuesto_anual,0),1),
    'alerta', v_despues >= v_s.presupuesto_anual*(select valor from config where clave='alerta_pct')/100);
end $$;

create function rpc_iniciar_orden(p_orden int) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_o ordenes;
begin
  perform _req_rol('gestion','coordinacion');
  select * into v_o from ordenes where id=p_orden for update;
  if not found then raise exception 'No encontramos esa orden.'; end if;
  if v_o.estado='en_ejecucion' then return jsonb_build_object('ya_aplicado',true); end if;
  if v_o.estado='presupuestada' then raise exception 'Falta aprobar la versión % del presupuesto.', (select max(version) from presupuestos where orden_id=p_orden and estado='pendiente'); end if;
  if v_o.estado<>'aprobada' then raise exception 'Una orden % no puede empezar.', v_o.estado; end if;
  update ordenes set estado='en_ejecucion' where id=p_orden;
  return jsonb_build_object('orden_estado','en_ejecucion');
end $$;

create function rpc_anular_orden(p_orden int, p_motivo text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_o ordenes;
begin
  perform _req_rol('gestion','coordinacion');
  select * into v_o from ordenes where id=p_orden for update;
  if not found then raise exception 'No encontramos esa orden.'; end if;
  if v_o.estado='anulada' then return jsonb_build_object('ya_aplicado',true); end if;
  if v_o.estado not in ('borrador','presupuestada','aprobada') then raise exception 'Una orden % ya no se puede anular.', v_o.estado; end if;
  update ordenes set estado='anulada', motivo_anulacion=nullif(trim(coalesce(p_motivo,'')),'') where id=p_orden;
  update reservas_material set estado='liberada' where orden_id=p_orden and estado='reservada';
  update turnos set estado='anulado' where orden_id=p_orden and estado='programado';
  update actividades set estado='anulada' where orden_id=p_orden and estado in ('confirmada','por_reubicar');
  update presupuestos set estado='anulado' where orden_id=p_orden and estado='pendiente';
  return jsonb_build_object('orden_estado','anulada');
end $$;

-- ===== Materiales =====
create function rpc_reservar_material(p_orden int, p_material int, p_cantidad numeric) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_o ordenes; v_m materiales; v_res numeric; v_propia numeric; v_disp numeric; v_r reservas_material;
begin
  perform _req_rol('gestion','coordinacion');
  if p_cantidad is null or p_cantidad<=0 then raise exception 'La cantidad tiene que ser mayor a cero.'; end if;
  select * into v_o from ordenes where id=p_orden for update;
  if not found then raise exception 'No encontramos esa orden.'; end if;
  if v_o.estado not in ('presupuestada','aprobada','en_ejecucion','excedida') then raise exception 'Con la orden en estado % no se reservan materiales.', v_o.estado; end if;
  select * into v_m from materiales where id=p_material for update;
  select * into v_r from reservas_material where orden_id=p_orden and material_id=p_material;
  if found and v_r.estado<>'reservada' then raise exception 'Este material ya se devolvió o consumió en esta orden.'; end if;
  select coalesce(sum(cantidad),0) into v_res from reservas_material where material_id=p_material and estado='reservada';
  v_propia := coalesce(v_r.cantidad,0);
  v_disp := v_m.fisico - v_m.fuera_de_uso - (v_res - v_propia);
  if p_cantidad > v_disp then raise exception 'Este material ya está reservado para otra orden: quedan % % libres.', v_disp, v_m.unidad; end if;
  insert into reservas_material(orden_id,material_id,cantidad) values (p_orden,p_material,p_cantidad)
    on conflict (orden_id,material_id) do update set cantidad=excluded.cantidad;
  return jsonb_build_object('reservado',p_cantidad,'disponible_restante', v_disp - p_cantidad);
end $$;

create function rpc_devolver_material(p_orden int, p_material int, p_usado numeric default 0, p_ok numeric default 0, p_danado numeric default 0, p_perdido numeric default 0)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_o ordenes; v_m materiales; v_r reservas_material; v_costo numeric := 0;
begin
  perform _req_rol('gestion','coordinacion');
  select * into v_o from ordenes where id=p_orden for update;
  if not found then raise exception 'No encontramos esa orden.'; end if;
  select * into v_m from materiales where id=p_material for update;
  select * into v_r from reservas_material where orden_id=p_orden and material_id=p_material for update;
  if not found then raise exception 'Esta orden no tiene reservado ese material.'; end if;
  if v_r.estado in ('consumida','devuelta') then return jsonb_build_object('ya_aplicado',true); end if;
  if v_r.estado<>'reservada' then raise exception 'La reserva ya fue liberada.'; end if;
  if v_o.estado not in ('en_ejecucion','excedida') then raise exception 'La devolución se registra con la orden en ejecución.'; end if;
  if least(p_usado,p_ok,p_danado,p_perdido) < 0 then raise exception 'Las cantidades no pueden ser negativas.'; end if;
  if v_m.tipo='consumible' then
    if p_usado > v_r.cantidad then raise exception 'No se puede usar más de lo reservado (%).', v_r.cantidad; end if;
    update materiales set fisico=fisico-p_usado where id=p_material;
    v_costo := round(p_usado*v_m.costo,2);
    if p_usado>0 then
      insert into movimientos_material(orden_id,material_id,tipo,cantidad,costo_cargado) values (p_orden,p_material,'consumo',p_usado,v_costo);
      insert into costos_reales(orden_id,categoria,concepto,monto,ref) values (p_orden,'consumo',v_m.nombre||' usado',v_costo,'consumo:'||p_orden||':'||p_material);
    end if;
    update reservas_material set estado='consumida' where id=v_r.id;
  else
    if p_ok+p_danado+p_perdido <> v_r.cantidad then raise exception 'Entre aptos, dañados y perdidos tienen que sumar % (lo reservado).', v_r.cantidad; end if;
    if p_ok+p_danado>0 then insert into movimientos_material(orden_id,material_id,tipo,cantidad) values (p_orden,p_material,'devolucion',p_ok+p_danado); end if;
    if p_danado>0 then
      v_costo := round(p_danado*v_m.costo*0.5,2);
      update materiales set fuera_de_uso=fuera_de_uso+p_danado where id=p_material;
      insert into movimientos_material(orden_id,material_id,tipo,cantidad,costo_cargado) values (p_orden,p_material,'danado',p_danado,v_costo);
      insert into costos_reales(orden_id,categoria,concepto,monto,ref) values (p_orden,'danado',v_m.nombre||' dañado (50 %)',v_costo,'danado:'||p_orden||':'||p_material);
    end if;
    if p_perdido>0 then
      v_costo := round(p_perdido*v_m.costo,2);
      update materiales set fisico=fisico-p_perdido where id=p_material;
      insert into movimientos_material(orden_id,material_id,tipo,cantidad,costo_cargado) values (p_orden,p_material,'perdido',p_perdido,v_costo);
      insert into costos_reales(orden_id,categoria,concepto,monto,ref) values (p_orden,'perdido',v_m.nombre||' perdido (100 %)',v_costo,'perdido:'||p_orden||':'||p_material);
    end if;
    update reservas_material set estado='devuelta' where id=v_r.id;
  end if;
  perform _revisar_desvio(p_orden);
  return jsonb_build_object('orden_estado',(select estado from ordenes where id=p_orden),'costo_real',_costo_real(p_orden));
end $$;

create function rpc_reparar_material(p_material int, p_cantidad numeric) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_m materiales;
begin
  perform _req_rol('gestion','coordinacion');
  select * into v_m from materiales where id=p_material for update;
  if p_cantidad is null or p_cantidad<=0 or p_cantidad>v_m.fuera_de_uso then raise exception 'Hay % unidades fuera de uso para reparar.', v_m.fuera_de_uso; end if;
  update materiales set fuera_de_uso=fuera_de_uso-p_cantidad where id=p_material;
  insert into movimientos_material(orden_id,material_id,tipo,cantidad)
    select coalesce((select orden_id from movimientos_material where material_id=p_material and tipo='danado' order by id desc limit 1),(select min(id) from ordenes)), p_material,'reparacion',p_cantidad;
  return jsonb_build_object('fuera_de_uso', v_m.fuera_de_uso-p_cantidad);
end $$;

create function rpc_registrar_gasto(p_orden int, p_concepto text, p_monto numeric, p_proveedor text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_o ordenes;
begin
  perform _req_rol('gestion','coordinacion');
  select * into v_o from ordenes where id=p_orden for update;
  if v_o.estado not in ('en_ejecucion','excedida') then raise exception 'Los gastos reales se cargan con la orden en ejecución.'; end if;
  if p_monto is null or p_monto<=0 then raise exception 'El monto tiene que ser mayor a cero.'; end if;
  insert into costos_reales(orden_id,categoria,concepto,monto) values (p_orden,'externo',trim(p_concepto)||coalesce(' ('||p_proveedor||')',''),p_monto);
  perform _revisar_desvio(p_orden);
  return jsonb_build_object('orden_estado',(select estado from ordenes where id=p_orden),'costo_real',_costo_real(p_orden));
end $$;
