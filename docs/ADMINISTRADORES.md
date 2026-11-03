# Varios administradores

Cambio solicitado por el propietario: permitir agregar administradores desde Configuración, manteniendo la autenticación por invitación y los controles del servidor.

## Aplicar en Supabase

El código y la migración están implementados. El propietario informó haber ejecutado la migración en Supabase. Se verificó remotamente la presencia de la función y el rechazo de una solicitud anónima (42501). La service role disponible no permite ejecutar DDL y el control nativo del navegador no estuvo disponible; no se afirma haber ejecutado la migración desde este equipo ni reparado el historial remoto de la CLI.

1. Abre el proyecto Supabase → SQL Editor → New query.
2. Copia el archivo completo [202611020011_multiple_administrators.sql](../supabase/migrations/202611020011_multiple_administrators.sql) y ejecútalo una vez. No ejecutes reseteos, semillas ni las migraciones anteriores sobre tablas existentes.
3. Comprueba en Configuración que puedes agregar una cuenta confirmada. Si falta la migración, la aplicación muestra un error y no otorga permisos.
4. Si administras migraciones con CLI, usa preferentemente `supabase db push` con el historial previo verificado. Si aplicaste esta migración manualmente, registra su versión mediante `supabase migration repair 202611020011 --status applied` una vez confirmado el resultado, con el proyecto correctamente enlazado. No marques otras migraciones como aplicadas sin comprobarlas.

## Qué cambia

- Se elimina únicamente el índice parcial `only_one_admin`. No se eliminan tablas, cuentas ni datos operativos.
- Se agrega `grant_administrator(text,text)`, invocable por un administrador autenticado y activo. Rechaza cuentas inexistentes, no confirmadas, bloqueadas o eliminadas, y trabajadores inactivos. Conserva vínculos laborales y perfiles existentes.
- Las promociones se serializan mediante un bloqueo de transacción y se pueden repetir sin duplicados. Una cuenta Auth confirmada sin perfil obtiene un perfil administrador sin trabajador ficticio.
- Se conservan RLS y las comprobaciones de permisos de servidor. Solo se permite actualizar directamente el nombre del propio perfil; el rol y los vínculos requieren funciones protegidas.
- La auditoría registra el cambio de rol, el actor y los estados anteriores y nuevos. No registra el correo ni contraseñas.
- Desactivar un trabajador administrador revoca su acceso incluso si conserva una sesión previa. Un administrador sin vínculo laboral sigue activo.
- Reenviar la invitación de un trabajador promovido conserva su rol y vínculo.

El bootstrap sigue reservado para crear al primer administrador. No se añadieron contraseñas predeterminadas, registro público ni envíos automáticos de correo en esta función. Cada administrador tiene acceso completo, incluidos los datos privados operativos.

## Verificación

Pruebas SQL locales sobre las migraciones completas: varios administradores, promoción idempotente, nueva cuenta sin perfil, conservación del vínculo laboral, auditoría del rol, rechazo de trabajador y anónimo, bloqueo de actualización directa de rol, cuentas no confirmadas/inactivas, desactivación con sesión previa y reenvío de invitación. Resultado: 56 pruebas locales aprobadas y una prueba de Supabase local omitida. Tipos, lint y build correctos. Dos pruebas Playwright aprobadas en escritorio y celular sobre el formulario, su confirmación explícita y el bloqueo de mutaciones en demostración.

## Alta autorizada verificada

El propietario indicó el correo de una cuenta adicional. Al revisar antes del alta, esa cuenta ya existía en Auth con correo confirmado, sin bloqueo y sin perfil de aplicación. Se agregó un perfil administrador mediante la API privilegiada en una intervención de mantenimiento autorizada, conservando el administrador existente. La verificación posterior confirmó dos perfiles administradores y un registro de auditoría INSERT para el alta. El actor de esta intervención es el contexto de servicio, sin atribuirla artificialmente a una sesión del usuario. No se cambiaron contraseñas ni se enviaron correos. La promoción mediante el formulario utiliza la sesión real del administrador y su actor queda registrado por el trigger. No se verificó el ingreso personal de la cuenta adicional.
