# MovistarChat

Simulador de formación comercial con interfaz inspirada en una aplicación de mensajería. Practica conversaciones ficticias sobre ventas, facturas, reclamaciones, pedidos, clientes molestos y averías.

## Uso

Abre `index.html` en un navegador moderno y pulsa **Nuevo caso aleatorio**. Se generan escenarios y perfiles ficticios. Cada práctica propone entre 10 y 20 turnos; las respuestas del comercial deben tener al menos tres párrafos, separados por una línea en blanco. Al finalizar, se muestra una evaluación con sugerencias para mejorar la empatía, la resolución y la escritura.

Sin configurar una API, el simulador usa respuestas locales sencillas para que puedas probar la interfaz. Para respuestas conversacionales generadas por IA:

1. Pulsa **Configurar IA**.
2. Indica un endpoint compatible con `POST /v1/chat/completions`, el nombre del modelo y una clave API.
3. Guarda la configuración. La clave se conserva en `sessionStorage` durante la sesión del navegador y se elimina al cerrar la sesión.

El endpoint predeterminado es `https://api.openai.com/v1/chat/completions` y el modelo sugerido es `gpt-4o-mini`; el acceso depende de la cuenta y disponibilidad del proveedor. El endpoint debe permitir solicitudes CORS si se usa directamente desde el navegador.

## Seguridad y alcance

Esta versión es estática y no necesita servidor. Una clave introducida en el navegador se envía directamente al proveedor de IA: no la publiques, no la incluyas en el código y evita utilizar claves sensibles en equipos compartidos. Para desplegar el simulador para un equipo o público, implementa un backend propio que guarde la clave como secreto y actúe como proxy autenticado. La conexión directa puede no funcionar si el proveedor no permite CORS.

Los nombres, perfiles, mensajes, incidencias, importes y escenarios son ficticios. El simulador no se conecta a cuentas, sistemas de atención ni herramientas de Movistar y no confirma tarifas, políticas, pedidos, averías ni plazos reales. Comprueba siempre las condiciones vigentes en los sistemas oficiales durante la formación real.
