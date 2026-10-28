// Ejecutar opcionalmente: node tests/pruebas.cjs (desde la carpeta del proyecto).
const assert = require('node:assert/strict');
const test = require('node:test');
const L = require('../js/logica.js');

test('Llegar antes o exactamente dentro de la tolerancia no genera tardanza', () => {
  assert.equal(L.tardanza('07:50', '08:00', 5), 0);
  assert.equal(L.tardanza('08:00', '08:00', 5), 0);
  assert.equal(L.tardanza('08:05', '08:00', 5), 0);
});
test('La tardanza cuenta solo minutos que exceden la tolerancia', () => {
  assert.equal(L.tardanza('08:06', '08:00', 5), 1);
  assert.equal(L.tardanza('08:12', '08:00', 5), 7);
  assert.equal(L.tardanza('10:20', '08:00', 5), 135);
  assert.equal(L.tardanza('08:12', '08:00', 0), 12);
});
test('Solo las jornadas cerradas tienen duración', () => {
  assert.equal(L.duracion('08:12', '16:30'), 498);
  assert.equal(L.duracion('08:00', ''), null);
  assert.equal(L.duracion('08:00', '08:00'), 0);
});
test('La fecha local no cambia por conversiones a UTC', () => {
  assert.equal(L.fechaLocal(new Date(2026, 9, 28, 23, 59)), '2026-10-28');
});
test('El gerente puede administrar y el asistente solo consultar informes', () => {
  for (const accion of ['marcar', 'informes', 'equipo', 'ajustes', 'registro']) assert.equal(L.puede('gerente', accion), true);
  assert.equal(L.puede('asistente', 'informes'), true);
  assert.equal(L.puede('asistente', 'registro'), false);
  assert.equal(L.puede('asistente', 'equipo'), false);
});
test('El cajero y los roles desconocidos no acceden a administración', () => {
  assert.equal(L.puede('cajero', 'marcar'), true);
  assert.equal(L.puede('cajero', 'informes'), false);
  assert.equal(L.puede('cajero', 'ajustes'), false);
  assert.equal(L.puede('otro', 'marcar'), false);
});
const registros = [
  { id: '1', empleadoId: 'e1', fecha: '2026-10-26', entrada: '08:00', salida: '16:00', tarde: 0 },
  { id: '2', empleadoId: 'e2', fecha: '2026-10-27', entrada: '08:12', salida: '', tarde: 7 },
  { id: '3', empleadoId: 'e1', fecha: '2026-10-28', entrada: '08:10', salida: '', tarde: 5 }
];
test('El cajero ve únicamente sus propios registros', () => {
  assert.deepEqual(L.registrosVisibles(registros, { id: 'e1', rol: 'cajero' }).map(r => r.id), ['1', '3']);
  assert.equal(L.registrosVisibles(registros, { id: 'e1', rol: 'asistente' }).length, 3);
});
test('El filtro incluye los extremos y ordena por fecha descendente', () => {
  assert.deepEqual(L.filtrar(registros, { desde: '2026-10-26', hasta: '2026-10-27' }).map(r => r.id), ['2', '1']);
  assert.deepEqual(registros.map(r => r.id), ['1', '2', '3']);
});
test('Los filtros de persona y puntualidad se combinan', () => {
  assert.deepEqual(L.filtrar(registros, { empleadoId: 'e1', estado: 'tarde' }).map(r => r.id), ['3']);
  assert.deepEqual(L.filtrar(registros, { estado: 'puntual' }).map(r => r.id), ['1']);
  assert.equal(L.filtrar(registros, { desde: '2026-11-01' }).length, 0);
});
test('No permite dos entradas de la misma persona en el mismo día', () => {
  assert.match(L.validarRegistro({ empleadoId: 'e1', fecha: '2026-10-26', entrada: '08:10', salida: '' }, registros, '2026-10-28'), /ya tiene/);
  assert.equal(L.validarRegistro({ ...registros[0], entrada: '08:10' }, registros, '2026-10-28'), '');
});
test('Rechaza fechas futuras, fechas imposibles y horas inválidas', () => {
  for (const fecha of ['2026-10-29', '2026-02-30', 'no-es-fecha']) {
    assert.notEqual(L.validarRegistro({ empleadoId: 'e3', fecha, entrada: '08:00', salida: '' }, registros, '2026-10-28'), '');
  }
  assert.notEqual(L.validarRegistro({ empleadoId: 'e3', fecha: '2026-10-28', entrada: '25:00', salida: '' }, registros, '2026-10-28'), '');
});
test('La salida no puede ser anterior a la entrada', () => {
  assert.match(L.validarRegistro({ empleadoId: 'e3', fecha: '2026-10-28', entrada: '09:00', salida: '08:59' }, registros, '2026-10-28'), /salida/);
});
test('CSV conserva separadores, comillas y neutraliza fórmulas', () => {
  assert.equal(L.celdaCSV('Ana; "A"'), '"Ana; ""A"""');
  assert.equal(L.celdaCSV('=1+1'), '"\'=1+1"');
  assert.equal(L.celdaCSV(null), '""');
});
