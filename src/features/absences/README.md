# Ausencias

La validación de entrada está en `features/shared/validation.ts`; el formulario se integra en el editor de planificación de `features/shared/forms.tsx`. La operación `save_absence` y los triggers de PostgreSQL guardan el registro y su nota privada de forma atómica y excluyen períodos con turnos. El calendario consulta solamente las ausencias del rango visible. Esta carpeta reserva el límite del módulo para ampliar su interfaz sin separar ahora un editor artificialmente duplicado.
