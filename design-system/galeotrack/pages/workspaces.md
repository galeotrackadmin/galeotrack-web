# Espacios de GaleoTrack · continuidad fotográfica

## Alcance

Dirección aprobada: toda la web comparte el fondo azul noche, las fotografías,
la tipografía y los controles del landing. Incluye login, registro, callback,
estudiante, científico, comunidad, revisión, gestión, reporte y pantallas de cuenta.

## Composición

- `WorkspaceHeader` reutiliza `SiteHeader` de la portada: navbar flotante, persistente, oscuro, ligeramente transparente y desenfocado. Inicio lleva a `/#inicio` y Sobre Nosotros a la sección del proyecto; el rol y Cerrar sesión se integran en la primera fila. Mis espacios y las herramientas de revisión permanecen accesibles en una segunda fila. Los destinos internos reservan espacio para la cabecera.

- `PageHeading` presenta la fotografía ambiental con un degradado oscuro y una
  columna legible de título, descripción y acciones. La cabecera es compacta;
  los paneles de datos usan fondos sólidos.
- Los modos y revisión usan `PageHeading compact`, con títulos «Modo Estudiante», «Modo Científico», «Modo Pescador Buzo» y «Panel de revisión». `workspace.css` contiene la composición base móvil y ampliaciones con `min-width` en 768/1024/1200 px.
- Estudiante: `student.webp`; científico y solicitudes: `scientist.webp`;
  comunidad y reportes: `diver.webp`; gestión y perfil: `coral.webp`;
  administración y autenticación: `ocean-shark.webp`.
- Los tres modos y el panel de revisión usan `SectionLinks compact`: enlaces de 48 px con flecha SVG y sin fotografías repetidas. En móvil son una columna, en tablet dos y en escritorio una fila adaptable. Las otras páginas conservan la variante fotográfica.
- Estudiante prioriza especies y recursos educativos; Científico muestra primero publicaciones propias y borradores; Pescador Buzo destaca el reporte y permite filtrar «Mis avistamientos».
- Administración presenta métricas compactas, filtros y listado de revisión antes del mapa. Aprobar y Rechazar mantienen botones separados y visibles. El filtro, la paginación y las comprobaciones de permisos conservan su comportamiento.
- El catálogo tiene una introducción ambiental con corales. Estas imágenes
  ilustrativas no se atribuyen a especies, publicaciones ni avistamientos reales.
- Login y registro comparten un panel oceánico. En móvil se conserva una
  introducción fotográfica breve y se prioriza el formulario.
- Estados vacíos, cargas, alertas y campos heredan los tokens oscuros. El mapa
  conserva sus teselas cartográficas y adapta sus controles al tema.
- Registro: siete secciones numeradas; opciones con radios y casillas de 48 px,
  campos condicionales para «Otro» y contacto, medidas opcionales en pies y
  evidencia con vista previa. Los datos desconocidos no se muestran como cero.
- Mapas de consulta: puntos de 44 px agrupados por zoom, etiquetas de estado,
  tarjetas persistentes con clic/Enter/toque, cierre por Escape y selector para
  puntos superpuestos. Las tarjetas se encuadran sin animar el mapa bajo el cursor.
- Mapas y estados de carga reservan 320/400/480 px según viewport. La ficha tiene altura limitada y desplazamiento accesible por teclado. El mapa permite scroll vertical de la página con puntero táctil y mantiene zoom y leyenda de estados.
- Los filtros, los botones de actualizar y las acciones del editor se apilan en móvil; los párrafos de fichas educativas y publicaciones usan 16 px. El editor de publicaciones tiene un área de contenido inicial moderada y acciones de guardar/cancelar a todo el ancho.
- Las anclas internas reservan el espacio del navbar; se elimina la interferencia de offsets de 24 px sobre títulos.

## Accesibilidad y rendimiento

- Texto normal con contraste mínimo 4.5:1, controles de al menos 44 px,
  foco visible y estados acompañados por texto e iconos.
- Imágenes locales WebP mediante `next/image`: cabecera con carga inmediata,
  tarjetas con carga diferida, `sizes` y contenedores de altura reservada.
- Imágenes ambientales decorativas con `alt=""`; imagen educativa con descripción.
- Revisar 360/375/390/412/430/768/1024/1366/1440/1920 px, zoom de texto, teclado, movimiento reducido
  y contraste de formularios, alertas, navegación y datos.
