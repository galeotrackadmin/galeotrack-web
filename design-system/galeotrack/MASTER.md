# GaleoTrack · Sistema de diseño

## Dirección aprobada

La identidad utiliza el logotipo plateado de GaleoTrack y la dirección fotográfica azul noche del landing, extendida a toda la web por petición del usuario. Login, registro, módulos, reportes y administración combinan fotografía ambiental, superficies oscuras y acentos azul claro. La composición del landing está documentada en `pages/landing.md`; los espacios de trabajo en `pages/workspaces.md`. El reporte requiere perfil de buzo/pescador o administrador; solo el administrador revisa.

## Fuente de verdad

Los tokens están en `app/globals.css`, expuestos a Tailwind CSS 4 mediante `@theme inline`. Los estilos de autenticación están en `components/layout/auth.css` y consumen los mismos tokens.

| Uso | Token | Valor |
| --- | --- | --- |
| Fondo | background | #020D1C |
| Tarjetas | surface | #0C1828 |
| Texto | foreground | #F5F8FC |
| Texto secundario | muted | #BDCDDD |
| Acción principal / enlaces | primary | #91BFDF |
| Texto sobre acción principal | on-primary | #020D1C |
| Hover principal | primary-hover | #B9D8EE |
| Superficie suave | soft | #16283B |
| Bordes de superficies | border | #2C4055 |
| Bordes de campos | control-border | #71879E |
| Títulos (alias de texto heredado) | ocean | foreground |
| Superficie de marca | ocean-deep | #020D1C |
| Texto inverso secundario | ocean-text | #BDCDDD |
| Acento gráfico / foco | accent / cyan | #91BFDF |

Estados: `success`, `warning`, `danger`, `info`, cada uno con texto pastel contrastado, superficie oscura y borde. Siempre acompañados de iconos y texto. Verde, ámbar y rojo se reservan para significado funcional. Las acciones principales usan azul claro con texto azul noche. No usar `surface` como color de texto inverso; usar `foreground` o `on-primary` según el fondo.

## Marca e imágenes

- Original: `public/images/brand/galeotrack-logo.png`. Se conserva sin modificaciones.
- Interfaz: `public/images/brand/galeotrack-logo.webp`, 960 × 225 px; recorte de margen transparente y optimización WebP.
- `components/layout/brand.tsx` es el único componente de marca: `next/image`, dimensiones intrínsecas, `sizes`, carga inmediata y altura automática. Ancho visible de 200 px en móvil y 220 px en escritorio.
- El acabado plateado se presenta siempre sobre azul profundo, tanto en el acceso como en las cabeceras públicas y administrativas. No añadir otro texto «GaleoTrack» junto a la imagen.
- El logo no lleva el lema «Observar. Conocer. Proteger.». El footer compartido es oscuro, con copyright «© 2026 Galeo Track. Todos los derechos reservados.» y enlaces de navegación.
- `app/favicon.ico`, `app/icon.png` y `app/apple-icon.png` utilizan el símbolo central del original, con espacio de seguridad y fondo azul. No reducir el logotipo completo a favicon.

## Tipografía y geometría

- Geist para interfaz; Geist Mono para coordenadas. Cuerpo 16 px, secundarios 14 px y metadatos 12 px.
- Escala de espaciado de 4/8 px. Contenedor de trabajo de 1280 px; formulario de 880 px; contenido del login de 420 px.
- Botones de al menos 48 px de alto con forma de píldora, campos de 52 px con radio de 12 px y tarjetas de 20 px.
- Sombras suaves, bordes discretos y una única familia de SVG de trazo 1.7.
- Transiciones de 200 ms, sin desplazamientos en hover. Respetar `prefers-reduced-motion` en todo el sitio.

## Componentes y composición

- `components/ui`: Button, FormField, Input, Select, Textarea, Card, Alert, StatusBadge y estados de carga.
- `components/layout`: Brand, SiteHeader, SiteFooter, PageHeading, SectionLinks y AuthShell.
- `SiteHeader` es la cabecera compartida de portada, módulos, reporte, administración y pantallas de error. El contenido estático se compone con `SiteHeaderShell`, una isla cliente para el desplegable. La base móvil muestra marca y botón «Menú» de 44 px, con navegación, acciones de cuenta y accesos por perfil dentro del panel. Se cierra con Escape, al pulsar un destino, al tocar/enfocar fuera o al pasar a escritorio; Escape devuelve el foco al botón. Desde 1200 px muestra enlaces visibles y los accesos por perfil en una segunda fila. Fondo azul casi negro al 82 %, desenfoque de 20 px, radio de 12 px y `position: sticky`.
- `PageHeading`: cabecera fotográfica con degradado, título, descripción y acciones opcionales. `SectionLinks`: navegación mediante tarjetas fotográficas.
- Login/callback: panel fotográfico y área de acceso; reporte: cabecera compacta y formulario por secciones; administración: fotografía, métricas, listado y accesos a la comunidad.
- `auth.css` contiene solo composición, fotografía y elementos exclusivos del acceso. Botones, campos, etiquetas, alertas e indicadores de carga usan `components/ui` y sus estilos globales.
- Las pantallas de acceso presentan el título y el formulario directamente: se retiraron «Espacio de trabajo», «Acceso seguro», el enlace «Conoce el proyecto y sus tres modos» y `auth-heading-icon`, junto con sus contenedores y estilos.
- Las cabeceras oscuras usan foco cian, enlaces activos de fondo blanco y botones de cuenta blancos con texto oscuro.
- Microinteracciones del navbar: subrayado que se revela con `scaleX`, superficie azul translúcida y brillo discreto al pasar el cursor o enfocar un enlace. Registro/cierre de sesión usan halo suave y reflejo de 280 ms; el logo admite un brillo leve. No cambian posiciones ni dimensiones. El hover se limita a dispositivos con puntero preciso; teclado, toque y movimiento reducido mantienen feedback accesible.
- El listado administrativo mantiene la información principal visible y presenta coordenadas, tamaño, comportamiento y notas en un elemento nativo `details` accesible con teclado. Los campos ausentes se explican sin confundirlos con cero.
- Los componentes y hooks exclusivos de una ruta viven en sus carpetas `_components` y `_hooks`. Los recursos de marca están en `public/images/brand`, no en `components`.
- Nuevas páginas deben usar estos componentes. No crear paletas, botones o mensajes independientes por ruta.
- `SiteFooter` usa una columna móvil, marca en una fila superior a partir de 768 px y tres columnas desde 1024 px. «Fundadora» y «Alexandra Marrero Zambrana» pertenecen al bloque de marca, bajo la descripción. Contacto identifica teléfono, correo de la fundadora y administración; los enlaces tienen al menos 44 px de alto.
- Foco visible, etiquetas asociadas, errores descriptivos, anuncios de resultados y alternativas de teclado para el mapa.

## Criterios de revisión

Validar 375/768/1024/1440 px, orientación horizontal, zoom de texto, teclado, carga y errores. Mantener contraste de texto normal ≥4.5:1 y objetivos táctiles ≥44 px. Reservar espacio del mapa y las cargas asíncronas.

## Base de la recomendación

Se consultó UI/UX Pro Max para sistemas de diseño, dashboards, accesibilidad y Next.js. La dirección explícita del usuario —extender el landing a toda la web— prevalece sobre las sugerencias genéricas de verde y otras tipografías de la base de datos. La implementación de Next.js sigue la documentación local de la versión instalada.
