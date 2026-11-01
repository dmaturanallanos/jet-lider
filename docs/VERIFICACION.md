# Verificación de la entrega

Fecha: 1 de noviembre de 2026. Entorno: Windows, Node.js 24.15.0. No había repositorio ni código previo, `.env.local`, Docker o plataforma Supabase conectada.

Actualización posterior: se recibieron credenciales, se configuró `.env.local` y se verificaron consultas reales de solo lectura a REST, Auth y Storage. Los resultados y pendientes actuales están en [SUPABASE_ESTADO.md](SUPABASE_ESTADO.md). Las limitaciones indicadas abajo corresponden a las pruebas completas, que todavía no se han ejecutado contra el backend remoto.

## Controles locales ejecutados

| Control | Resultado |
| --- | --- |
| Generación desde PostgreSQL migrado: `node scripts/generate-types.mjs` | Correcto; las diez migraciones se aplicaron en una base embebida vacía |
| `npm run typecheck` | Correcto, TypeScript estricto |
| `npm run lint` | Correcto, sin errores ni advertencias |
| `npm test` | 46 pruebas aprobadas; una prueba Supabase real omitida por configuración externa |
| `npm run test:e2e` | 14 pruebas aprobadas, escritorio y móvil Chromium |
| `npm run build` | Correcto, build de producción de Next.js 16.4.3 |
| `npm audit --omit=dev` | Cero vulnerabilidades de producción reportadas |
| Revisión visual | Capturas de calendario en escritorio y agenda móvil inspeccionadas; sin desbordamiento de página en los tamaños probados |

Las pruebas cubren validación de imágenes/cuerpos HTTP, períodos y cambios de horario chilenos, copias/repeticiones, turnos nocturnos y consecutivos, restricciones de superposición, lotes atómicos e idempotentes, ausencias, trabajadores sin cuenta, vinculación repetida, privacidad, administrador único, desactivación con claims previos, permisos de tareas/evidencias, moderación de bitácora, versiones y auditoría. El seed SQL opcional se ejecutó en una base embebida de prueba y rechazó una segunda carga.

Las pruebas de navegador cubren acceso cerrado sin configurar backend, navegación, vistas del calendario, detalle accesible de tareas, demostración de solo lectura, persistencia del tema, manifest/iconos, caché exclusivamente pública y respaldo sin conexión.

## No ejecutado contra servicios reales

- Auth/GoTrue, entrega de invitaciones y SMTP.
- Supabase REST, Storage y firmas de archivos como servicios HTTP reales.
- Realtime conectado a Supabase.
- Solicitudes simultáneas desde conexiones PostgreSQL independientes. El aislamiento, los bloqueos y la exclusión están implementados; el test multiconexión está preparado en `tests/supabase.live.test.ts` y se omitió.
- Instalación física Android/iOS, Safari/WebKit y transición de actualización entre dos despliegues.
- Migración de una base remota existente o despliegue público.

PGlite ejecutó las migraciones y RLS reales con roles/claims de prueba y tablas que representan el contrato SQL de Auth/Storage. Eso valida la lógica SQL, pero no reemplaza las integraciones indicadas. Las pruebas de navegador usaron demostración, no una sesión autenticada contra Supabase.

## Pendientes externos para operar

1. Crear/conectar Supabase, aplicar migraciones y completar `.env.local`.
2. Deshabilitar signup público, configurar SMTP, URL de la aplicación, redirecciones y plantillas.
3. Crear/verificar la cuenta personal del administrador y ejecutar el bootstrap.
4. Ejecutar en un entorno de prueba la integración real, invitar a un trabajador y verificar ambos roles.
5. Validar archivos, Realtime e instalación/actualización PWA en los dispositivos de uso.

Las instrucciones exactas están en el README. No se crearon cuentas externas ni se modificaron bases existentes. El árbol de herramientas de desarrollo conserva 16 avisos moderados de dependencias transitivas; no afectan al resultado del audit de producción y requieren revisar la compatibilidad de la actualización de esas herramientas.
