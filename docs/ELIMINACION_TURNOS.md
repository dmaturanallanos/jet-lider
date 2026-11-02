# Eliminación de turnos

El administrador puede abrir un turno desde la cuadrícula o la agenda y pulsar **Eliminar turno**, seguido de **Confirmar eliminación**. La operación afecta únicamente a esa ocurrencia; no elimina las demás de una serie. Para conservar el turno visible con estado cancelado, sigue disponible **Editar o cancelar turno**.

La acción del servidor exige sesión y rol administrador, valida UUID y versión, y utiliza el cliente de sesión sujeto a RLS. La política `admin_write` existente de `shifts` restringe también las solicitudes directas. La eliminación compara la versión para no borrar silenciosamente una edición posterior. Si el turno está vinculado a la bitácora, la clave foránea impide borrarlo y la interfaz propone cancelarlo. El trigger existente genera el historial de eliminación con actor y datos anteriores. No se requiere migración nueva ni modificación de tipos.

La interfaz bloquea el envío sin conexión, deshabilita la confirmación mientras guarda, mantiene el mensaje de error y actualiza el calendario tras el éxito. El modo demostración continúa siendo de solo lectura.

## Verificación

- TypeScript, ESLint y build de producción: correctos.
- 52 pruebas locales aprobadas; una integración con Supabase local omitida por falta de plataforma local.
- Pruebas SQL nuevas: administrador frente a trabajador, auditoría, versión obsoleta y vínculo de bitácora protegido.
- Dos pruebas Playwright (escritorio y celular): acceso al botón desde el detalle y prevención de borrados en demostración. Estas pruebas no borran datos de producción.

## Mantenimiento autorizado

El propietario solicitó vaciar los turnos de Jonathan San Martín. Se verificó el identificador y nombre exactos del trabajador, la versión de los registros y la ausencia de vínculos de bitácora. Se eliminaron sus 43 turnos futuros, de noviembre y diciembre de 2026, mediante una única solicitud limitada a los identificadores revisados, trabajador y versión. La consulta posterior confirmó cero turnos restantes y 43 registros de auditoría DELETE. La auditoría de esta intervención de mantenimiento utiliza el contexto de servicio, sin atribuirla artificialmente a una sesión del administrador. Se guardó una copia de respaldo local dentro de `artifacts/`, ignorada por Git; no se subió al repositorio. No se modificaron trabajadores, ausencias, tareas ni turnos de otras personas.
