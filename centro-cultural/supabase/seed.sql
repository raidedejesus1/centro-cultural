-- =====================================================================
-- Datos sintéticos de prueba
-- Del negocio real: sala de ~100 lugares, entrada por cooperación solidaria, talleres.
-- Todo lo demás (nombres, contactos, valores en pesos argentinos) es de prueba.
-- Correr DESPUÉS de las migraciones, sobre una base sin datos.
-- Para volver a empezar, correr antes supabase/reset_datos_prueba.sql
-- =====================================================================
do $$ declare r record; begin
 for r in select sequencename from pg_sequences where schemaname='public' loop execute format('alter sequence public.%I restart', r.sequencename); end loop; end $$;

insert into areas(nombre,presupuesto_anual) values ('Programación artística',9000000),('Talleres y formación',4500000),('Sala y técnica',6000000),('Comunidad y proyectos con infancias',3000000),('Edificio y refacciones',7500000);
insert into espacios(nombre,cupo) values ('Sala principal',100),('Sala de Ensayo',15),('Galería',40),('Patio cubierto',30);
insert into tipo_area_default values ('montaje_obra',3),('taller_curso',2),('festival_evento',1),('refaccion',5),('prestamo',3);
insert into catalogo_actividades(nombre,tipo,espacio_id,cupo,horario) values
 ('Función de obra','funcion',1,100,'Viernes y sábados 20 a 22'),
 ('Taller literario','taller',3,12,'Jueves 18 a 20:30'),
 ('Taller de iluminación escénica','taller',2,10,'Sábados 10 a 13'),
 ('Seminario de dramaturgia','seminario',4,15,null);
insert into cuadrillas(nombre,valor_hora,horas_semanales) values ('Luces y sonido',9500,20),('Escenografía y carpintería',8500,24),('Sala y recepción',6500,16),('Mantenimiento del edificio',10000,18);
insert into integrantes(cuadrilla_id,nombre) values
 (1,'Luz Ferreyra'),(1,'Tomás Aguirre'),(1,'Irma Sosa'),
 (2,'Bruno Paz'),(2,'Celeste Rojas'),(2,'Dante Luna'),(2,'Eva Molina'),
 (3,'Fabiana Ríos'),(3,'Gael Pereyra'),(3,'Hilda Vega'),(3,'Iván Suárez'),
 (4,'Julián Cabrera'),(4,'Karina Benítez');
insert into proveedores(nombre) values ('Maderera del barrio'),('Pinturería La Brocha'),('Flete Rápido del Sur'),('Eléctrica Central'),('Ferretería El Tornillo');
insert into materiales(nombre,unidad,fisico,minimo,costo,tipo) values
 ('Madera de pino en tablas','tabla',40,10,12000,'consumible'),
 ('Fibrofácil en placas','placa',15,5,28000,'consumible'),
 ('Pintura látex negra','litro',30,10,7500,'consumible'),
 ('Tela arpillera','metro',50,15,5200,'consumible'),
 ('Gelatinas de color','pliego',24,8,4800,'consumible'),
 ('Tornillos','caja',20,6,6000,'consumible'),
 ('Tacho de luz PAR','unidad',18,0,85000,'reutilizable'),
 ('Elipsoidal','unidad',6,0,240000,'reutilizable'),
 ('Cable de extensión 10 metros','unidad',25,5,18000,'reutilizable'),
 ('Micrófono de ambiente','unidad',4,0,95000,'reutilizable'),
 ('Practicable de 1 por 2 metros','unidad',8,0,130000,'reutilizable'),
 ('Tarima para público','unidad',10,0,90000,'reutilizable');
insert into elencos(nombre,contacto,integrantes,obra,pct_reparto) values
 ('Compañía La Marea Quieta','contacto@lamarea.ejemplo',6,'Faros de papel',70),
 ('Grupo Tres Orillas','contacto@tresorillas.ejemplo',5,'La orilla de enfrente',70),
 ('Colectivo Teatro de Faro','contacto@teatrodefaro.ejemplo',8,'Señales',70),
 ('Títeres Malabrigo','contacto@malabrigo.ejemplo',4,'El abrigo de Malena',70),
 ('Cía. Viento en Popa','contacto@vientoenpopa.ejemplo',7,'Rumbo sur',70),
 ('Elenco del Barrio Puerto','contacto@barrioPuerto.ejemplo',9,'Historias del puerto',70);

-- ===== Cuentas de prueba (clave: Teatro2026!) =====
-- Cada cuenta tiene un solo rol, asignado desde la base en la tabla profiles.
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated','authenticated', u.email, extensions.crypt('Teatro2026!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '','','',''
from (values
 ('a0000000-0000-4000-8000-000000000001'::uuid,'gestion@centro.test'),
 ('a0000000-0000-4000-8000-000000000002'::uuid,'coordinacion@centro.test'),
 ('a0000000-0000-4000-8000-000000000003'::uuid,'programacion@centro.test'),
 ('a0000000-0000-4000-8000-000000000004'::uuid,'cuadrilla@centro.test'),
 ('a0000000-0000-4000-8000-000000000005'::uuid,'elenco@centro.test')) u(id,email);
insert into auth.identities(id,user_id,identity_data,provider,provider_id,last_sign_in_at,created_at,updated_at)
select gen_random_uuid(), id, jsonb_build_object('sub',id::text,'email',email,'email_verified',true), 'email', id::text, now(), now(), now() from auth.users where email like '%@centro.test';
insert into profiles(id,nombre,rol,area_id,integrante_id,elenco_id) values
 ('a0000000-0000-4000-8000-000000000001','Gestión (prueba)','gestion',null,null,null),
 ('a0000000-0000-4000-8000-000000000002','Coordinación técnica (prueba)','coordinacion',3,null,null),
 ('a0000000-0000-4000-8000-000000000003','Programación artística (prueba)','responsable',1,null,null),
 ('a0000000-0000-4000-8000-000000000004','Bruno Paz (prueba)','cuadrilla',null,4,null),
 ('a0000000-0000-4000-8000-000000000005','La Marea Quieta (prueba)','elenco',null,null,1);

-- ===== 30 órdenes sintéticas: al menos una de cada tipo y estado, una con versión 2 (n.º 26) y varias Excedidas =====
do $$
declare
  i int; v_tipo tipo_orden; v_est estado_orden; v_sol int; v_eje int; v_el int; v_id int; v_pid int;
  v_mat numeric; v_ext numeric; v_hor numeric; v_imp numeric; v_tot numeric; v_costo numeric; v_sin boolean; v_aprob boolean;
  tipos tipo_orden[] := array['montaje_obra','taller_curso','festival_evento','refaccion','prestamo']::tipo_orden[];
  ests estado_orden[] := array['borrador','presupuestada','aprobada','en_ejecucion','excedida','cerrada','cargada','anulada']::estado_orden[];
  nombres text[] := array['Montaje de obra','Taller o curso','Festival o evento','Refacción edilicia','Préstamo de equipamiento'];
begin
  for i in 1..30 loop
    v_tipo := tipos[(i-1)%5+1]; v_est := ests[(i-1)%8+1];
    v_sol := ((i*2)%5)+1; select area_id into v_eje from tipo_area_default where tipo=v_tipo;
    v_el := case when v_tipo='montaje_obra' then ((i/5)%6)+1 end;
    v_aprob := v_est in ('aprobada','en_ejecucion','excedida','cerrada','cargada');
    insert into ordenes(titulo,tipo,estado,area_solicitante_id,area_ejecutora_id,elenco_id,creado_por,motivo_anulacion)
      values (nombres[(i-1)%5+1]||' n.º '||i, v_tipo, v_est, v_sol, v_eje, v_el, 'a0000000-0000-4000-8000-000000000002', case when v_est='anulada' then 'Se suspendió la propuesta' end) returning id into v_id;
    v_mat := 60000 + (i%3)*12000; v_ext := i*3000; v_hor := 68000;
    v_imp := round((v_mat+v_ext)*0.10,2); v_tot := v_mat+v_ext+v_hor+v_imp;
    if v_est<>'borrador' then
      -- Se inserta pendiente y se pasa al estado final después: las versiones aprobadas no se pueden tocar.
      insert into presupuestos(orden_id,version,estado,subtotal_materiales,subtotal_externos,subtotal_horas,imprevistos,total)
      values (v_id,1,'pendiente',v_mat,v_ext,v_hor,v_imp,v_tot) returning id into v_pid;
      insert into presupuesto_lineas(presupuesto_id,categoria,descripcion,material_id,cuadrilla_id,proveedor_id,cantidad,costo_unitario) values
        (v_pid,'material','Madera de pino en tablas',1,null,null,v_mat/12000,12000),
        (v_pid,'horas','Horas de Escenografía y carpintería',null,2,null,8,8500),
        (v_pid,'externo','Transporte',null,null,3,1,v_ext);
      update presupuestos set estado = case when i=26 then 'reemplazada' when v_est='presupuestada' then 'pendiente' when v_est='anulada' then 'anulado' else 'aprobado' end,
        aprobado_por = case when v_aprob then 'a0000000-0000-4000-8000-000000000001'::uuid end,
        aprobado_at = case when v_aprob then now()-interval '30 days' end where id=v_pid;
    end if;
    if i=26 then
      insert into presupuestos(orden_id,version,estado,subtotal_materiales,subtotal_externos,subtotal_horas,imprevistos,total,notas)
      values (v_id,2,'pendiente',v_mat+28000,v_ext,v_hor+17000,round((v_mat+28000+v_ext)*0.10,2),v_mat+28000+v_ext+v_hor+17000+round((v_mat+28000+v_ext)*0.10,2),'Versión 2: aparece un panel más') returning id into v_pid;
      insert into presupuesto_lineas(presupuesto_id,categoria,descripcion,material_id,cuadrilla_id,proveedor_id,cantidad,costo_unitario) values
        (v_pid,'material','Madera de pino en tablas',1,null,null,v_mat/12000,12000),
        (v_pid,'material','Fibrofácil en placas (panel extra)',2,null,null,1,28000),
        (v_pid,'horas','Horas de Escenografía y carpintería',null,2,null,10,8500),
        (v_pid,'externo','Transporte',null,null,3,1,v_ext);
    end if;
    -- Costo real: En ejecución al 50 %, Excedida al 125 %, Cerrada/Cargada al 104 % (la n.º 6 al 110 % exacto: no supera el umbral)
    v_costo := case when v_est='en_ejecucion' then round(v_tot*0.5,2)
                    when v_est='excedida' then round(v_tot*1.25,2)
                    when v_est in ('cerrada','cargada') then case when i=6 then round(v_tot*1.10,2) else round(v_tot*1.04,2) end end;
    if v_costo is not null then
      insert into costos_reales(orden_id,categoria,concepto,monto) values (v_id,'horas','Horas confirmadas',round(v_costo*0.6,2)),(v_id,'externo','Gastos y consumos',v_costo-round(v_costo*0.6,2));
    end if;
    if v_est='en_ejecucion' then insert into reservas_material(orden_id,material_id,cantidad,estado) values (v_id,1,5,'reservada');
    elsif v_est in ('cerrada','cargada') then insert into reservas_material(orden_id,material_id,cantidad,estado) values (v_id,1,5,'consumida'); end if;
    if v_est in ('cerrada','cargada') then
      v_sin := v_eje=v_sol;
      insert into cargos_internos(orden_id,area_origen_id,area_destino_id,monto,estado,sin_cargo,mes,motivo)
      values (v_id,v_eje,v_sol,v_costo,
        case when v_sin or v_est='cargada' then 'conciliado' when i=14 then 'observado' else 'emitido' end, v_sin,
        case when i<=15 then date '2026-10-01' else date '2026-11-01' end,
        case when i=14 and not v_sin then 'Revisar el gasto de transporte' end);
    end if;
  end loop;
end $$;
insert into cierres_mes(mes,cerrado_por) values ('2026-09-01','a0000000-0000-4000-8000-000000000001');

-- ===== Agenda, cooperación, turnos y partes de ejemplo =====
insert into actividades(orden_id,espacio_id,tipo,titulo,inicio,fin,montaje_h,desmontaje_h,cupo,cupo_disponible)
select (select id from ordenes where codigo='OT-0006'),1,'funcion','Función de octubre',d,d+interval '2 hours',4,2,100,100
from (values (timestamp '2026-10-16 20:00'),(timestamp '2026-10-17 20:00')) f(d);
insert into funciones_coop(actividad_id,asistentes,recaudado,pct_elenco,parte_elenco,parte_sala,elenco_id)
select a.id, 82+(a.id%2)*9, 246000+(a.id%2)*27000, 70, round((246000+(a.id%2)*27000)*0.7,2), (246000+(a.id%2)*27000)-round((246000+(a.id%2)*27000)*0.7,2), 1 from actividades a where a.tipo='funcion';
insert into ingresos_area(area_id,concepto,monto,actividad_id) select 1,'Cooperación solidaria: '||a.titulo,f.parte_sala,a.id from funciones_coop f join actividades a on a.id=f.actividad_id;
insert into actividades(orden_id,espacio_id,tipo,titulo,inicio,fin,montaje_h,desmontaje_h,cupo,cupo_disponible) values
 (null,3,'taller','Taller literario','2026-11-19 18:00','2026-11-19 20:30',0,0,12,12),
 (null,2,'taller','Taller de iluminación escénica','2026-11-21 10:00','2026-11-21 13:00',0,0,10,10),
 (null,4,'seminario','Seminario de dramaturgia','2026-11-24 18:00','2026-11-24 20:00',0,0,15,15),
 ((select id from ordenes where codigo='OT-0011'),1,'montaje','Montaje: obra nueva','2026-11-16 10:00','2026-11-19 18:00',0,0,null,null),
 ((select id from ordenes where codigo='OT-0011'),1,'funcion','Función: obra nueva (viernes)','2026-11-20 20:00','2026-11-20 22:00',4,2,100,100),
 ((select id from ordenes where codigo='OT-0011'),1,'funcion','Función: obra nueva (sábado)','2026-11-21 20:00','2026-11-21 22:00',4,2,100,100);
insert into turnos(orden_id,integrante_id,inicio,fin,voluntario) values
 ((select id from ordenes where codigo='OT-0004'),4,'2026-11-16 10:00','2026-11-16 14:00',false),
 ((select id from ordenes where codigo='OT-0012'),5,'2026-11-16 10:00','2026-11-16 13:00',true);
insert into partes(turno_id,orden_id,integrante_id,horas,nota,estado,confirmado_por)
select t.id,t.orden_id,t.integrante_id,t.horas,'Carga de ejemplo','confirmado','a0000000-0000-4000-8000-000000000002' from turnos t;
insert into costos_reales(orden_id,categoria,concepto,monto,ref)
select t.orden_id,'horas',case when t.voluntario then 'Trabajo voluntario (aporte comunitario)' else 'Horas de Bruno Paz' end, case when t.voluntario then 0 else t.horas*8500 end,'parte:'||p.id from turnos t join partes p on p.turno_id=t.id;
