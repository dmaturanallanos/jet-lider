# Preparación semanal de pagos

## Configurar trabajadores

Equipo → Editar ficha → Modalidad de pago permite elegir Boleta de honorarios, Contrato o Sin definir. El dato vive en `worker_private_details`, protegido por las políticas privadas existentes; no se agregó a la tabla compartida `workers` ni a la función de contacto del propio trabajador. Cambiarlo utiliza la operación de ficha con control de versión y auditoría.

Las fichas existentes conservan sus datos y no reciben una clasificación automática. Debe seleccionarse antes de preparar un pago. Una solicitud de una versión anterior de la aplicación que no incluya el campo conserva su valor previo.

## Preparar el período

En escritorio, abre Pagos desde la barra lateral. En celular, Más → Pagos. Selecciona la semana y fecha de emisión de las boletas.

Los días se calculan como fechas distintas de inicio local de turnos no cancelados con marca Asistió. Dos turnos el mismo día cuentan como un día. Un nocturno corresponde al día en que empezó en America/Santiago. No asistió, sin registrar, cancelados y turnos sin asignar no generan días de honorarios. No se deducen horas extra del horario planificado: el administrador las registra manualmente.

Tarifas solicitadas por el propietario, en CLP líquidos:

| Concepto | Tarifa |
| --- | ---: |
| Día de boleta | 28.500 |
| Hora extra de boleta | 3.166 |

Las HE se guardan como minutos enteros; su monto líquido es el producto de minutos y tarifa horaria dividido por 60, redondeado al peso. Los adicionales y rebajas modifican el honorario líquido pactado y requieren una nota explicativa cuando sean distintos de cero, igual que las HE. No se incluyen anticipos, préstamos, reembolsos ni conceptos tributarios diferentes: no deben ingresarse como rebajas del honorario para compensar pagos ya realizados.

Para Contrato se ingresa el líquido manual, que ya debe contemplar sus horas extra y descuentos laborales. No se aplica la tarifa de boleta ni su retención al contrato. Los días confirmados se muestran como respaldo, sin multiplicar el sueldo por $28.500. Es una preparación de pagos, no una liquidación laboral.

## Conversión de boleta

El cálculo asume una boleta de honorarios con retención por el receptor. No suma IVA ni cotizaciones laborales al monto. Para cada trabajador se suma primero el líquido del período y luego se convierte el total de una boleta por ese período:

1. Base líquida = días confirmados × 28.500.
2. HE líquidas = redondear(minutos manuales × 3.166 / 60).
3. Líquido pactado = base + HE + adicionales − rebajas pactadas.
4. Bruto = redondear(líquido / (1 − tasa)).
5. Retención = redondear(bruto × tasa).

La conversión utiliza enteros y BigInt para evitar pérdida de precisión; se verifica que bruto menos retención sea exactamente el líquido. Un monto de cero no indica emitir una boleta por cero.

Ejemplos para 2026:

| Concepto | Líquido | Retención | Bruto de boleta |
| --- | ---: | ---: | ---: |
| Un día | 28.500 | 5.128 | 33.628 |
| Una HE, considerada sola | 3.166 | 570 | 3.736 |
| Cinco días y dos HE | 148.832 | 26.781 | 175.613 |

No se suman los brutos redondeados de cada concepto: se calcula una vez sobre el líquido total.

La tasa se determina por **fecha de emisión**, no por la semana trabajada. Fuentes primarias revisadas: [página de honorarios y simulador del SII](https://www.sii.cl/destacados/boletas_honorarios/index.html) y [ejemplos de boletas del SII](https://www.sii.cl/destacados/boletas_honorarios/ejemplos_bh.html). La página y su simulador indican 15,25 % durante 2026, la operación líquido / (1 − tasa) y redondeo a pesos. Tasas incluidas: 2025 14,5 %, 2026 15,25 %, 2027 16 % y 2028 17 %. Los años fuera de esa tabla se rechazan hasta verificar y actualizar el cálculo; no se extrapola una tasa silenciosamente.

## Revisión y exportación

Cada ficha de pago conserva por semana HE, adicionales, rebajas, líquido manual de contrato, nota, actor y versión. Guarda la preparación antes de descargar. La fecha de emisión es un parámetro visible de la descarga y queda impresa en el Excel; no se emite una boleta en el portal SII ni se solicita acceso a ese servicio.

El Excel incluye:

- Pagos: modalidad, días, tarifas, HE, importes, ajustes, líquido, tasa, retención, bruto por emitir y totales semanales. Bruto y retención total corresponden solo a boletas; el líquido total incluye a las personas de ambas modalidades.
- Asistencia base: detalle de los turnos de las personas incluidas, estado y marcas que respaldan los días.

La descarga vuelve a consultar los datos guardados mediante una instantánea consistente del servidor. No toma importes desde parámetros del navegador. Las celdas de texto no se interpretan como fórmulas. No incluye datos de contacto, RUT, cuentas bancarias ni datos de otro espacio.

Bloqueos de exportación: modalidad sin definir para una persona con actividad o preparación, contrato sin monto, neto negativo, HE de boleta arrastradas a una ficha ahora configurada como contrato, o turnos ya terminados sin una marca de asistencia. Los turnos futuros/en curso sin marca no se pagan y no bloquean el corte actual; la planilla muestra su corte de datos. Una persona sin actividad ni preparación no se incluye automáticamente. El archivo es una instantánea para revisión; regenerar un período usa la asistencia, modalidad y datos guardados actuales. No hay cierre de nómina, estado pagado, conciliación bancaria ni historial inmutable de planillas emitidas; conserva el Excel usado si necesitas ese archivo histórico.

## Migración y seguridad

[202611030014_payment_preparation.sql](../supabase/migrations/202611030014_payment_preparation.sql) agrega el campo privado, `payment_entries`, claves y restricciones por espacio, RLS, auditoría, `save_payment_entry` y `payment_week`. Actualiza `save_worker` para guardar la modalidad. Su aplicación no clasifica personas, no carga salarios y no cambia asistencias.

`save_payment_entry` exige administrador, verifica el trabajador de su espacio, bloquea la ficha y compara la versión. La tabla no concede escrituras directas a usuarios autenticados. `payment_week` usa SECURITY INVOKER, comprueba el rol y consulta únicamente su espacio. El endpoint de Excel exige sesión de administrador y responde con `Cache-Control: private, no-store`. Los trabajadores no leen modalidades, ajustes ni archivos de pago. Una ficha con preparaciones guardadas queda protegida por clave foránea contra borrado del historial financiero; puede desactivarse.

El propietario indicó haber ejecutado la migración. Se verificaron remotamente sus funciones y el rechazo de solicitudes anónimas (42501), cuatro fichas privadas todavía sin modalidad y cero registros de pago. No se asignaron modalidades ni se inventaron importes reales. El historial de CLI no se reparó desde esta sesión. Si la migración fue manual, registra únicamente su versión con `supabase migration repair 202611030014 --status applied` después de verificar resultado y proyecto enlazado.

## Verificación ejecutada

89 pruebas locales aprobadas y una integración de Supabase local omitida. Casos nuevos: ejemplo de bruto/líquido del SII, redondeo a pesos en múltiples importes/tasas, cambio de año de emisión, días locales sin duplicados, nocturnos, HE manuales, contratos, pendientes, futuros, negativos, modalidad ausente, generación y reapertura del Excel y textos que aparentan fórmulas. Pruebas SQL sobre las migraciones reales: modalidad privada, persistencia y versión, nota requerida, rechazo de HE de boleta en contratos, RLS por espacio y denegación al trabajador.

32 pruebas Playwright aprobaron en escritorio y celular, incluyendo navegación de Pagos, inputs diferenciados, demostración sin escrituras, descargas sin sesión denegadas y navegación sin desbordamiento. Tipos, lint y build de producción aprobaron. No se inició una sesión en nombre del propietario para descargar datos financieros reales ni se verificó la apertura del archivo en Microsoft Excel nativo; se validó su generación y reapertura local con ExcelJS. No se hicieron pagos, transferencias ni emisiones de boletas.
