/* Funciones de cálculo independientes de la pantalla: se pueden probar con Node. */
(function (raiz) {
  'use strict';
  const roles = { gerente: 'Gerente', asistente: 'Asistente', cajero: 'Cajero' };
  function fechaLocal(fecha = new Date()) {
    return [fecha.getFullYear(), String(fecha.getMonth() + 1).padStart(2, '0'), String(fecha.getDate()).padStart(2, '0')].join('-');
  }
  function minutos(hora) {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
  }
  function tardanza(entrada, horario, tolerancia = 0) {
    return Math.max(0, minutos(entrada) - minutos(horario) - Number(tolerancia));
  }
  function duracion(entrada, salida) {
    return salida ? minutos(salida) - minutos(entrada) : null;
  }
  function puede(rol, accion) {
    const permisos = {
      gerente: ['marcar', 'informes', 'equipo', 'ajustes', 'registro'],
      asistente: ['marcar', 'informes'],
      cajero: ['marcar']
    };
    return (permisos[rol] || []).includes(accion);
  }
  function registrosVisibles(registros, usuario) {
    return usuario.rol === 'cajero' ? registros.filter(r => r.empleadoId === usuario.id) : registros;
  }
  function filtrar(registros, filtro = {}) {
    return registros.filter(r => (!filtro.desde || r.fecha >= filtro.desde) &&
      (!filtro.hasta || r.fecha <= filtro.hasta) &&
      (!filtro.empleadoId || r.empleadoId === filtro.empleadoId) &&
      (!filtro.estado || (filtro.estado === 'tarde' ? r.tarde > 0 : r.tarde === 0)))
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.entrada.localeCompare(b.entrada));
  }
  function validarRegistro(registro, registros, hoy = fechaLocal()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(registro.fecha) || !Number.isFinite(Date.parse(registro.fecha + 'T12:00:00')) || fechaLocal(new Date(registro.fecha + 'T12:00:00')) !== registro.fecha) return 'La fecha no es válida.';
    if (registro.fecha > hoy) return 'No se pueden registrar asistencias futuras.';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(registro.entrada)) return 'Ingresá una hora de entrada válida.';
    if (registro.salida && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(registro.salida) || minutos(registro.salida) < minutos(registro.entrada))) return 'La salida debe ser igual o posterior a la entrada, en el mismo día.';
    if (registros.some(r => r.empleadoId === registro.empleadoId && r.fecha === registro.fecha && r.id !== registro.id)) return 'Esta persona ya tiene una asistencia en esa fecha.';
    return '';
  }
  function celdaCSV(valor) {
    let texto = String(valor ?? '');
    // Evita interpretar nombres u observaciones como fórmulas al abrir el CSV.
    if (/^[=+@\-\t\r\n]/.test(texto)) texto = "'" + texto;
    return '"' + texto.replace(/"/g, '""') + '"';
  }
  const api = { roles, fechaLocal, minutos, tardanza, duracion, puede, registrosVisibles, filtrar, validarRegistro, celdaCSV };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.AsistenciaLogica = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
