# Asistencia, Excel semanal y eliminación de información incorrecta

## Uso

En Turnos, selecciona Día para revisar la jornada o abre un turno desde la agenda o cuadrícula. Su detalle permite seleccionar Asistió o No asistió, agregar una nota opcional y guardar. Para corregir, cambia el resultado y vuelve a guardar. Para retirar una marca incorrecta, selecciona Sin registrar y guarda. Esto no transforma el turno en ausencia: elimina la marca y deja auditoría.

Solo el administrador de ese espacio puede consultar y modificar estos registros. No se admiten marcas de turnos futuros, cancelados o sin trabajador. Varios turnos de la misma persona en un día se registran por separado. Si un turno ya tiene asistencia, se exige retirar primero la marca antes de reasignarlo, cambiar sus fechas u horas o cancelarlo; se evita atribuir una asistencia previa a otro trabajador u otro día. Eliminar un turno elimina su marca asociada, conservando la auditoría de ambos.

Excel semanal de asistencia descarga la semana de lunes a domingo de la fecha seleccionada. Incluye todos los turnos del espacio en esa semana, sin aplicar filtros de trabajador, tipo, lugar o estado de la pantalla. No incluye información de otros administradores. Se requiere conexión y sesión de administrador; la respuesta no se almacena en caché.

El archivo contiene:

- Resumen semanal: una fila por trabajador, resultados de cada día, turnos activos, asistencias, inasistencias, pendientes, cancelados, sin asignar y horas programadas.
- Detalle de turnos: horario programado, fechas de inicio y término, tipo, lugar, estado, resultado, descanso, horas programadas, nota y autor/fecha de la marca.

Los contadores son por turno. Un día con dos turnos puede contener dos resultados distintos; no se pierde información al resumir. Los pendientes, cancelados y turnos sin asignar permanecen como categorías diferentes. Una semana vacía genera un archivo válido que indica Sin turnos. Las referencias numéricas del archivo distinguen trabajadores que tengan el mismo nombre, sin exportar sus UUID ni datos privados de contacto.

Las fechas muestran año y horario de 24 horas en America/Santiago. Un nocturno pertenece a la semana y día de su inicio local, aunque termine al día siguiente. Las horas descontadas de descanso se calculan con instantes reales y respetan DST. Son horas del horario programado, nunca fichaje, horas efectivamente trabajadas ni cálculo de pago. El Excel es una instantánea; modificarlo no actualiza la aplicación.

## Eliminar registros

El administrador puede abrir una observación, tarea o trabajador y usar Eliminar. Los comentarios tienen su propio botón dentro de la tarea. Cada operación pide confirmación; los errores y conflictos conservan el diálogo.

- Observación: se elimina el registro y los metadatos de sus fotografías.
- Tarea: se eliminan responsables, comentarios y metadatos de evidencias en una transacción. Una referencia desde bitácora bloquea el borrado: se debe corregir o eliminar primero esa referencia.
- Comentario: se elimina solo el comentario seleccionado y queda su contenido anterior en auditoría.
- Trabajador: se eliminan ficha, datos privados e invitaciones pendientes solo si no tiene una cuenta vinculada ni turnos, ausencias, responsabilidades de tareas o bitácora relacionada. En caso contrario, se indica qué debe gestionarse primero o se propone desactivarlo. No se borran cuentas Auth ni historial por cascada.

La eliminación conserva un registro de auditoría accesible al administrador del mismo espacio; no es una herramienta para purgar auditoría. El historial de trabajadores con actividad se conserva mediante desactivación.

Los archivos físicos se eliminan después de confirmar la transacción. El servidor usa exclusivamente las rutas devueltas por la función protegida; nunca acepta rutas del navegador para el cliente privilegiado. Si Storage falla o falta su clave de servidor, el registro sigue eliminado y se informa que hay archivos pendientes. Sus padres y metadatos ya no existen y RLS impide generar nuevas URLs. Una URL ya firmada puede durar hasta 60 segundos. El script `scripts/cleanup-orphans.mjs` permite revisar y limpiar archivos sin referencia de más de 24 horas; requiere ejecución controlada con service role, primero sin `--apply`. No se implementó un cron automático.

## Esquema y permisos

Migración [202611030013_attendance_and_corrections.sql](../supabase/migrations/202611030013_attendance_and_corrections.sql). Requiere las migraciones anteriores. La transacción agrega `shift_attendance`, índices, claves de espacio, triggers, políticas y tres funciones: `save_attendance`, `attendance_week` y `delete_operational_record`. Su aplicación no registra asistencias ni elimina registros existentes. No uses reset ni reapliques migraciones anteriores para actualizar producción.

La tabla de asistencia tiene un registro único por turno y control de versión. Un bloqueo sobre el turno serializa marcas simultáneas. Las marcas futuras, canceladas, sin asignar o con trabajador incorrecto se rechazan en la base de datos, incluso al utilizar la clave de mantenimiento. El estado pendiente se representa mediante ausencia de una marca, no con un valor de inasistencia.

Las funciones de escritura usan SECURITY DEFINER, `search_path` vacío, validación de administrador activo, pertenencia al espacio, bloqueo del registro y versión esperada. No son invocables por anónimos ni por la service role. La service role conserva acceso de mantenimiento a las tablas y al borrado físico de archivos exclusivamente en servidor. No hay escritura directa de asistencia para usuarios autenticados.

La lectura semanal usa SECURITY INVOKER, políticas RLS y una instantánea consistente. El límite es 10000 turnos por semana; no se exporta silenciosamente una lista truncada. El endpoint verifica sesión/rol y devuelve XLSX con `Cache-Control: private, no-store`. ExcelJS se utiliza en servidor para escribir archivos; no se aceptan libros de Excel subidos por usuarios ni se generan macros, conexiones externas o fórmulas a partir de sus textos. Las cadenas que empiezan con `=` permanecen como texto.

Realtime incorpora asistencia filtrada por espacio y conserva la limpieza de suscripciones. La carga del calendario consulta las marcas únicamente de los turnos visibles, en lotes acotados para no exceder el tamaño de URL de REST.

## Verificación

Se ejecutaron 76 pruebas locales aprobadas, con una prueba de integración de Supabase local omitida por falta de plataforma local. Incluyen:

- Asistió/No asistió/corrección/retirada de marca, versión obsoleta, turnos no válidos, protección de edición del turno marcado y auditoría al borrarlo.
- Roles, separación entre administradores, prohibición de escritura directa y lectura de asistencia solo por su administrador.
- Borrado transaccional de registros dependientes, metadatos y rutas correctas de fotos; bloqueo por referencias y por cuentas de trabajadores.
- Generación y reapertura del XLSX, categorías y horas correctas, nocturnos, texto que aparenta fórmula y semana vacía.

Además, 28 pruebas Playwright aprobaron en escritorio y celular, incluidos los controles de asistencia/borrado, modo demostración, descarga sin sesión rechazada, navegación y PWA. Tipos, lint y build de producción fueron correctos. No se verificó la apertura en la aplicación nativa Microsoft Excel ni la entrega por navegador autenticado del propietario; la generación se verificó localmente mediante escritura y reapertura del XLSX.

El propietario informó haber aplicado la migración en Supabase. Se confirmó remotamente que las tres funciones existen y que sus solicitudes anónimas son rechazadas (42501), que la tabla de asistencia está vacía y que permanecen 4 trabajadores, 176 turnos, 1 tarea y 1 observación. No se crearon marcas ficticias ni se eliminaron datos reales para probar la función. Las pruebas SQL con roles son locales y no se presentan como pruebas de sesiones Auth reales de producción. El borrado físico en Storage está integrado, pero no se ejecutó contra evidencias reales.

Si aplicaste manualmente la migración, registra su versión con `supabase migration repair 202611030013 --status applied` solo después de verificar el proyecto y resultado. El historial remoto de CLI no fue reparado desde esta sesión.
