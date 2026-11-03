# Espacios privados por administrador

Cada administrador tiene un espacio independiente. Sus trabajadores, datos privados, invitaciones, turnos, ausencias, tareas, comentarios, fotografías, bitácora, auditoría y catálogos pertenecen a ese espacio. Los trabajadores ven el calendario de su propio equipo, sus tareas autorizadas y la bitácora permitida de ese mismo espacio.

## Migración

Archivo: [202611030012_private_workspaces.sql](../supabase/migrations/202611030012_private_workspaces.sql). Requiere las migraciones anteriores, incluida 202611020011. No ejecutes un reset ni cargues semillas de demostración para actualizar una base existente.

El propietario pidió conservar todos los datos operativos con el administrador original y dejar el segundo espacio vacío. Antes de preparar la migración se comprobó que los registros con autor correspondían al administrador original. Se guardó una copia local de las 17 tablas en `artifacts/`, excluida de Git. Esa copia contiene datos privados: no debe publicarse ni adjuntarse a incidencias.

La migración usa una transacción y bloqueos breves con tiempo límite de 10 segundos. Si otro administrador ya creó registros con autor, aborta sin reasignarlos silenciosamente. Rechaza también administradores vinculados a trabajadores: su traslado requiere una decisión explícita. En el caso verificado, ambos administradores carecían de vínculo laboral.

Pasos en proyectos alojados sin acceso de CLI a PostgreSQL:

1. Abre SQL Editor de Supabase y ejecuta el archivo completo una sola vez, en el proyecto correcto.
2. Si aparece un error, no ejecutes fragmentos ni desactives políticas para resolverlo. La transacción debe revertirse. Conserva el error para revisarlo.
3. Verifica las asignaciones de `profiles.workspace_id` y los recuentos por espacio antes de anunciar la separación. Actualiza la aplicación y recarga los dispositivos con sesiones abiertas.
4. Si usas CLI, aplica preferentemente `supabase db push` con el historial previamente verificado. Si la aplicación fue manual, registra solo esta versión con `supabase migration repair 202611030012 --status applied` después de comprobar el resultado y el proyecto enlazado. No se reparó el historial remoto desde esta sesión.

Para una instalación vacía, el primer administrador reclama el espacio inicial y conserva los UUID del catálogo inicial. Los administradores siguientes reciben un espacio nuevo. No se crea ningún trabajador ni turno ficticio.

## Protección

- `workspaces` identifica el espacio de cada administrador; todos los registros operativos incorporan `workspace_id` no nulo e indexado.
- `current_workspace()` obtiene el espacio desde el perfil de la sesión, sin aceptar una elección del navegador. Las políticas restrictivas se combinan mediante AND con las políticas de roles y registros anteriores. Un administrador ya no implica acceso a todos los espacios.
- Las relaciones compuestas verifican que trabajadores, turnos, tipos, tareas, responsables, perfiles y registros relacionados pertenezcan al mismo espacio. Un trigger impide trasladar registros cambiando `workspace_id`.
- Las funciones privilegiadas de autorización, autores y avatares verifican explícitamente el espacio. Los archivos privados conservan sus rutas y permisos ligados al registro padre. No se mueven ni duplican fotografías.
- La auditoría conserva las versiones y fechas históricas y asigna las nuevas acciones al espacio del registro. El actor de auditoría puede corresponder al administrador que habilitó una cuenta independiente; no concede acceso a sus datos ni a su perfil.
- Realtime usa canales y filtros por espacio, además de RLS. La actualización periódica de 60 segundos permanece como respaldo, incluidas eliminaciones que no contengan `workspace_id` en el evento de Postgres.
- La interfaz exige un perfil con espacio asignado; una base sin migrar impide entrar a las vistas operativas de la versión nueva en lugar de presentar datos compartidos.

La API privilegiada de mantenimiento sigue pudiendo leer todos los espacios; su clave solo reside en el servidor y en el entorno local privado. Ninguna petición del navegador obtiene ese cliente.

## Agregar otro administrador

El propietario crea o confirma la cuenta en Supabase Auth. Desde Configuración → Espacios independientes, un administrador puede habilitarla con nombre, correo y confirmación explícita. `grant_administrator` crea el perfil y espacio de forma atómica, con un catálogo inicial de cuatro tipos de turno. Repetir la solicitud es idempotente. Una cuenta ya vinculada como trabajador no se mueve ni pierde su equipo: se rechaza la solicitud y se requiere otra cuenta independiente.

No se incluye un selector de espacios, acceso global de administrador, cuentas compartidas ni traslado automático de registros entre equipos.

## Verificación ejecutada

- 64 pruebas locales aprobadas, una integración de Supabase local omitida por falta de plataforma local.
- Pruebas nuevas SQL sobre PostgreSQL embebido con las migraciones reales: aislamiento de las 17 tablas y perfiles, consultas por UUID ajeno, rechazos de escritura y relaciones cruzadas, Storage, avatares, alta idempotente de un espacio vacío, vinculación de trabajadores y migración de una base previa con conservación de datos y versiones.
- 24 pruebas Playwright aprobadas en escritorio y celular, incluidas navegación, formularios, confirmación, modo demostración y PWA.
- Tipos, lint y build de producción aprobados.

El propietario informó haber ejecutado la migración en Supabase. Se verificó remotamente que existen dos espacios, que el primero conserva 4 trabajadores, 176 turnos, 1 tarea y 1 entrada de bitácora y que el segundo tiene cero registros en esas cuatro entidades. Cada espacio tiene sus cuatro tipos de turno. Una comparación con el respaldo confirmó los 488 registros originales conservados sin cambios de campos previos, versiones ni fechas: únicamente se agregó su pertenencia al espacio. No se iniciaron sesiones en nombre de los administradores ni se probaron sus contraseñas. Las pruebas de permisos con roles se ejecutaron localmente; no se presentan como pruebas de Auth o Realtime reales remotos.

Los datos ya mostrados en un dispositivo abierto no se pueden retirar de su memoria de forma retroactiva. Recarga la aplicación en cada dispositivo después de actualizar; las futuras consultas quedan sujetas al aislamiento de la base de datos. Las URLs privadas ya firmadas tienen una vigencia máxima de 60 segundos.
