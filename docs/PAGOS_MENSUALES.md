# Boletas semanales, contratos mensuales y gasto

## Períodos separados

Pagos contiene dos pestañas. Boletas semanal mantiene la tarifa de $28.500 líquidos por día confirmado y $3.166 líquidos por hora extra manual, la conversión a bruto y la retención según emisión. Contratos mensual utiliza un sueldo líquido informado por persona y mes, que debe incluir sus HE y descuentos laborales.

No se multiplica el sueldo por cuatro semanas ni se convierten automáticamente los borradores semanales anteriores de contratos: su significado puede ser diferente. Esos registros se conservan en `payment_entries` y la interfaz avisa si existen. La nueva función de guardado semanal solo admite Boleta; los contratos se registran en `contract_monthly_payments`. Los Excel semanales excluyen contratos.

## Anticipo fijo de contrato

El propietario estableció **$200.000 líquidos por trabajador al mes**. Se guarda en cada registro mensual y la base impide modificarlo a otro valor mediante el navegador o una escritura directa. La clave única por espacio, trabajador y primer día del mes evita duplicarlo por semana.

Sueldo mensual = anticipo + saldo. Para un sueldo de $800.000, el anticipo es $200.000 y el saldo $600.000. El gasto líquido sigue siendo $800.000, nunca $1.000.000. Los totales suman cada sueldo una vez.

Los montos son planificados: no se registran transferencias realizadas ni se supone que un anticipo ya fue pagado. No hay integración bancaria ni liquidación de sueldo. El total de contratos representa líquidos informados; no es el costo laboral completo con cotizaciones o cargos del empleador.

Un sueldo menor que el anticipo fijo se rechaza, en vez de producir saldo negativo o reducir el anticipo silenciosamente. Jornadas parciales, ingresos/salidas del mes o excepciones al anticipo deben revisarse antes de ingresar el monto; no se calculan prorrateos automáticos. El período usa fechas de calendario, no bloques de 30 días ni semanas aproximadas.

## Horas extra simplificadas

La preparación de una boleta muestra un solo campo. Acepta decimales con coma o punto (`1,5`, `1.5`) y duración (`1:30`). Los botones +30 min, +1 h y +2 h permiten sumar sin hacer conversiones; Quitar HE vuelve a cero. La vista previa muestra duración y adicional líquido calculado. Se conserva el límite de 168 horas semanales y el guardado en minutos enteros, con redondeo al minuto más cercano.

No se infieren HE del horario programado. Si solo se agregan HE y no hay adicionales o rebajas, una nota descriptiva puede generarse desde la duración que el administrador ingresó; no afirma una autorización ni asistencia que no se haya registrado. Otros ajustes requieren explicación escrita.

## Totales y Excel

Boletas semanal muestra gasto bruto (líquido más retención), líquido a personas y retención. La retención ya pertenece al bruto; no se suma otra vez. Si hay personas pendientes, se muestra explícitamente un subtotal revisado y se bloquea la exportación completa hasta corregirlas.

Contratos mensual muestra sueldos líquidos, anticipos incluidos y saldo. Si faltan sueldos, se indica el número pendiente y los importes de los registros revisados; la descarga permanece deshabilitada y el servidor rechaza una solicitud directa incompleta. El Excel contiene persona, mes, sueldo, anticipo, saldo, notas y un total mensual que satisface sueldo = anticipo + saldo.

Los dos períodos no se suman entre sí: una semana de honorarios y un mes de contratos son intervalos distintos. No se presenta esa suma como un gasto mensual consolidado. Todos los totales corresponden únicamente al espacio de la sesión. El Excel es una instantánea de preparación y no modifica saldos bancarios ni estados de pago.

Los registros mensuales existentes se siguen mostrando si se desactiva una ficha. Una ficha nueva con ingreso posterior al mes seleccionado no se incluye automáticamente, salvo que ya tenga un registro guardado para ese mes. Los cambios de modalidad o situaciones parciales requieren revisión; no hay historial de relaciones contractuales por fecha efectiva ni cierre de nómina.

## Esquema y permisos

Migración [202611030015_monthly_contract_payments.sql](../supabase/migrations/202611030015_monthly_contract_payments.sql). Agrega tabla, índice, restricciones, RLS, auditoría, funciones de guardado/consulta mensual y la regla de nuevas preparaciones semanales solo para boletas. Su ejecución no elimina datos ni crea salarios. El propietario indicó haberla aplicado; el historial remoto de CLI sigue sin reparar. Si se aplicó manualmente, registra su versión con `supabase migration repair 202611030015 --status applied` solo tras verificar proyecto y resultado.

Las funciones exigen administrador activo. El guardado comprueba trabajador de contrato del espacio, bloquea su ficha y verifica versión. El anticipo del payload se ignora: siempre se aplica $200.000. Las claves compuestas impiden relacionar trabajadores/perfiles de otro espacio. No hay escrituras directas para usuarios autenticados. El endpoint de Excel exige sesión y rol y usa `Cache-Control: private, no-store`.

Las pruebas locales cubren antigüedad por mes, anticipo fijo frente a payload manipulado, versiones obsoletas, rechazo de salarios inferiores al anticipo, rechazo de una boleta en el módulo mensual, RLS entre administradores, trabajador sin acceso y persistencia de registros mensuales al desactivar una ficha. La comparación de totales verifica que el anticipo no aumenta el gasto. También se genera y reabre el Excel y se validan los formatos de HE.

Resultado local: **101 pruebas aprobadas**, una integración de Supabase local omitida. **34 pruebas Playwright aprobadas** en escritorio y celular, incluidas HE rápidas, pestaña mensual, ausencia de desbordamiento y endpoint mensual sin sesión denegado. Tipos, lint y build de producción correctos. No se probaron salarios de producción mediante sesiones de otros usuarios ni apertura en Microsoft Excel nativo; se comprobó localmente el XLSX mediante generación y reapertura.

## Limpieza autorizada de la cuenta

El propietario pidió eliminar todos sus trabajadores y turnos existentes. Se verificó su cuenta Auth y espacio, se respaldaron las filas relevantes en `artifacts/` (ignorado por Git) y se eliminaron únicamente los identificadores de ese espacio revisados, con comparación de versión. Se borraron 171 turnos, cuatro trabajadores, cuatro fichas privadas y una preparación de pago dependiente; no había cuentas de trabajadores vinculadas ni referencias de tareas, ausencias o bitácora que requirieran decisiones adicionales. No se eliminaron cuentas Auth, administradores ni auditoría. El contexto de actor de esta intervención es el servicio de mantenimiento, sin atribuirlo artificialmente a una sesión del usuario.

Se verificó inmediatamente que quedaron cero trabajadores, turnos y preparaciones en ese espacio y que los recuentos de los otros espacios no cambiaron. Posteriormente aparecieron tres trabajadores y diez turnos nuevos: se compararon sus UUID y fechas con el respaldo y todos eran posteriores a la limpieza. Se conservaron; no se repitió una eliminación sobre el trabajo nuevo del usuario. No se publicó el respaldo ni sus datos privados.

La comprobación remota posterior confirmó la presencia de las funciones mensuales y el rechazo de llamadas anónimas (42501), sin crear registros mensuales ni realizar pagos reales.
