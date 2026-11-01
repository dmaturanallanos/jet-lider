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

## Publicación y envío verificados

Con autorización explícita del propietario, el commit `2a1ba0f` se publicó mediante la integración de GitHub con Vercel. El despliegue `dpl_Ht3Z5tKB9zUMLwMBy3hY2HZYL8iz` quedó READY en producción. Se verificaron el botón de recuperación y la pantalla pública en `https://jet-lider.vercel.app`; sin enlace válido no se muestra el formulario de contraseña y no se observaron errores de JavaScript en esa comprobación.

El envío de recuperación por Supabase fue rechazado con `over_email_send_rate_limit` (429). Como alternativa para este envío autorizado, se generó un enlace de recuperación con la API administrativa y se envió exclusivamente al titular mediante Gmail conectado, con el asunto «Jet Líder: restablecer contraseña». Gmail confirmó el envío; no se abrió ni consumió el enlace y no se verificó el cambio de contraseña del titular. No se guardaron tokens de recuperación en el repositorio.

El alias configurado como Site URL requiere iniciar sesión en Vercel, aunque el dominio canónico es público. El correo enviado usa directamente `/auth/confirm` del dominio canónico con un token hash y tipo recovery; evita depender de ese alias. Para los envíos automáticos futuros siguen pendientes ajustar Site URL, Redirect URLs y la plantilla Reset Password según el README, y configurar SMTP o esperar la recuperación de la cuota de correo. No se modificó la configuración remota de Auth.
