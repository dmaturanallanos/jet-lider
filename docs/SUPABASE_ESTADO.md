# Estado de conexión de Supabase

Proyecto: `fckgpmzswkookyipqhtq`. Verificación realizada el 1 de noviembre de 2026 después de recibir las credenciales.

## Estado verificado

- Se configuró `.env.local` y se comprobó que Git lo ignora.
- La API REST respondió HTTP 200 y expone las 17 tablas esperadas de la aplicación.
- Se encontraron las doce funciones operativas comprobadas: permisos, trabajadores, turnos, tareas, ausencias, invitaciones, avatar, pendientes, dashboard y autores.
- Las credenciales de Auth administrativo y Storage fueron aceptadas.
- Existen `task-evidence`, `logbook-evidence` y `avatars`, los tres privados.
- Se encontró y verificó la cuenta indicada por el propietario. No se registran correos, identificadores ni claves en este documento.
- Se ejecutó el bootstrap seguro y se creó el perfil de esa cuenta con rol `admin` y nombre visible «Administrador».
- Una consulta posterior confirmó que existe exactamente un administrador y corresponde a la cuenta indicada. No se crearon cuentas Auth ni contraseñas durante el bootstrap.
- Se limpiaron las variables temporales `BOOTSTRAP_*` de `.env.local` después de verificar el resultado.
- No hay trabajadores registrados.
- **El registro público de Auth está habilitado**: debe deshabilitarse antes de operar.

## Historial de migraciones pendiente de comprobar

La presencia de tablas y funciones confirma que ya existe un esquema instalado; no demuestra por sí sola que los diez archivos estén registrados en el historial de migraciones ni que todas sus restricciones estén aplicadas.

La CLI local no tiene sesión de administración de Supabase. La clave `service_role` permite operaciones de backend, pero no sustituye la autenticación de la CLI para consultar y administrar el historial de migraciones.

Desde la carpeta del proyecto:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref fckgpmzswkookyipqhtq
npx.cmd supabase migration list
npx.cmd supabase db push --dry-run
```

No se ejecutó `db push`, `migration repair` ni ningún reset. Si el esquema fue instalado desde SQL Editor y la CLI muestra las migraciones pendientes, primero hay que comparar esquema e historial; no se deben volver a crear las tablas ni marcar migraciones como aplicadas sin comprobarlas.

## Pendientes para completar el acceso

1. En Authentication, deshabilitar «Allow new users to sign up».
2. Confirmar Site URL y Redirect URLs para `http://localhost:3000` y `http://localhost:3000/auth/confirm` durante desarrollo.
3. Configurar y comprobar SMTP y plantillas de invitación/acceso.
4. Reemplazar la clave privilegiada compartida en el chat y actualizar `.env.local`. No registrar la clave nueva en documentación o Git.

Puede repetirse el diagnóstico sin escrituras ni exposición de secretos con:

```powershell
node --env-file=.env.local scripts/check-supabase.mjs
```

El código de salida 2 significa que faltan pasos de configuración, como bloquear signup o crear el perfil administrador; 1 indica un error de conexión o de esquema/buckets. Esta comprobación no sustituye las pruebas autenticadas de permisos y concurrencia.
