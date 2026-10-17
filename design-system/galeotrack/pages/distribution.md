# Patrones de distribución · página pública mobile-first

## Composición

- Identidad azul noche, Geist, marca, navbar y footer compartidos con la portada.
- Presentación breve → mapa verificado → interpretación de registros y líneas de análisis → guía de identificación → referencias → invitación a reportar.
- `SiteHeader active="distribution"` señala el destino activo. La página pública no muestra herramientas de revisión ni enlaces al panel administrativo.

## Mapa

- `PublicTracker compact`: misma interacción y estilos que la portada.
- Sin toolbar, filtros, sidebar, listado ni selector de capas.
- Fondo oceánico, botones +/− de 44 px, fichas de avistamientos y selector para registros en coordenadas superpuestas.
- Alturas de 320 px en móvil, 400 px desde 768 px y 480 px desde 1200 px.
- Carga, vacío y error con reintento; atribución visible y desplazamiento táctil de la página sobre el mapa.

## Información y recursos

- El mapa representa reportes comunitarios verificados; una zona sin marcadores no implica ausencia de tiburones.
- La integración con registros históricos de OBIS se comunica explícitamente como pendiente.
- Las tarjetas describen líneas de análisis previstas. No se presentan porcentajes ni resultados agregados inexistentes.
- La guía NOAA conserva su destino PDF y usa un botón táctil adaptable al ancho disponible.
- Referencias disponibles mediante `details/summary` nativo: apertura por toque o teclado, bibliografía con interlineado cómodo y ajuste de textos y DOI largos.
- Reportar un avistamiento enlaza a `/report` al final de la página.

## Responsive y accesibilidad

- Una columna como base; ampliaciones exclusivamente con `min-width` en 768, 1024 y 1200 px.
- Texto principal de 16 px, interlineado 1.65 y medida de lectura de 65–75 caracteres.
- Espaciado de 16/24/32/40/48/64 px; títulos fluidos, objetivos táctiles ≥44 px y foco visible.
- Validar 360/375/390/412/430/768/1024/1366/1440/1920 px; orientación horizontal, texto al 200 %, teclado, menú, fichas y puntos superpuestos.
