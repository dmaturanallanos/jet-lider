# Implementación por etapas

| Etapa | Implementación y módulos | Base de datos | Verificación y dependencias pendientes |
| --- | --- | --- | --- |
| 1 | Estructura App Router, diseño responsive, clientes Supabase, acceso por correo/contraseña y confirmación; `src/lib/supabase`, `features/auth`, `components/ui` | Esquema inicial, RLS, funciones de autorización, administrador único | Tipos, lint y build locales; falta configurar el proyecto y Auth externo |
| 2 | Equipo, ficha privada, alta sin cuenta, invitación recuperable, vinculación y desactivación; `features/workers` | Workers, detalles privados, perfiles e invitaciones; función exclusiva del servicio | SQL de privacidad, vinculación repetida, segundo admin y sesión inactiva; SMTP real pendiente |
| 3 | Calendario semanal/diario/mensual, agenda móvil, múltiples turnos, vacantes, ausencias, copia, recurrencia y edición futura; `features/shifts`, `features/absences`, formularios compartidos | Exclusión GiST, rangos, bloqueo de trabajadores, lotes atómicos, versiones y claves idempotentes | Fechas chilenas, DST, consecutivos, solapamientos, ausencias, lotes y versiones en SQL; carreras entre conexiones reales preparadas y no ejecutadas |
| 4 | Lista/tablero de tareas, responsables múltiples, estado compartido, comentarios, carga/progreso de evidencias; `features/tasks`, `shared/files`, `api/files` | Tasks, assignees, comments y attachments; buckets privados y RLS | Permisos SQL de responsables y archivos; decodificación/compresión probadas; Storage real pendiente |
| 5 | Bitácora diaria/semanal, registros privados, filtros, fijados y edición propia/moderación; `features/logbook` | Entradas, fotos y auditoría de servidor | Privacidad, edición ajena y versiones moderadas probadas en PostgreSQL |
| 6 | Dashboard por rol, próximos turnos, conteos reales, Realtime, tema, navegación y PWA; `features/dashboard`, `features/settings`, `hooks`, `components/pwa` | RPC de resumen y publicación Realtime | Navegación, mobile, tema, caché y offline probados en Chromium; Realtime y dispositivos físicos pendientes |
| 7 | Pruebas críticas, integración local opcional, CI, documentación, demo y mantenimiento | Seed manual separado y migraciones reproducibles | Ver `VERIFICACION.md`; sin credenciales externas, sin cambios remotos, sin publicación |

Los formularios de ausencias se comparten con la programación; las reglas de conflicto se implementan en PostgreSQL para que se apliquen también a peticiones directas.
