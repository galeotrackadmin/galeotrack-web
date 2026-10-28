# GaleoTrack como aplicación instalable

## Arquitectura

La PWA usa APIs nativas: manifest de Next.js App Router, Service Worker y Cache Storage.
No incorpora plugins de webpack, Serwist, Workbox, notificaciones ni sincronización de escrituras.
Funciona con el build existente de Next.js 16 y Turbopack y está preparada para Vercel.
La aplicación conserva su tema oscuro, autenticación Supabase/PKCE y autorización RLS.

### Archivos

- `app/manifest.ts`: identidad estable, alcance `/`, inicio `/`, iconos y ventana standalone.
- `lib/pwa/config.ts`: marca y condiciones de las imágenes de arranque Apple.
- `lib/pwa/platform.ts`: tipos y pistas de plataforma, únicamente para instrucciones.
- `lib/pwa/worker.js`: fuente del Service Worker y política de caché.
- `lib/pwa/update-safety.ts`, `use-update-guard.ts`: bloqueo de actualización durante trabajo pendiente, solo en memoria.
- `scripts/build-pwa.mjs`: genera `public/sw.js` con una revisión única en cada `npm run build`.
- `scripts/generate-pwa-assets.mjs`: genera los PNG de marca a partir de `public/images/brand/app_logo.png`, sin modificar el original.
- `public/pwa/`: iconos `any` y `maskable`, pantalla offline y arranques Apple.
- `public/offline.html`: fallback autónomo, sin React, Supabase, sesión ni datos del usuario.
- `components/pwa/`: registro, instalación, instrucciones, avisos y estilos.
- `playwright.pwa.config.ts`, `tests/pwa/`, `tests/pwa.test.mjs`: pruebas de producción y políticas de seguridad.

El root layout conserva Server Components; solo el coordinador PWA es cliente.
El botón reutilizable se monta una sola vez en el root layout como un acceso flotante en la parte inferior derecha, también en móvil. No ocupa espacio en las cabeceras ni en el pie de acceso.
Utiliza `IconDownload` e `IconX` de Tabler. Empieza como un círculo de 56 px; tras 600 ms se abre horizontalmente para mostrar «Instalar» y vuelve a contraerse a los 3,2 s. La apertura usa transiciones de 200 ms sobre `clip-path`, `transform` y `opacity`, sin animar el ancho ni deformar el contenido.
El hover de ratón y el foco de teclado vuelven a abrirlo y revelan la X. En pantallas táctiles, el primer toque sobre el círculo contraído lo expande y un segundo toque en Instalar ejecuta la acción; tocar fuera lo contrae. Con movimiento reducido no se reproduce la explicación automática. El posicionamiento es `fixed`, de modo que mantiene su posición al hacer scroll.
Respeta safe areas y permite cerrar la promoción durante la sesión de la pestaña, incluso al recargar. Solo se guarda esa preferencia temporal en `sessionStorage`, nunca datos de usuario.
Se oculta mientras se interactúa con un formulario o campo para no interferir con el teclado ni con los botones de envío, y deja espacio estable al final del documento para alcanzar los controles que queden debajo.
Los avisos de conexión y actualización siguen en el flujo del documento, antes del contenido.

Archivos existentes integrados o ajustados:

- `app/layout.tsx`, `components/layout/site-header-shell.tsx`, `workspace-header.tsx`, `auth-shell.tsx`.
- `app/(public)/report/_components/report-form.tsx`, `app/admin/_hooks/use-admin-dashboard.ts`.
- `components/account/account-settings.tsx`, `components/auth/access-gate.tsx`.
- `components/community/publications.tsx`, `species-catalog.tsx`, `obis-imports.tsx`, `scientist-requests.tsx`.
- `next.config.ts`, `package.json`, `eslint.config.mjs`, `.gitignore`, `README.md`.

No se añaden dependencias npm. La pantalla offline utiliza una fuente de sistema para no depender de la carga de fuentes de Next.js; la aplicación mantiene Geist.

## Instalación

El botón muestra el diálogo nativo **solo si el navegador entrega `beforeinstallprompt`**.
El evento se consume una sola vez; cancelar no se presenta como error.
Aceptar el diálogo no equivale a instalación completada: el éxito se confirma mediante `appinstalled` cuando el navegador lo emite.
Cuando no hay evento, el botón abre instrucciones accesibles; nunca intenta imitar un diálogo del sistema.
El acceso flotante aparece sin abrir un modal ni mover el foco. No se inicia el diálogo del sistema automáticamente ni hay recordatorios periódicos. Puede ocultarse con la X durante la sesión de la pestaña. No se guarda un indicador permanente de «instalado», que quedaría incorrecto después de desinstalar.

| Plataforma | Comportamiento y límites |
| --- | --- |
| Android / Chrome, Samsung Internet y compatibles | Diálogo nativo cuando se recibe el evento; alternativa desde el menú. WebAPK o acceso directo depende del navegador, dispositivo y servicios del sistema. |
| iOS / iPadOS | Compartir → Añadir a pantalla de inicio; activar «Abrir como app web» si aparece. No admite `beforeinstallprompt`. Algunos navegadores permiten añadir desde su propio menú; si falta, usar Safari. |
| Windows 10/11 / Chrome y Edge | Diálogo nativo o instalación desde barra de direcciones/menú. Las políticas de la organización pueden impedirlo. |
| macOS / Safari | Añadir al Dock desde Compartir o Archivo; requiere macOS Sonoma o posterior. No hay diálogo de instalación iniciable por JavaScript. |
| macOS y Linux / Chromium | Instalación desde diálogo compatible o menú del navegador. La integración con el sistema varía. |
| Otros navegadores, modo privado y navegadores embebidos | Pueden carecer de instalación o almacenamiento persistente. La web sigue disponible; abrir en un navegador compatible si es necesario. |

El botón se oculta en standalone, en modo fullscreen compatible y tras `appinstalled` durante la sesión.
Desde una pestaña normal no hay una API universal para saber si ya existe una instalación en el sistema.
Las instalaciones de distintos navegadores y orígenes no se identifican entre sí.

Android/Chromium construye su splash con el manifest. Apple dispone de PNG condicionales para los tamaños enumerados en `APPLE_SCREENS`; otros tamaños usan el arranque que decida el sistema.
Los iconos maskable tienen fondo opaco y el símbolo dentro de la zona segura. Apple usa el icono existente de 180 px.

## Offline y datos privados

El worker solo se registra en **producción** y en contexto seguro. HTTPS es obligatorio en el despliegue; `localhost` y loopback son excepciones para pruebas locales.

| Petición | Política |
| --- | --- |
| `/offline.html`, CSS/JS offline y un icono | Precaché de cuatro recursos públicos, sin credenciales. Si alguno falla o redirige, no se instala la versión nueva. |
| JS, CSS y fuentes de `/_next/static/` | Caché bajo demanda por URL completa/hash. Máximo 64 entradas, 2 MiB por entrada. Solo respuestas 200 locales, no redirigidas, sin `private`, `no-store` o `Vary: *`. |
| Navegaciones de documento | Red, sin guardar HTML. Ante fallo de red se sirve la pantalla offline. Los errores HTTP no se disfrazan como éxito offline. |
| RSC, prefetch, API, login/registro, recuperación, callback OAuth | Sin intervención de caché del worker. Nunca reciben HTML offline como si fuera una respuesta de datos. |
| Supabase, enlaces firmados, mapas externos y cualquier petición a otro origen | Sin intervención del worker; no se guardan en su Cache Storage. |
| POST y otras escrituras, Authorization, Range | Excluidas del worker. No hay cola offline ni reenvío automático. |

No se precachea `/`, `/admin`, `/report`, datos científicos, contactos, tokens, borradores ni evidencia.
Esta política de Cache Storage no sustituye las políticas HTTP de terceros ni el almacenamiento de sesión que ya administra Supabase.
Las cabeceras propias de API usan `private, no-store`; no se cambia la configuración de autenticación.

El usuario necesita haber visitado la aplicación con conexión y completado la instalación del worker para disponer del fallback.
El navegador puede expulsar la caché por falta de espacio; no se garantiza disponibilidad offline permanente.
La pantalla offline informa de las limitaciones y ofrece reintento manual. No recarga al reconectar.
Una página abierta conserva su estado en memoria mientras no se cierre, recargue o termine su sesión; **no hay borradores persistentes offline**.
Volver a una ventana instalada sin conexión no provoca la comprobación de perfil por foco que desmontaría un formulario abierto.

## Actualizaciones

`/sw.js` mantiene una URL estable, pero su revisión cambia en cada build. Se sirve con `no-store` tanto para navegador como CDN, y el registro usa `updateViaCache: 'none'`.
El navegador comprueba actualizaciones y el coordinador también lo hace al entrar/regresar, con un límite de una comprobación por hora.
Una versión nueva espera; nunca se ejecuta `skipWaiting()` durante la instalación.

El aviso permite **Actualizar** o **Más tarde**. Actualizar:

1. Comprueba conexión, operaciones activas y guardas de reportes, cuenta, publicaciones, catálogo, importaciones y revisiones.
2. Si hay trabajo pendiente, solicita guardar o cancelar; no descarta datos.
3. El worker verifica que no haya otras ventanas de GaleoTrack en su alcance; si existen, pide cerrarlas.
4. Solo después de la acción explícita activa la versión y recarga la ventana solicitante.

Las otras ventanas nunca se recargan automáticamente. Sin aceptación, el ciclo normal activa el worker cuando se cierran todos sus clientes.
La limpieza solo afecta cachés con prefijo `galeotrack-pwa-`, no otras aplicaciones del origen.
El HTML no se cachea, por lo que posponer el worker no congela indefinidamente los documentos de la aplicación.
Una pestaña antigua puede requerir recarga voluntaria si el despliegue deja de servir sus chunks; evaluar Skew Protection de Vercel según el plan contratado.

## Desarrollo, build y pruebas

```bash
npm run dev              # Sin registro del worker: evita interferencias con HMR
npm run lint
npm run typecheck
npm test
npm run build            # prebuild genera public/sw.js automáticamente
npm run test:pwa         # Arranca next start en 127.0.0.1:3200; requiere build previo
npm run test:e2e         # Regresión existente contra next dev, puerto 3100
```

Los resultados PWA se guardan en `test-results-pwa/`, separados de la regresión existente en `test-results/`.
Para probar manualmente el build: `npm start`, abrir `http://localhost:3000` y revisar Application → Manifest / Service Workers / Cache Storage en DevTools.
Después de probar producción, usar otro puerto/origen para desarrollo o retirar **solo el registro de GaleoTrack** en DevTools; el código no borra registros ajenos automáticamente.
Para regenerar recursos de marca: `npm run pwa:assets` (Node 24 y Chromium de Playwright instalado). No es necesario en el build de Vercel.

Las pruebas PWA comprueban manifest/cabeceras, instrucciones y teclado/Axe, standalone y diálogo simulado, offline real de Chromium, caché sin rutas privadas y actualización real entre dos workers mediante proxy local.
Incluyen bloqueo con dos ventanas y un reporte sin guardar. Las pruebas de autenticación usan respuestas simuladas, nunca credenciales reales ni escrituras remotas.
Simular `beforeinstallprompt` o standalone comprueba nuestra lógica, **no acredita instalación nativa real**.
Lighthouse ya no mantiene la categoría PWA: usar Application de DevTools para instalabilidad y Lighthouse para rendimiento/accesibilidad. Los Core Web Vitals reales requieren medición de campo.

## Despliegue en Vercel

1. Configurar el proyecto como Next.js, Node 24 y Build Command **`npm run build`**, no `next build` directo (omitiría `prebuild`).
2. Configurar las variables públicas de Supabase antes de compilar, como indica el README.
3. Elegir un origen de producción estable y HTTPS antes de distribuir la instalación. Cambiar de dominio implica otra instalación y otro almacenamiento.
4. Autorizar ese origen y los callbacks PKCE en Supabase sin ampliar comodines innecesariamente.
5. Verificar en el despliegue que manifest, iconos, fallback y `/sw.js` devuelvan su contenido real, no un login de Deployment Protection ni una redirección.
6. Revisar las cabeceras de `/sw.js` y de `/api/places`; no añadir reglas CDN que las contradigan.
7. Probar dos despliegues consecutivos desde el mismo dominio para verificar el aviso de actualización.

Un teléfono que abre una IP local por HTTP **no** obtiene la excepción de `localhost` del ordenador. Usar HTTPS con certificado confiable o un despliegue de prueba accesible por HTTPS.
La sesión puede no compartirse entre navegador y app instalada; iniciar y terminar cada flujo OAuth en el mismo contexto. Verificar Google/Microsoft y recuperación en dispositivos reales después de configurar el dominio.

## Verificación física pendiente de cada lanzamiento

- Android: Chrome/Samsung Internet/Edge, instalación o tipo de acceso directo, ventana independiente, GPS y cámara.
- iPhone y iPad: Compartir, añadido al inicio, arranque, notch, landscape, teclado y retorno OAuth.
- Windows: Chrome/Edge, instalación, reapertura y varias ventanas.
- macOS: Safari/Añadir al Dock y Chrome/Edge; comprobar aislamiento de sesión.
- Linux: instalación y apertura desde Chromium compatible.
- En todos: offline/reconexión, logout, sesión expirada, formulario sin guardar y actualización con varias ventanas.

La emulación de Playwright no sustituye estas comprobaciones; no se afirma que se hayan realizado físicamente.
