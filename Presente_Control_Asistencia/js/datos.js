/* Datos ficticios: se cargan solamente al abrir la aplicación por primera vez. */
function crearDatosIniciales() {
  const L = AsistenciaLogica;
  const empleados = [
    { id: 'e1', nombre: 'Lucía Benítez', usuario: 'gerente', clave: '123456', rol: 'gerente', horario: '08:00', activo: true },
    { id: 'e2', nombre: 'Mateo Rojas', usuario: 'asistente', clave: '123456', rol: 'asistente', horario: '08:00', activo: true },
    { id: 'e3', nombre: 'Ana López', usuario: 'cajero', clave: '123456', rol: 'cajero', horario: '08:00', activo: true },
    { id: 'e4', nombre: 'Diego Vera', usuario: 'diego', clave: '123456', rol: 'cajero', horario: '09:00', activo: true },
    { id: 'e5', nombre: 'Sofía Acosta', usuario: 'sofia', clave: '123456', rol: 'asistente', horario: '08:00', activo: true },
    { id: 'e6', nombre: 'Bruno Duarte', usuario: 'bruno', clave: '123456', rol: 'cajero', horario: '09:00', activo: true }
  ];
  const registros = [];
  const ahora = new Date();
  for (let dia = 7; dia >= 1; dia--) {
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - dia);
    if (fecha.getDay() === 0 || fecha.getDay() === 6) continue;
    empleados.forEach((e, i) => {
      if ((dia + i) % 11 === 0) return;
      const diferencia = (dia + i) % 4 === 0 ? 18 + i : -3;
      const entradaMin = L.minutos(e.horario) + diferencia;
      const entrada = String(Math.floor(entradaMin / 60)).padStart(2, '0') + ':' + String(entradaMin % 60).padStart(2, '0');
      registros.push({ id: 'demo-' + dia + '-' + e.id, empleadoId: e.id, nombre: e.nombre, rol: e.rol, fecha: L.fechaLocal(fecha), entrada, salida: e.horario === '09:00' ? '17:00' : '16:00', horario: e.horario, tolerancia: 5, tarde: L.tardanza(entrada, e.horario, 5), nota: 'Registro de ejemplo', origen: 'Ejemplo' });
    });
  }
  return { version: 1, empresa: 'Nexo Comercial', tolerancia: 5, empleados, registros };
}
