# Portada · dirección fotográfica

Referencia: PDF proporcionado por el usuario. Portada oceánica oscura y editorial,
con fotografía de fondo, títulos blancos, pasos unidos por una línea, números de
contorno y tres tarjetas fotográficas de perfiles.

## Tracker público · landing mobile-first

- Referencia adicional: `https://www.ocearch.org/tracker/detail/tupelo`.
- La portada utiliza estilos base móviles y ampliaciones con `min-width`: 768 px (tablet), 1024 px (columnas) y 1200 px (escritorio amplio). La presentación breve y el mapa preceden a la explicación completa y la participación.
- La sección de proyecto contiene cuatro párrafos editoriales en una columna de lectura limitada y con espaciado generoso; el título tiene jerarquía de encabezado principal.
- La descripción breve presenta GaleoTrack como plataforma abierta y colaborativa para personas que interactúan, estudian o sienten interés por el medio marino de Puerto Rico.
- La sección de colaboración presenta a estudiantes, científicos y «Pescador Buzo».
- El mapa de la portada es de ancho completo, sin barra de herramientas, filtros, sidebar, lista, selector de capas ni leyenda superpuesta. Altura: 320 px en móvil, 400 px desde 768 px y 480 px desde 1200 px; máximo 1200 px.
- Fondo oceánico con relieve de Esri, atribución visible, botones táctiles +/− y popup de especie, lugar, fecha/hora, cantidad y coordenadas al seleccionar un avistamiento.
- La selección por marcador y teclado se conserva. El endpoint público solo muestra observaciones verificadas; carga, vacío y error ofrecen mensajes y reintento.
- El mapa compacto encuadra inicialmente Puerto Rico. Con puntero táctil permite el desplazamiento vertical de la página sobre el mapa; mantiene controles +/− y objetivos de 44 px separados por 8 px. Las coordenadas idénticas abren un popup con selector de registros. El popup reserva espacio para el cierre, limita su altura y permite desplazamiento por teclado. Los estados de datos aparecen debajo del mapa para conservar visible la atribución.
- `/patrones-de-distribucion` comparte el mapa compacto de la portada, sin filtros, sidebar ni selector de capas; su composición y recursos están documentados en `distribution.md`.
- Se conservan los tokens de azul noche, Geist, marca original y las secciones de proyecto y perfiles.
- Navbar compartido `SiteHeader`: logo y botón «Menú» en móvil; desplegable vertical de enlaces y acciones, con fondo sólido legible, altura limitada al viewport dinámico y scroll en horizontal. Escape devuelve el foco al botón y el toque exterior cierra. Desde 1200 px se muestran los enlaces directamente. Cabecera sticky con efecto de cristal y espacio reservado para anclas. Los estilos se centralizan en `app/globals.css`.

- Conserva Geist y el logotipo original. La portada usa una sola familia de azul:
  fondo azul noche casi negro `#020D1C`, texto secundario `#BDCDDD` y acento azul claro `#91BFDF`.
  Paneles, bordes y todos los degradados se derivan de esos tokens mediante
  `color-mix`. El footer hereda el mismo azul base para evitar un cambio de tono.
- Cabecera compacta: mínimo de 64 px en móvil y 72 px en escritorio, logo de 160/180 px y controles de al menos 44 px. La navegación del panel usa texto de 16 px, separación de 8 px y etiquetas accesibles.
- El logo no lleva el lema «Observar. Conocer. Proteger.».
- Las fotografías se sirven localmente desde `public/images/landing/`. Fuentes y
  licencia en el README de esa carpeta. No se presentan como actividades propias.
- `next/image`: hero con carga inmediata y `fetchPriority="high"`, resto con carga diferida, `sizes` y contenedores
  de proporción reservada. No hay vídeo, carrusel automático ni paralaje.
- Las tarjetas usan la misma proporción de imagen y alturas iguales por fila.
  El bloque de nota y botón se ancla al fondo. La validación del científico se
  explica **antes** del botón; ninguna tarjeta tiene contenido después de él.
- Las tarjetas y los usos parten de una columna de hasta 560 px y se amplían a tres desde 1024 px. Los objetivos usan una columna móvil, dos desde 768 px y cuatro desde 1200 px. Los párrafos principales son de 16 px, interlineado 1.65–1.7 y ancho de lectura limitado.
- Pie compartido oscuro: «© 2026 Galeo Track. Todos los derechos reservados.»,
  descripción del proyecto y enlaces reales a inicio, login y registro.
- El nombre de la fundadora queda bajo la descripción del proyecto, con la etiqueta «Fundadora». El bloque Contacto distingue teléfono, correo de la fundadora y administración. Una columna móvil, organización de tablet desde 768 px y tres columnas desde 1024 px.
- Verificar 360/375/390/412/430/768/1024/1366/1440/1920 px, teclado, texto al 200 %, contraste y alineación
  geométrica de los tres botones cuando las tarjetas están en columnas.
