# Jet Líder

Aplicación interna en español para coordinar turnos, trabajadores, tareas y entregas de turno. Next.js App Router, React, TypeScript estricto, Tailwind y Supabase. Los componentes propios usan controles HTML accesibles, navegación por teclado y diálogos nativos.

**Estado actual:** código implementado y verificado localmente. Después de la entrega inicial se configuraron las credenciales, se verificó la conexión real con Supabase y se creó el único administrador mediante el bootstrap seguro, vinculado a la cuenta verificada indicada por el propietario. El proyecto ya contiene las tablas y buckets; falta comprobar el historial de migraciones y bloquear el registro público. No se ejecutaron migraciones remotas, envíos de correo, pruebas de Realtime o cargas reales de archivos. No se publicó la aplicación. Consulta [el estado de Supabase](docs/SUPABASE_ESTADO.md).

## Inicio rápido

Requisitos: Node.js 24 LTS, npm y un proyecto Supabase. Para ejecutar la plataforma Supabase local se necesita además Docker Desktop. Las pruebas SQL embebidas no necesitan Docker.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

En PowerShell usa `Copy-Item .env.example .env.local`. Si la política de PowerShell bloquea `npm.ps1`, usa `npm.cmd` y `npx.cmd`; no hace falta modificar la política de ejecución.

- Acceso: <http://localhost:3000/acceso>
- Demostración opcional: <http://localhost:3000/demo>
- Calendario de demostración: <http://localhost:3000/demo/turnos>

La demostración es **de solo lectura**, no escribe en Supabase y se identifica en todas sus pantallas. Contiene seis personas ficticias, una semana de turnos, un turno nocturno, una vacante, un día libre, diez tareas y registros diarios/semanales. No crea cuentas ni contraseñas. Sus fechas siguen la semana seleccionada.

Si necesitas esos datos dentro de una base de desarrollo, abre su SQL Editor y ejecuta manualmente el contenido de `supabase/demo.sql`, después del bootstrap y solo con un equipo vacío. El archivo rechaza bases con trabajadores existentes y no se carga automáticamente. No lo ejecutes en producción.

## Conectar Supabase

1. Crea un proyecto en Supabase y conserva la contraseña de PostgreSQL en un gestor de secretos.
2. En las opciones de API copia la URL y la clave publicable (o `anon` heredada). Colócalas en `.env.local`.
3. Copia la clave `service_role` únicamente en la variable de servidor indicada abajo. Nunca uses un prefijo `NEXT_PUBLIC_` para ella.
4. Aplica las migraciones en orden con Supabase CLI. Para un proyecto nuevo:

```sh
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

Revisa la salida de `--dry-run` antes de aplicar cambios a un proyecto existente. No uses `db reset`, no borres datos para corregir migraciones y respalda las bases existentes antes de actualizarlas. Las migraciones de este repositorio no eliminan registros operativos.

Para una plataforma local nueva:

```sh
npx supabase start
npx supabase migration up --local
npx supabase status
```

Usa las claves de la plataforma local en `.env.local`. `supabase/config.toml` deshabilita los registros públicos y el seed automático. `supabase start` puede aplicar las migraciones al iniciar una base vacía; `migration up` aplica solo las pendientes.

### Variables

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL HTTPS de Supabase o URL de la plataforma local |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave publicable o `anon`, nunca `service_role` |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor: invitaciones, bootstrap y mantenimiento |
| `NEXT_PUBLIC_APP_URL` | Origen exacto de la aplicación; sin barra final, por ejemplo `http://localhost:3000` |
| `BOOTSTRAP_ADMIN_USER_ID` | UUID de tu propia cuenta ya verificada; solo bootstrap |
| `BOOTSTRAP_ADMIN_NAME` | Nombre de presentación del único administrador |

Las variables públicas se incorporan al build; después de cambiarlas reconstruye la aplicación. Los archivos `.env*` están ignorados, excepto el ejemplo sin secretos.

## Auth, invitaciones y correo

En Supabase → Authentication:

1. Habilita el proveedor de correo y deshabilita **Allow new users to sign up**. No hay ruta de registro en la aplicación y el acceso por enlace usa `shouldCreateUser: false`.
2. Configura **Site URL** con `NEXT_PUBLIC_APP_URL`.
3. Agrega en **Redirect URLs** la dirección exacta `https://TU_DOMINIO/auth/confirm`; en desarrollo `http://localhost:3000/auth/confirm`. Evita comodines en producción.
4. Configura SMTP propio: remitente verificado, host, puerto TLS, usuario y contraseña del proveedor. Configura sus registros SPF/DKIM y revisa límites y entrega. El correo de pruebas predeterminado de Supabase no debe considerarse un servicio de producción.
5. En la plantilla **Invite user**, usa un enlace de confirmación para servidor:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite">Aceptar invitación a Jet Líder</a>
```

En **Magic Link**:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink">Ingresar a Jet Líder</a>
```

La ruta también admite el intercambio PKCE mediante `code`, sin aceptar destinos arbitrarios de redirección. No introduzcas claves de API en plantillas. En la plataforma local revisa el buzón de pruebas cuya URL muestra `supabase status`.

### Administrador inicial

1. Desde el panel Auth, crea **tu propia cuenta** con correo y contraseña propios, o invítate usando las herramientas del panel. Completa la verificación de correo.
2. Copia su UUID en `BOOTSTRAP_ADMIN_USER_ID`, escribe tu nombre en `BOOTSTRAP_ADMIN_NAME` y ejecuta:

```sh
npm run bootstrap
```

3. El script verifica la cuenta con Auth, exige correo confirmado y rechaza otro administrador existente. El índice parcial `only_one_admin` protege también frente a solicitudes simultáneas.
4. Elimina las variables `BOOTSTRAP_*` cuando termines. La clave privilegiada del servidor sigue siendo necesaria para las invitaciones.

No existe contraseña predeterminada, registro público ni endpoint para obtener privilegios. Ninguna operación normal de la aplicación puede crear o promover a un segundo administrador. Una recuperación extraordinaria requiere intervención explícita del propietario de Supabase.

### Invitar a un trabajador

1. Equipo → Nuevo trabajador: basta su nombre. Puedes asignarle turnos y tareas sin una cuenta.
2. Agrega su correo privado desde Editar ficha.
3. Usa el botón «Invitar o reenviar acceso». Se reserva una invitación única para ese perfil y correo antes de llamar a Auth.
4. La función de servicio `invitee_account` contrasta el correo con `auth.users` y vincula una sola cuenta al trabajador. No confía en metadatos enviados por el navegador.
5. Si falla el correo o la vinculación, reintenta el mismo botón. Si ya existe la cuenta, se conserva el vínculo y se solicita otro enlace de acceso. Los errores quedan visibles; no se crean perfiles laborales adicionales.

Si cambias el correo después de reservar una invitación, el sistema exige resolver el vínculo con el propietario de Supabase; no reasigna automáticamente otra cuenta. Revisa los estados `pending`, `failed` y `linked` y los registros de Auth. Un estado vinculado no garantiza entrega del correo.

## Uso operativo

- **Turnos:** semana de lunes a domingo, agenda diaria, mes, mis turnos y cuadrícula desplazable. La vista semanal móvil usa agenda y permite abrir la cuadrícula. Los filtros y la fecha permanecen en la URL.
- **Programación:** permite vacantes, varios turnos diarios, responsables múltiples, repetición de hasta 90 días y copia de semana con vista previa. Un lote admite hasta 500 turnos y se guarda de forma atómica. La copia consulta la semana completa, independientemente de los filtros de pantalla.
- **Series:** abre un turno, edítalo y selecciona aplicar a las ocurrencias futuras. Se consultan sus versiones actuales y el lote se valida antes de guardar.
- **Ausencias:** días completos inclusivos o intervalos horarios. Las observaciones compartidas y notas privadas están en tablas distintas. Los conflictos obligan a gestionar los turnos; no se cancelan silenciosamente. La lista del período permite eliminar una ausencia incorrecta y volver a registrarla; queda auditoría.
- **Desactivación:** la ficha consulta el número real de turnos futuros y tareas abiertas, pide reconocer esos pendientes y bloquea nuevas asignaciones. Se conservan los registros anteriores. Usa los filtros de turnos y tareas para gestionarlos.
- **Tareas:** lista/tablero, búsqueda, responsables, prioridad, estado y fechas límite. Los responsables comparten el mismo avance, pueden comentar y agregar imágenes. Solo el administrador cancela, reasigna o reabre tareas completadas.
- **Bitácora:** períodos diarios/semanales, búsqueda, autor, tipo, registros fijados y relaciones opcionales. Los trabajadores editan sus registros compartidos. Las moderaciones del administrador conservan versiones anteriores en auditoría.
- **Perfil:** nombre para mostrar, avatar y consulta de datos propios permitidos. Los datos laborales/contacto se corrigen mediante el administrador.
- **Configuración:** tema claro, oscuro o del sistema; tipos de turno adicionales; instrucciones de instalación.

La confirmación de turnos es una acción administrativa, **no registra asistencia**. Las horas son duración real menos descanso y **no calculan remuneraciones**. Los totales semanales corresponden a turnos que comienzan en esa semana, incluyendo su duración completa si terminan el lunes siguiente. En una agenda se muestra también el turno que continúa desde el día anterior.

Se conserva la hora de Chile al repetir/copiar; nunca se suman bloques fijos de 24 horas. Se rechazan explícitamente horas ambiguas o inexistentes. La vista previa muestra duraciones reales; un cambio de horario puede sumar o restar una hora respecto de la diferencia del reloj.

## Datos, permisos y mantenimiento

`src/features/` separa auth, trabajadores, turnos, ausencias, tareas, bitácora, dashboard y configuración; `shared` contiene contratos, formularios, consultas y el despachador de operaciones compartidas. `src/lib/supabase` separa clientes de navegador, servidor y administración. No se usa `localStorage` como base de datos; solo se persiste el tema.

Migraciones:

| Archivo | Contenido |
| --- | --- |
| `202611010001_core.sql` | Entidades, UUID, índices, RLS, permisos, auditoría, exclusión de turnos y RPC transaccionales |
| `202611010002_storage_realtime.sql` | Tres buckets privados, políticas de objetos y publicación Realtime |
| `202611010003_invitations.sql` | Vinculación de cuentas exclusiva del servicio |
| `202611010004_profile_avatar.sql` | Cambio limitado y autorizado del avatar propio |
| `202611010005_operational_summary.sql` | Conteos reales del dashboard, pendientes y permisos de evidencias de bitácora |
| `202611010006_integrity.sql` | Períodos completos, autores compartidos limitados y conservación de responsables inactivos |
| `202611010007_idempotency.sql` | Idempotencia de creación de trabajadores y unicidad de vacantes activas |
| `202611010008_lookup_indexes.sql` | Índices de historial, comentarios y adjuntos por registro |
| `202611010009_absence_integrity.sql` | Eliminación atómica de ausencia/nota privada y límites de texto |
| `202611010010_audit_context.sql` | Contexto de períodos y relaciones en auditoría, sin contactos ni notas privadas |

Las tablas privadas no se consultan desde las vistas compartidas. `is_active`, `is_admin`, `can_task` y `can_entry` centralizan las comprobaciones de PostgreSQL. Todas las tablas públicas tienen RLS. Las operaciones ordinarias usan la sesión del usuario, también desde el servidor. Las funciones privilegiadas fijan `search_path` y restringen su ejecución.

La exclusión GiST en turnos protege frente a solapamientos simultáneos. Los rangos son `[inicio, término)`: se permiten turnos consecutivos y se ignoran cancelados. Turnos, ausencias y asignaciones bloquean la misma fila de trabajador. Las ediciones críticas comprueban `version`; los triggers incrementan la versión y las fechas. Ante conflicto, se conserva el formulario abierto para copiar su contenido y recargar el registro.

La desactivación revoca inmediatamente las consultas protegidas aunque el JWT anterior siga siendo válido. El contenido ya visto en memoria no se puede retirar retroactivamente; la interfaz refresca cada 60 segundos y ante los eventos autorizados de Realtime. Una URL de archivo firmada anteriormente puede durar hasta 60 segundos.

### Actualizar esquema y tipos

Agrega una nueva migración, pruébala en una base de desarrollo y revisa `db push --dry-run`. No edites migraciones que ya se hayan aplicado a entornos compartidos.

```sh
npm run db:types
# O, para el proyecto vinculado:
npx supabase gen types typescript --linked > src/types/database.generated.ts
npm run typecheck
npm test
```

Los tipos incluidos se generaron desde el catálogo PostgreSQL aplicando las migraciones reales con PGlite: `node scripts/generate-types.mjs`. Este generador sin Docker incluye columnas y RPC utilizadas; las relaciones automáticas se completan al regenerar con la CLI de Supabase. Los alias `Row` y `TableName` viven en `src/types/database.ts`, separados del archivo generado.

### Fotografías y archivos huérfanos

JPEG, PNG o WebP; hasta 20 MB de origen en navegador, comprimidos antes de enviar y límite final de 5 MB. El servidor decodifica de nuevo, limita a 32 megapíxeles, reduce a 1920 px y elimina metadatos al convertir a JPEG. Se muestra progreso de transferencia, vista previa y confirmación del servidor. HEIC debe exportarse a JPEG.

Rutas: `registro_uuid/usuario_uuid/archivo_uuid.jpg`. Evidencias y avatares son privados. Las lecturas usan URLs firmadas de 60 segundos y no pasan por un optimizador compartido de imágenes. La subida verifica la sesión y RLS; si falla el registro de metadatos, intenta eliminar el objeto recién subido.

La relación entre Storage y PostgreSQL no es una transacción distribuida. Una caída puede dejar huérfanos. El mantenimiento muestra primero los objetos **sin referencia y de más de 24 horas**:

```sh
node --env-file=.env.local scripts/cleanup-orphans.mjs
# Revisa la lista antes de autorizar su eliminación:
node --env-file=.env.local scripts/cleanup-orphans.mjs --apply
```

Programa esta tarea en una ventana de mantenimiento mediante un entorno de servidor seguro. El script no se ejecuta automáticamente en producción. Si el objeto se eliminó pero falló la eliminación de sus metadatos, la interfaz muestra archivo no disponible; revisa y elimina el registro autorizado desde el detalle.

## Pruebas

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

La CI ejecuta los mismos controles. Playwright usa el servidor local disponible o levanta uno temporal; genera trazas cuando falla y capturas del calendario en `artifacts/`.

**Pruebas locales:** reglas de fechas/DST, repeticiones, copias, descansos; migraciones y RLS con PostgreSQL embebido; autenticación representada mediante roles/claims SQL, privacidad, sesiones desactivadas, tareas, archivos, auditoría, idempotencia y control de versiones. PGlite ejecuta PostgreSQL y las migraciones sin reescribirlas, pero sus tablas Auth/Storage de prueba representan solo el contrato SQL: no son los servicios GoTrue o Storage de Supabase.

**Pruebas de navegador:** Chromium de escritorio y viewport/táctil móvil. Verifican acceso cerrado, navegación, ausencia de desbordamiento, calendario, detalles, modo demo, tema, manifest, recursos PWA y respaldo sin conexión. La emulación de iPhone en Chromium **no equivale a probar Safari/iOS físico**.

### Integración con Supabase real local, opcional

`tests/supabase.live.test.ts` se omite por defecto. Prueba Auth real, peticiones REST directas/RLS, Storage, desactivación y carreras entre conexiones para superposición y edición. Requiere una plataforma Supabase local **vacía, sin administrador**, con las migraciones aplicadas. Crea cuentas de prueba con contraseña aleatoria en memoria y deja sus fixtures para inspección; no resetea ni elimina datos. Rechaza destinos distintos de localhost/127.0.0.1 y rechaza un administrador existente.

Crea `.env.test.local` con URL/claves locales y `RUN_LOCAL_SUPABASE_TESTS=1`; luego:

```sh
npm run test:live
```

Esta prueba no se ejecutó en la entrega: no había plataforma Supabase ni Docker disponibles. Tampoco se verificaron SMTP, entrega de invitaciones, Realtime remoto, carreras multiconexión o instalación en dispositivos físicos. No interpretes las pruebas SQL embebidas como confirmación de esas integraciones.

## PWA y despliegue

Manifest, iconos 192/512 px, máscara y Apple Touch Icon están incluidos; se regeneran con `node scripts/generate-icons.mjs`. Android/computadores compatibles ofrecen instalación cuando el navegador lo permite. En iPhone: Safari → Compartir → Agregar a inicio.

El service worker guarda exclusivamente la página pública sin conexión y los iconos. No almacena HTML operativo, respuestas API, archivos privados ni sesiones. No hay cola de sincronización. Al cerrar sesión se eliminan la sesión y los datos temporales del navegador; el tema puede conservarse. Los formularios abiertos se mantienen en memoria mientras no se recargue/cierre la página. Una escritura sin conexión nunca se presenta como guardada.

Al actualizar `public/sw.js`, incrementa el nombre `CACHE` y reconstruye. El nuevo worker espera y muestra un aviso: el usuario guarda primero sus formularios y pulsa Actualizar. El ciclo de actualización entre dos despliegues distintos requiere verificación adicional en el entorno final.

Para desplegar, usa un alojamiento con runtime Node.js compatible con Next.js (no un export estático):

```sh
npm ci
npm run build
npm run start
```

Configura las variables de servidor/públicas en el alojamiento, HTTPS, origen exacto y las URLs de Auth antes del build. Si usas proxy inverso, limita los cuerpos de `/api/files` a 6 MB y conserva correctamente el origen/host. No caches respuestas autenticadas en el CDN. Valida primero en staging con cuentas por rol, correo real e imágenes; revisa políticas y entrega de correo. **No se efectuó despliegue con esta entrega.**

## Límites conocidos de la primera versión

- Un único espacio operativo; no hay multiempresa, asistencia, remuneraciones, inventario, reportes, notificaciones ni solicitudes de cambio. No se muestran accesos a esos módulos.
- Equipo paginado de 50 perfiles; selectores del equipo acotados a 500. Calendario acotado a 1000 registros por consulta: si se alcanza el límite se informa un error, sin presentar un calendario parcial como completo. Para equipos mayores se deben ampliar las consultas de selectores.
- Tareas/bitácora: 50 registros por página; auditoría: 20; comentarios: 50. El resumen de bitácora se refiere a los registros visibles en la consulta y sus permisos, no a un reporte global. Los indicadores del dashboard conectado usan agregados de PostgreSQL.
- Los adjuntos de un detalle se limitan a 50; el texto de bitácora/tareas no es búsqueda de texto completo. Las nuevas ausencias pueden usar tipos escritos por el administrador, sin catálogo administrable separado.
- No hay arrastre de turnos ni exportación; todas las operaciones implementadas usan botones y formularios.
- `npm audit --omit=dev` no reportó vulnerabilidades en la verificación. El árbol de herramientas de desarrollo reportó 16 avisos moderados derivados de `minimatch`; no se aplicaron degradaciones incompatibles sugeridas por `npm audit --force`.

Consulta `docs/VERIFICACION.md` para el resultado concreto de los controles de esta entrega y `docs/ETAPAS.md` para el inventario por etapa.
