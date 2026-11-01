# Corrección del acceso y recuperación

Se verificó que la cuenta administradora indicada existe, tiene correo confirmado, no está bloqueada y coincide con el único perfil administrador. La versión pública apunta al proyecto y clave pública correctos. No se obtuvo ni se probó la contraseña del propietario.

Problemas corregidos:

- El ingreso rechazaba contraseñas existentes de menos de doce caracteres por una validación de creación aplicada al login. Se deja que Supabase valide la contraseña existente.
- Todos los errores de contraseña se convertían en el mismo mensaje. Ahora se distinguen credenciales incorrectas, correo pendiente, bloqueo y límites de intentos, sin registrar contraseñas ni correos.
- Se agregó «Olvidé mi contraseña» y la pantalla de restablecimiento. Se exige una contraseña nueva de al menos doce caracteres y confirmación coincidente.
- Se admiten enlaces por PKCE, token hash y fragmentos de recuperación. Los fragmentos se eliminan del historial al leerlos, y un enlace que llegue al inicio se deriva a la pantalla correspondiente.
- Se corrigió una diferencia de hidratación del icono de tema detectada durante las pruebas.

Verificación local: TypeScript, lint, build, 50 pruebas de reglas/SQL/imágenes y 20 pruebas de navegador en escritorio y móvil. La integración de concurrencia con Supabase local sigue omitida por falta de plataforma local.

Configuración remota observada: Supabase no aceptó `/restablecer-contrasena` como destino adicional y resolvió la redirección a la Site URL existente, que corresponde a un alias de producción de esta misma aplicación. La corrección admite esa llegada al inicio; se recomienda agregar la URL canónica de restablecimiento y actualizar la plantilla Reset Password como indica el README.

Esta nota describe el cambio preparado. No acredita por sí sola un despliegue ni la entrega de un correo; esas operaciones deben verificarse por separado.
