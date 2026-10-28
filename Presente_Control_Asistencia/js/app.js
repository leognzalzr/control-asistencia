/* Presente: interfaz, eventos y almacenamiento local. Sin librerías externas. */
'use strict';
const L = AsistenciaLogica;
const CLAVE_DATOS = 'presente_datos_v1';
const CLAVE_SESION = 'presente_sesion_v1';
const $ = selector => document.querySelector(selector);
const contenido = $('#contenido');
let datos;
let usuario = null;
let pagina = 'inicio';
let filtro = filtroInicial();
let avisoTimer;
let ultimoDia = L.fechaLocal();

function filtroInicial() {
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - 7);
  return { desde: L.fechaLocal(inicio), hasta: L.fechaLocal(), empleadoId: '', estado: '' };
}
function escapar(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function iniciales(nombre) { return nombre.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join(''); }
function horaActual() { return new Date().toTimeString().slice(0, 5); }
function fechaBonita(fecha, larga = false) {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-PY', larga ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } : { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function horasTexto(minutos) {
  return minutos === null ? 'En curso' : Math.floor(minutos / 60) + ' h ' + String(minutos % 60).padStart(2, '0') + ' min';
}
function notificar(texto, error = false) {
  const toast = $('#toast');
  toast.textContent = texto;
  toast.classList.toggle('error', error);
  toast.hidden = false;
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => { toast.hidden = true; }, 6000);
}
function cargarDatos() {
  const guardado = localStorage.getItem(CLAVE_DATOS);
  if (!guardado) {
    const iniciales = crearDatosIniciales();
    localStorage.setItem(CLAVE_DATOS, JSON.stringify(iniciales));
    return iniciales;
  }
  const leido = JSON.parse(guardado);
  if (leido.version !== 1 || !Array.isArray(leido.empleados) || !Array.isArray(leido.registros)) throw new Error('Datos no reconocidos.');
  return leido;
}
function guardarDatos() {
  localStorage.setItem(CLAVE_DATOS, JSON.stringify(datos));
}
function actualizarSesion() {
  if (!usuario) return;
  usuario = datos.empleados.find(e => e.id === usuario.id && e.activo) || null;
  if (!usuario) cerrarSesion();
}
function autorizado(accion) {
  if (!usuario || !L.puede(usuario.rol, accion)) {
    notificar('Tu rol no tiene permiso para esta acción.', true);
    return false;
  }
  return true;
}
function visibles() { return L.registrosVisibles(datos.registros, usuario); }
function miRegistroHoy() { return datos.registros.find(r => r.empleadoId === usuario.id && r.fecha === L.fechaLocal()); }
function cabecera(titulo, descripcion, acciones = '') {
  return `<div class="page-heading"><div><h1>${escapar(titulo)}</h1><p>${escapar(descripcion)}</p></div><div class="heading-actions no-print">${acciones}</div></div>`;
}
function tarjetaNumero(etiqueta, valor, nota, acento = false) {
  return `<div class="stat ${acento ? 'accent' : ''}"><span class="stat-label">${escapar(etiqueta)}</span><span class="stat-value">${escapar(valor)}</span><span class="stat-note">${escapar(nota)}</span></div>`;
}
function estadoRegistro(r) {
  return r.tarde > 0 ? `<span class="badge late">+${r.tarde} min tarde</span>` : '<span class="badge">A tiempo</span>';
}
function persona(nombre, rol) {
  return `<div class="person-cell"><span class="avatar" aria-hidden="true">${escapar(iniciales(nombre))}</span><div><strong>${escapar(nombre)}</strong><small>${escapar(L.roles[rol] || rol)}</small></div></div>`;
}
function tablaRegistros(registros, opciones = {}) {
  if (!registros.length) return '<div class="empty"><strong>Todavía no hay registros</strong>Las asistencias que coincidan con esta selección aparecerán aquí.</div>';
  const puedeEditar = opciones.editar && L.puede(usuario.rol, 'registro');
  return `<div class="table-wrap"><table><caption class="print-only">Registros ordenados por fecha, del más reciente al más antiguo</caption><thead><tr><th scope="col">Fecha</th><th scope="col">Persona</th><th scope="col">Entrada</th><th scope="col">Salida</th><th scope="col">Puntualidad</th>${opciones.detalle ? '<th scope="col">Tiempo registrado</th><th scope="col">Observación</th>' : ''}${puedeEditar ? '<th scope="col" class="no-print">Acciones</th>' : ''}</tr></thead><tbody>${registros.map(r => `<tr><td>${fechaBonita(r.fecha)}</td><td>${persona(r.nombre, r.rol)}</td><td>${escapar(r.entrada)}</td><td>${r.salida ? escapar(r.salida) : '<span class="badge neutral">En curso</span>'}</td><td>${estadoRegistro(r)}</td>${opciones.detalle ? `<td>${horasTexto(L.duracion(r.entrada, r.salida))}</td><td>${escapar(r.nota || '—')}</td>` : ''}${puedeEditar ? `<td class="no-print"><button class="button small" data-action="editar-registro" data-id="${escapar(r.id)}">Editar</button></td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}
function relojTarjeta() {
  const r = miRegistroHoy();
  const texto = !r ? 'Registrar entrada' : !r.salida ? 'Registrar salida' : 'Jornada registrada';
  return `<div class="card clock-card"><span class="eyebrow">MI JORNADA DE HOY</span><div class="clock" data-clock>--:--:--</div><p class="clock-date">${fechaBonita(L.fechaLocal(), true)}</p><div class="shift-row"><span>Hora de ingreso</span><strong>${escapar(usuario.horario)}</strong></div><div class="shift-row"><span>Tolerancia</span><strong>${datos.tolerancia} minutos</strong></div><div class="shift-row"><span>Mi entrada</span><strong>${r ? escapar(r.entrada) : 'Sin registrar'}</strong></div>${r ? `<div class="shift-row"><span>Mi salida</span><strong>${r.salida || 'Pendiente'}</strong></div><div class="status-row"><span class="muted">Puntualidad</span>${estadoRegistro(r)}</div>` : ''}<button type="button" class="button primary full" data-action="marcar" ${r?.salida ? 'disabled' : ''}>${texto}<span aria-hidden="true">↗</span></button><p class="footnote">Se utiliza la fecha y hora local del dispositivo. Una entrada y una salida por día.</p></div>`;
}
function renderInicio() {
  const hoy = L.fechaLocal();
  const registros = visibles();
  const delDia = registros.filter(r => r.fecha === hoy);
  const cajero = usuario.rol === 'cajero';
  const activos = datos.empleados.filter(e => e.activo).length;
  const presentesActivos = datos.empleados.filter(e => e.activo && delDia.some(r => r.empleadoId === e.id)).length;
  const puntuales = delDia.filter(r => r.tarde === 0).length;
  const pendientes = cajero ? (delDia.length ? 0 : 1) : activos - presentesActivos;
  contenido.innerHTML = cabecera(`Hola, ${usuario.nombre.split(' ')[0]}.`, 'Una vista clara de la jornada, para empezar mejor.', `<button class="button" data-page="${cajero ? 'marcar' : 'informes'}">${cajero ? 'Ver mi historial' : 'Ver informes'} <span aria-hidden="true">↗</span></button>`) +
    `<div class="welcome-banner"><div><span class="eyebrow">${escapar(datos.empresa.toUpperCase())} / ${cajero ? 'TU ESPACIO PERSONAL' : 'TU EQUIPO, CONECTADO'}</span><h2>Estar presente hace la diferencia.</h2><p>Registrá tu jornada y encontrá la información que necesitás, sin perder de vista a las personas.</p><button class="button primary small" data-page="marcar">Ir a mi asistencia <span aria-hidden="true">↗</span></button></div><img src="assets/equipo.svg" alt="Equipo organizando su jornada"></div>` +
    `<div class="stats">${tarjetaNumero(cajero ? 'Mis registros' : 'Equipo activo', cajero ? registros.length : activos, cajero ? 'En todo el historial' : 'Personas en la empresa')}${tarjetaNumero('Entradas hoy', delDia.length, 'Con ingreso registrado', true)}${tarjetaNumero('A tiempo hoy', puntuales, 'Dentro de la tolerancia')}${tarjetaNumero('Sin entrada hoy', pendientes, 'Pendiente de registro')}</div>` +
    `<div class="dashboard-grid"><section class="card"><div class="card-header"><div><h2>Últimos movimientos</h2><p>${cajero ? 'Tu historial reciente' : 'La actividad más reciente del equipo'}</p></div><span class="badge neutral">${registros.length} registros</span></div>${tablaRegistros(L.filtrar(registros).slice(0, 6))}</section><aside class="dashboard-side">${relojTarjeta()}<div class="mini-section"><h3>El registro, bien claro.</h3><p>Una entrada pendiente no significa una falta. Los informes muestran las asistencias registradas y sus minutos de tardanza.</p></div></aside></div>`;
}
function renderMarcar() {
  const propios = L.filtrar(datos.registros.filter(r => r.empleadoId === usuario.id));
  contenido.innerHTML = cabecera('Mi asistencia', 'Tu entrada, tu salida y el historial de tus jornadas.') +
    `<div class="checkin-layout"><div>${relojTarjeta()}<div class="mini-section"><h3>Tu horario</h3><p>El ingreso está previsto a las ${escapar(usuario.horario)}. Los minutos de tardanza se cuentan después de los ${datos.tolerancia} minutos de tolerancia.</p></div></div><section class="card"><div class="card-header"><div><h2>Mis registros</h2><p>Ordenados por fecha, del más reciente al más antiguo.</p></div><span class="badge neutral">${propios.length} jornadas</span></div>${tablaRegistros(propios)}</section></div>`;
}
function opcionesEmpleados(seleccionado = '', incluirInactivos = true) {
  return datos.empleados.filter(e => incluirInactivos || e.activo).map(e => `<option value="${escapar(e.id)}" ${e.id === seleccionado ? 'selected' : ''}>${escapar(e.nombre)}${!e.activo ? ' (inactivo)' : ''}</option>`).join('');
}
function renderInformes() {
  if (!autorizado('informes')) return;
  const registros = L.filtrar(visibles(), filtro);
  const tarde = registros.filter(r => r.tarde > 0);
  const minutosTarde = tarde.reduce((suma, r) => suma + r.tarde, 0);
  const minutosTrabajados = registros.reduce((suma, r) => suma + (L.duracion(r.entrada, r.salida) || 0), 0);
  const nombreEmpleado = datos.empleados.find(e => e.id === filtro.empleadoId)?.nombre || 'Todo el equipo';
  contenido.innerHTML = cabecera('Informes de asistencia', 'Consultá, filtrá y exportá las jornadas registradas.',
    `${L.puede(usuario.rol, 'registro') ? '<button class="button" data-action="nuevo-registro">+ Agregar registro</button>' : ''}<button class="button" data-action="imprimir" ${registros.length ? '' : 'disabled'}>Imprimir / PDF</button><button class="button primary" data-action="csv" ${registros.length ? '' : 'disabled'}>Descargar CSV ↓</button>`) +
    `<div class="stats">${tarjetaNumero('Asistencias', registros.length, 'En el período seleccionado', true)}${tarjetaNumero('A tiempo', registros.length - tarde.length, 'Dentro de la tolerancia')}${tarjetaNumero('Llegadas tardías', tarde.length, 'Fuera de la tolerancia')}${tarjetaNumero('Minutos de tardanza', minutosTarde, 'Suma del período')}</div>` +
    `<section class="card"><div class="card-header"><div><h2>Detalle por fecha</h2><p>Primero se muestran las fechas más recientes.</p></div><span class="badge neutral">${escapar(datos.empresa)}</span></div><form id="filtros-form" class="filter-bar"><div class="filter-field"><label for="desde">Desde</label><input type="date" id="desde" name="desde" value="${escapar(filtro.desde)}" required></div><div class="filter-field"><label for="hasta">Hasta</label><input type="date" id="hasta" name="hasta" value="${escapar(filtro.hasta)}" required></div><div class="filter-field"><label for="filtro-empleado">Persona</label><select id="filtro-empleado" name="empleadoId"><option value="">Todo el equipo</option>${opcionesEmpleados(filtro.empleadoId)}</select></div><div class="filter-field"><label for="filtro-estado">Puntualidad</label><select id="filtro-estado" name="estado"><option value="">Todas</option><option value="puntual" ${filtro.estado === 'puntual' ? 'selected' : ''}>A tiempo</option><option value="tarde" ${filtro.estado === 'tarde' ? 'selected' : ''}>Llegadas tardías</option></select></div><button class="button primary" type="submit">Aplicar</button><button class="button" type="button" data-action="limpiar-filtros">Restablecer</button></form><div class="report-summary">${fechaBonita(filtro.desde)} — ${fechaBonita(filtro.hasta)} · ${escapar(nombreEmpleado)} · ${escapar(filtro.estado === 'tarde' ? 'Solo tardanzas' : filtro.estado === 'puntual' ? 'Solo a tiempo' : 'Todas las asistencias')} · Tiempo total registrado: ${horasTexto(minutosTrabajados)}</div>${tablaRegistros(registros, { detalle: true, editar: true })}</section><p class="footnote">El tiempo registrado es la diferencia entre entrada y salida, sin descontar pausas. Las jornadas abiertas no suman duración. Los datos de cada registro conservan el horario y la tolerancia aplicados al crearlo.</p>`;
}
function renderEquipo() {
  if (!autorizado('equipo')) return;
  contenido.innerHTML = cabecera('Nuestro equipo', 'Personas, roles y horarios en un mismo lugar.', '<button class="button primary" data-action="nuevo-empleado">+ Agregar persona</button>') +
    `<section class="card"><div class="card-header"><div><h2>Personas de la empresa</h2><p>${datos.empleados.filter(e => e.activo).length} activas · ${datos.empleados.length} en total</p></div></div><p class="employee-note">Podés desactivar una cuenta sin eliminar su historial. Los cambios de rol y horario se aplican a los próximos registros.</p><div class="table-wrap"><table><thead><tr><th scope="col">Persona</th><th scope="col">Usuario</th><th scope="col">Ingreso</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead><tbody>${datos.empleados.map(e => `<tr><td>${persona(e.nombre, e.rol)}</td><td>${escapar(e.usuario)}</td><td>${escapar(e.horario)}</td><td><span class="badge ${e.activo ? '' : 'neutral'}">${e.activo ? 'Activo' : 'Inactivo'}</span></td><td><button class="button small" data-action="editar-empleado" data-id="${escapar(e.id)}">Editar</button></td></tr>`).join('')}</tbody></table></div></section>`;
}
function renderAjustes() {
  if (!autorizado('ajustes')) return;
  contenido.innerHTML = cabecera('Configuración', 'Definí cómo empieza cada jornada.') +
    `<div class="settings-grid"><section class="card"><div class="card-header"><div><h2>Datos generales</h2><p>Estos valores se aplican a nuevos registros.</p></div></div><form id="ajustes-form" class="settings-form"><label for="empresa">Nombre de la empresa</label><input id="empresa" name="empresa" value="${escapar(datos.empresa)}" maxlength="50" required><label for="tolerancia">Tolerancia de llegada (minutos)</label><input id="tolerancia" name="tolerancia" type="number" min="0" max="60" step="1" value="${datos.tolerancia}" required><p class="helper">Tardanza = entrada − horario − tolerancia. El mínimo es cero.</p><div class="info-note">Ejemplo: ingreso a las 08:00, tolerancia de 5 minutos y entrada a las 08:12 = <strong>7 minutos de tardanza</strong>.</div><button type="submit" class="button primary">Guardar configuración</button></form></section><section class="card"><div class="card-header"><h2>Permisos por rol</h2></div><div class="card-body"><ul class="permission-list"><li><strong>Gerente</strong>Registra su asistencia, consulta y exporta informes, administra el equipo, corrige registros y configura la empresa.</li><li><strong>Asistente</strong>Registra su asistencia y consulta, imprime o exporta los informes del equipo.</li><li><strong>Cajero</strong>Registra su asistencia y consulta únicamente su propio historial.</li></ul></div></section><section class="card"><div class="card-header"><h2>Acerca de esta versión</h2></div><div class="card-body"><p class="muted">Aplicación académica realizada con HTML, CSS y JavaScript. Incluye datos ficticios para facilitar la demostración.</p><div class="info-note">Las cuentas y los permisos son una simulación del lado del navegador. No hay autenticación segura ni sincronización entre dispositivos. Al borrar los datos del navegador, se pierde lo registrado.</div></div></section></div>`;
}
function render() {
  if (!usuario) return;
  const titulos = { inicio: 'Resumen', marcar: 'Mi asistencia', informes: 'Informes', equipo: 'Equipo', ajustes: 'Configuración' };
  if (!titulos[pagina] || (pagina !== 'inicio' && !L.puede(usuario.rol, pagina))) pagina = 'inicio';
  $('#empresa-sidebar').textContent = datos.empresa;
  $('#nombre-usuario').textContent = usuario.nombre;
  $('#rol-usuario').textContent = L.roles[usuario.rol];
  $('#avatar').textContent = iniciales(usuario.nombre);
  $('#pagina-actual').textContent = titulos[pagina];
  $('#fecha-cabecera').textContent = fechaBonita(L.fechaLocal(), true);
  document.querySelectorAll('[data-permission]').forEach(e => { e.hidden = !L.puede(usuario.rol, e.dataset.permission); });
  document.querySelectorAll('.sidebar [data-page]').forEach(e => {
    e.classList.toggle('active', e.dataset.page === pagina);
    if (e.dataset.page === pagina) e.setAttribute('aria-current', 'page'); else e.removeAttribute('aria-current');
  });
  ({ inicio: renderInicio, marcar: renderMarcar, informes: renderInformes, equipo: renderEquipo, ajustes: renderAjustes })[pagina]();
  actualizarReloj();
}
function abrirAplicacion() {
  $('#login').hidden = true;
  $('#aplicacion').hidden = false;
  render();
}
function cerrarSesion() {
  sessionStorage.removeItem(CLAVE_SESION);
  usuario = null;
  pagina = 'inicio';
  filtro = filtroInicial();
  $('#modal').close();
  $('#aplicacion').hidden = true;
  $('#login').hidden = false;
  $('#login-form').reset();
  $('#clave').type = 'password';
  $('#ver-clave').textContent = 'Ver';
  $('#ver-clave').setAttribute('aria-label', 'Mostrar contraseña');
  $('#ver-clave').setAttribute('aria-pressed', 'false');
  $('#login-error').textContent = '';
  document.querySelectorAll('[data-demo]').forEach(b => b.classList.remove('selected'));
  $('#usuario').focus();
}
function actualizarReloj() {
  document.querySelectorAll('[data-clock]').forEach(e => { e.textContent = new Date().toLocaleTimeString('es-PY', { hour12: false }); });
  if (usuario && ultimoDia !== L.fechaLocal()) {
    ultimoDia = L.fechaLocal();
    render();
  }
}
function marcarAsistencia() {
  if (!autorizado('marcar')) return;
  const fecha = L.fechaLocal();
  const hora = horaActual();
  let registro = miRegistroHoy();
  if (!registro) {
    registro = { id: 'r-' + Date.now(), empleadoId: usuario.id, nombre: usuario.nombre, rol: usuario.rol, fecha, entrada: hora, salida: '', horario: usuario.horario, tolerancia: datos.tolerancia, tarde: L.tardanza(hora, usuario.horario, datos.tolerancia), nota: '', origen: 'Marcación' };
    datos.registros.push(registro);
  } else if (!registro.salida) {
    if (L.minutos(hora) < L.minutos(registro.entrada)) throw new Error('La hora actual es anterior a la entrada. Revisá el reloj del dispositivo.');
    registro.salida = hora;
  } else {
    notificar('Tu jornada de hoy ya tiene entrada y salida.', true);
    return;
  }
  guardarDatos();
  render();
  notificar(`${registro.salida ? 'Salida' : 'Entrada'} registrada a las ${hora}.`);
}
function abrirModal(titulo, cuerpo) {
  $('#modal-content').innerHTML = `<div class="modal-header"><h2 id="modal-titulo">${escapar(titulo)}</h2><button type="button" class="close-button" data-action="cerrar-modal" aria-label="Cerrar">×</button></div>${cuerpo}`;
  $('#modal').setAttribute('aria-labelledby', 'modal-titulo');
  $('#modal').showModal();
}
function modalEmpleado(id) {
  if (!autorizado('equipo')) return;
  const empleado = datos.empleados.find(e => e.id === id);
  const e = empleado || { nombre: '', usuario: '', rol: 'cajero', horario: '08:00', activo: true };
  abrirModal(empleado ? 'Editar persona' : 'Nueva persona', `<form id="empleado-form" data-id="${escapar(id || '')}"><div class="form-grid"><div class="span-2"><label for="empleado-nombre">Nombre completo</label><input id="empleado-nombre" name="nombre" value="${escapar(e.nombre)}" maxlength="60" required></div><div><label for="empleado-usuario">Usuario</label><input id="empleado-usuario" name="usuario" value="${escapar(e.usuario)}" pattern="[a-zA-Z0-9_]{3,30}" title="De 3 a 30 letras sin acentos, números o guion bajo" maxlength="30" required></div><div><label for="empleado-clave">${empleado ? 'Nueva contraseña (opcional)' : 'Contraseña'}</label><input id="empleado-clave" name="clave" type="password" minlength="6" maxlength="50" autocomplete="new-password" ${empleado ? '' : 'required'}></div><div><label for="empleado-rol">Rol</label><select id="empleado-rol" name="rol">${Object.entries(L.roles).map(([k, v]) => `<option value="${k}" ${e.rol === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div><div><label for="empleado-horario">Horario de ingreso</label><input type="time" id="empleado-horario" name="horario" value="${escapar(e.horario)}" required></div><div class="span-2"><label for="empleado-activo">Estado de la cuenta</label><select id="empleado-activo" name="activo"><option value="si" ${e.activo ? 'selected' : ''}>Activo</option><option value="no" ${!e.activo ? 'selected' : ''}>Inactivo</option></select></div></div><p class="helper">Las cuentas nuevas pueden iniciar sesión con el usuario y la contraseña asignados. No podés desactivar tu propia cuenta ni cambiar tu propio rol.</p><p id="modal-error" class="form-error" role="alert"></p><div class="modal-actions"><button type="button" class="button" data-action="cerrar-modal">Cancelar</button><button class="button primary" type="submit">Guardar persona</button></div></form>`);
}
function modalRegistro(id) {
  if (!autorizado('registro')) return;
  const existente = datos.registros.find(r => r.id === id);
  const r = existente || { empleadoId: usuario.id, fecha: L.fechaLocal(), entrada: usuario.horario, salida: '', nota: '' };
  abrirModal(existente ? 'Editar asistencia' : 'Agregar asistencia', `<form id="registro-form" data-id="${escapar(id || '')}"><div class="form-grid"><div class="span-2"><label for="registro-persona">Persona</label><select id="registro-persona" name="empleadoId" required>${opcionesEmpleados(r.empleadoId, !!existente)}</select></div><div class="span-2"><label for="registro-fecha">Fecha</label><input id="registro-fecha" name="fecha" type="date" value="${escapar(r.fecha)}" max="${L.fechaLocal()}" required></div><div><label for="registro-entrada">Entrada</label><input id="registro-entrada" name="entrada" type="time" value="${escapar(r.entrada)}" required></div><div><label for="registro-salida">Salida (opcional)</label><input id="registro-salida" name="salida" type="time" value="${escapar(r.salida)}"></div><div class="span-2"><label for="registro-nota">Observación</label><textarea id="registro-nota" name="nota" maxlength="180" placeholder="Motivo de la carga o corrección">${escapar(r.nota)}</textarea></div></div><p class="helper">Una asistencia por persona y fecha. La salida debe ocurrir el mismo día. ${existente ? 'Se conserva el horario y la tolerancia originales si no cambiás la persona.' : 'Se aplica el horario actual de la persona y la tolerancia de la empresa.'}</p><p id="modal-error" class="form-error" role="alert"></p><div class="modal-actions"><button type="button" class="button" data-action="cerrar-modal">Cancelar</button><button class="button primary" type="submit">Guardar asistencia</button></div></form>`);
}
function guardarEmpleado(form) {
  if (!autorizado('equipo')) return;
  const campos = Object.fromEntries(new FormData(form));
  const id = form.dataset.id;
  const existente = datos.empleados.find(e => e.id === id);
  const nombreUsuario = campos.usuario.trim().toLowerCase();
  if (!campos.nombre.trim()) throw new Error('Ingresá el nombre de la persona.');
  if (datos.empleados.some(e => e.usuario === nombreUsuario && e.id !== id)) throw new Error('Ese nombre de usuario ya existe.');
  if (id === usuario.id && (campos.activo !== 'si' || campos.rol !== usuario.rol)) throw new Error('No podés desactivar tu propia cuenta ni cambiar tu propio rol.');
  const nuevo = { id: id || 'e-' + Date.now(), nombre: campos.nombre.trim(), usuario: nombreUsuario, clave: campos.clave || existente?.clave, rol: campos.rol, horario: campos.horario, activo: campos.activo === 'si' };
  if (existente) Object.assign(existente, nuevo); else datos.empleados.push(nuevo);
  guardarDatos();
  actualizarSesion();
  $('#modal').close();
  render();
  notificar('Persona guardada correctamente.');
}
function guardarRegistro(form) {
  if (!autorizado('registro')) return;
  const campos = Object.fromEntries(new FormData(form));
  const anterior = datos.registros.find(r => r.id === form.dataset.id);
  const empleado = datos.empleados.find(e => e.id === campos.empleadoId);
  if (!empleado) throw new Error('Seleccioná una persona.');
  const mismoEmpleado = anterior && anterior.empleadoId === empleado.id;
  const horario = mismoEmpleado ? anterior.horario : empleado.horario;
  const tolerancia = mismoEmpleado ? anterior.tolerancia : datos.tolerancia;
  const registro = { ...campos, id: anterior?.id || 'r-' + Date.now(), nombre: mismoEmpleado ? anterior.nombre : empleado.nombre, rol: mismoEmpleado ? anterior.rol : empleado.rol, horario, tolerancia, tarde: L.tardanza(campos.entrada, horario, tolerancia), origen: 'Carga manual' };
  const error = L.validarRegistro(registro, datos.registros);
  if (error) throw new Error(error);
  if (registro.fecha === L.fechaLocal() && (registro.entrada > horaActual() || registro.salida > horaActual())) throw new Error('No se puede registrar una hora futura del día de hoy.');
  if (anterior) Object.assign(anterior, registro); else datos.registros.push(registro);
  guardarDatos();
  $('#modal').close();
  render();
  notificar('Asistencia guardada correctamente.');
}
function descargarCSV() {
  if (!autorizado('informes')) return;
  const registros = L.filtrar(visibles(), filtro);
  if (!registros.length) return notificar('No hay registros para exportar.', true);
  const filas = [['Fecha', 'Persona', 'Rol', 'Entrada', 'Salida', 'Horario previsto', 'Tolerancia (min)', 'Tardanza (min)', 'Tiempo registrado (min)', 'Observacion']];
  registros.forEach(r => filas.push([r.fecha, r.nombre, L.roles[r.rol], r.entrada, r.salida, r.horario, r.tolerancia, r.tarde, L.duracion(r.entrada, r.salida) ?? '', r.nota]));
  const csv = '\uFEFF' + filas.map(f => f.map(L.celdaCSV).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `asistencia_${filtro.desde}_${filtro.hasta}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notificar('Informe CSV generado.');
}

/* Los eventos se centralizan para no repetir manejadores al dibujar pantallas. */
document.addEventListener('click', event => {
  const boton = event.target.closest('button');
  if (!boton || boton.disabled) return;
  if (boton.dataset.demo) {
    $('#usuario').value = boton.dataset.demo;
    $('#clave').value = '123456';
    $('#login-error').textContent = '';
    document.querySelectorAll('[data-demo]').forEach(b => b.classList.toggle('selected', b === boton));
    return;
  }
  if (boton.id === 'ver-clave') {
    const mostrar = $('#clave').type === 'password';
    $('#clave').type = mostrar ? 'text' : 'password';
    boton.textContent = mostrar ? 'Ocultar' : 'Ver';
    boton.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
    boton.setAttribute('aria-pressed', String(mostrar));
    return;
  }
  if (boton.id === 'salir') return cerrarSesion();
  if (!usuario) return;
  if (boton.dataset.page) {
    pagina = boton.dataset.page;
    render();
    contenido.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'auto' });
    return;
  }
  try {
    // Releer antes de escribir evita trabajar con una copia vieja de otra pestaña.
    datos = cargarDatos();
    actualizarSesion();
    if (!usuario) return;
    const acciones = {
      marcar: marcarAsistencia,
      'nuevo-empleado': () => modalEmpleado(),
      'editar-empleado': () => modalEmpleado(boton.dataset.id),
      'nuevo-registro': () => modalRegistro(),
      'editar-registro': () => modalRegistro(boton.dataset.id),
      'cerrar-modal': () => $('#modal').close(),
      'limpiar-filtros': () => { filtro = filtroInicial(); render(); },
      csv: descargarCSV,
      imprimir: () => { if (autorizado('informes')) window.print(); }
    };
    acciones[boton.dataset.action]?.();
  } catch (error) {
    try { datos = cargarDatos(); } catch (_) { /* Se mantiene el mensaje visible. */ }
    notificar(error.message || 'No se pudo guardar. Revisá el almacenamiento del navegador.', true);
  }
});

document.addEventListener('submit', event => {
  const form = event.target;
  event.preventDefault();
  try {
    datos = cargarDatos();
    if (form.id === 'login-form') {
      const nombre = $('#usuario').value.trim().toLowerCase();
      const cuenta = datos.empleados.find(e => e.usuario === nombre && e.clave === $('#clave').value && e.activo);
      if (!cuenta) { $('#login-error').textContent = 'Usuario o contraseña incorrectos, o cuenta inactiva.'; return; }
      sessionStorage.setItem(CLAVE_SESION, cuenta.id);
      usuario = cuenta;
      $('#login-error').textContent = '';
      abrirAplicacion();
      contenido.focus({ preventScroll: true });
      return;
    }
    actualizarSesion();
    if (!usuario) return;
    if (form.id === 'filtros-form') {
      if (!autorizado('informes')) return;
      const nuevo = Object.fromEntries(new FormData(form));
      if (nuevo.desde > nuevo.hasta) throw new Error('La fecha inicial no puede ser posterior a la final.');
      filtro = nuevo;
      render();
    } else if (form.id === 'empleado-form') guardarEmpleado(form);
    else if (form.id === 'registro-form') guardarRegistro(form);
    else if (form.id === 'ajustes-form') {
      if (!autorizado('ajustes')) return;
      const campos = Object.fromEntries(new FormData(form));
      if (!campos.empresa.trim()) throw new Error('Ingresá el nombre de la empresa.');
      datos.empresa = campos.empresa.trim();
      datos.tolerancia = Number(campos.tolerancia);
      guardarDatos();
      render();
      notificar('Configuración guardada.');
    }
  } catch (error) {
    try { datos = cargarDatos(); } catch (_) { /* No borrar datos ante un fallo. */ }
    if ($('#modal').open && $('#modal-error')) $('#modal-error').textContent = error.message;
    else if (form.id === 'login-form') $('#login-error').textContent = 'No se pudo acceder a los datos. Habilitá el almacenamiento del navegador.';
    else notificar(error.message, true);
  }
});
window.addEventListener('storage', event => {
  if (event.key !== CLAVE_DATOS || !usuario) return;
  try {
    datos = cargarDatos();
    actualizarSesion();
    if ($('#modal').open) $('#modal').close();
    render();
    notificar('Datos actualizados desde otra pestaña.');
  } catch (_) { notificar('No se pudieron leer los datos actualizados.', true); }
});

try {
  datos = cargarDatos();
  const sesion = sessionStorage.getItem(CLAVE_SESION);
  usuario = datos.empleados.find(e => e.id === sesion && e.activo) || null;
  if (usuario) abrirAplicacion();
} catch (_) {
  $('#login-error').textContent = 'No se pudo iniciar: habilitá el almacenamiento local o probá otro navegador. Los datos existentes no se han borrado.';
}
setInterval(actualizarReloj, 1000);
