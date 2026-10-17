# GaleoTrack

Plataforma de conservación marina con espacios de estudiante, científico, buzo/pescador y administrador. Construida con **Next.js 16**, **React 19**, **TypeScript**, **Tailwind CSS 4** y **Supabase**.

## Funcionalidades

- Inicio y cierre de sesión con Supabase Auth: correo y contraseña, Google y Microsoft.
- Landing fotográfica oceánica en `/`, logo sin lema, tarjetas de perfiles con acciones alineadas y pie personalizado «© 2026 Galeo Track».
- Tracker público en la portada, inspirado en la composición de OCEARCH: mapa oceánico/satélite, búsqueda por especie o lugar, filtro temporal y panel de fichas. Muestra registros activos pendientes y verificados; cada tarjeta indica su estado real.
- Registro por correo, confirmación de cuenta y selección de perfil; las cuentas científicas requieren validación administrativa.
- Módulo educativo con fichas de especies, avistamientos y publicaciones científicas.
- Publicaciones con borradores privados, edición de autor, referencias y gestión administrativa.
- Pantalla de acceso adaptable a móvil, identidad visual marina, controles accesibles y opción de mostrar la contraseña.
- Identidad azul noche y fotográfica compartida en toda la web: cabeceras por perfil, accesos con imágenes, formularios oscuros y logotipo optimizado con `next/image`.
- Navbar flotante compartido (`SiteHeader`): fondo oscuro translúcido con desenfoque, esquinas ligeramente redondeadas y navegación persistente. Los módulos mantienen sus accesos por perfil y cierre de sesión.
- Formulario autenticado en `/report` para científicos aprobados, buzos/pescadores y administradores: actividad del colaborador, fecha/hora, GPS, especies, cantidad, medidas en pies, sexo, comportamiento, salud y evidencia opcional.
- Mapas interactivos de avistamientos en los cuatro modos, con agrupaciones, tarjetas al pasar el cursor o tocar, filtros y fichas completas. Los puntos no dependen de la página del listado.
- Acceso social con PKCE, callback dedicado y mensajes para cancelaciones, enlaces caducados y perfiles sin permisos.
- Revisión de avistamientos exclusiva del rol `admin`; el administrador también accede a los tres modos.
- Contadores globales de pendientes, verificados y rechazados, calculados mediante consultas de conteo exacto.
- Filtro por estado y paginación de 10 registros, ordenados del más reciente al más antiguo, con desempate por ID.
- Revisión de registros pendientes con identificación del revisor y fecha de revisión.
- Protección frente a envíos duplicados y revisiones concurrentes: la actualización exige que el registro siga en estado `pending` y comprueba la fila devuelta.
- Estados de carga, mensajes de resultado y reintentos para errores de consulta.
- Detalles desplegables de cada avistamiento: tamaño estimado, coordenadas, comportamiento y notas, accesibles con teclado.

## Requisitos y configuración local

- Node.js **24 LTS** y npm. Las pruebas usan el soporte nativo de TypeScript de Node, sin un ejecutor adicional.
- Un proyecto de Supabase con autenticación por correo y contraseña y las tablas descritas abajo.
- Aplicar la migración de perfiles y permisos descrita abajo. Una cuenta `admin` permite validar científicos y gestionar contenido.

Instala las dependencias:

```bash
npm ci
```

Crea `.env.local` en la raíz con los valores públicos de tu proyecto:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_CLAVE_ANON_PUBLICA
```

El cliente del navegador utiliza la clave pública `anon`. Las variables `NEXT_PUBLIC_*` se incorporan al bundle durante la compilación; deben estar configuradas también en el entorno de despliegue antes del build.

Arranca la aplicación:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). `/` muestra la landing; `/login` y `/register` permiten acceder y registrarse. Tras el acceso, el perfil determina el destino.

## Rutas y permisos

| Perfil | Inicio | Herramientas |
| --- | --- | --- |
| `student` | `/estudiante` | Fichas educativas, avistamientos de todos los estados y publicaciones publicadas |
| `researcher` | `/cientifico` | Consulta y registro de avistamientos, creación y edición de publicaciones propias |
| `community` | `/comunidad` | Estadísticas, listado de reportes, filtro de reportes propios y formulario `/report` |
| `admin` | `/admin` | Revisión de avistamientos, acceso a todos los modos y gestión en `/gestion` |
| `pending_scientist` | `/solicitud` | Estado de validación y nota de revisión, sin acceso a datos de los módulos |
| `unassigned` | `/completar-perfil` | Selección inicial de perfil, habitual en nuevos accesos sociales |

Los borradores solo son visibles para su autor y el administrador. Los avistamientos pendientes y rechazados se muestran diferenciados de los verificados. Las estadísticas cuentan reportes, no individuos. La interfaz comprueba el perfil y las políticas RLS de Supabase autorizan cada consulta o modificación. El perfil del colaborador se obtiene en la base de datos desde la cuenta autenticada al crear el reporte: comunidad → «Pescador / Buzo», científico aprobado → «Científico / Investigador», administrador → «Administrador». El formulario no lo pregunta ni lo envía; los registros anteriores conservan su actividad declarada.

## Migración de Supabase

Archivo: `supabase/migrations/202609280001_community_platform.sql`.

1. Comprueba el esquema existente de `profiles` y `sightings` frente al contrato de datos de este documento. La migración amplía esas tablas, no crea el esquema inicial.
2. Revisa los triggers existentes sobre `auth.users`: un trigger anterior de creación de perfiles debe integrarse o sustituirse por `galeotrack_user_created`, para no competir con la selección de perfiles. Este repositorio no contiene la definición del proyecto remoto.
3. Ejecuta el archivo SQL completo en el SQL Editor de Supabase o mediante tu flujo de migraciones. Está envuelto en una transacción. Sustituye las políticas previas de `profiles` y `sightings` por la matriz actual y retira el acceso anónimo a los datos.
4. Crea o identifica una cuenta de administración en Supabase Auth y asígnale `role = 'admin'` en `profiles` desde una conexión administrativa. No existe autorregistro administrativo.
5. Mantén habilitado el proveedor Email y configura las URLs de retorno descritas en la siguiente sección. Para confirmar correos utiliza la plantilla estándar de Supabase con `{{ .ConfirmationURL }}`; el usuario completa el flujo PKCE en el mismo navegador.
6. Después de las migraciones anteriores, ejecuta `202610150001_account_management.sql`. Añade el historial de cambios de perfil, las funciones seguras para editar el nombre/cambiar el rol y la preparación de eliminación anonimizada.
7. Despliega la función `supabase/functions/delete-account` con `supabase functions deploy delete-account`. La función requiere `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` como secretos del entorno Edge; nunca publiques la clave de servicio en el cliente. Mantén activada la verificación JWT de la función.
8. Ejecuta `supabase/migrations/202610150002_sighting_profile_role.sql` antes de usar la nueva versión del formulario. Actualiza `submit_sighting` para derivar el rol desde `profiles` e ignorar cualquier rol enviado por el navegador. No modifica los reportes anteriores y protege el valor original durante las ediciones y reintentos.
9. Para importar los registros OBIS, ejecuta `supabase/migrations/202610150003_obis_import_batches.sql` antes de desplegar la interfaz de importaciones. Añade tablas privadas de lotes/originales, metadatos de procedencia y fechas parciales, y amplía la proyección pública segura. No inserta ningún dato por sí sola.
10. Para mostrar pendientes y verificados en la portada, aplica `supabase/migrations/202610160002_public_map_review_states.sql` después de la migración de lotes y las anteriores. Devuelve el estado real en la proyección pública, sin modificar ni verificar registros. No vuelvas a aplicar versiones anteriores de `public_map_sightings` después de esta migración.
11. Para activar la gráfica circular de salud en los tres modos de usuario, aplica `supabase/migrations/202610170001_visual_health_statistics.sql` después de `202610160001_sighting_statistics.sql`. Amplía la misma función agregada sin modificar avistamientos ni permisos. No reapliques la definición anterior de estadísticas después; si falta el agregado de salud, la interfaz muestra qué migración se necesita y conserva las demás gráficas.

### Cargar los 115 registros OBIS del Excel

1. Aplica las migraciones anteriores en orden y abre GaleoTrack con una cuenta administradora.
2. Ve a **Gestionar comunidad → Importar datos OBIS** (`/gestion#importaciones`).
3. Selecciona `avistamientos-obis-datos.csv`, en la raíz del repositorio. Es la conversión de la hoja **Datos** de `Occurrence (1).xlsx`: 115 filas, 9 columnas, UTF-8 con BOM. No uses las hojas de resúmenes como observaciones adicionales.
4. Comprueba la vista previa: 31 filas repetidas, 38 sin fecha, 5 fechas parciales, 5 años inválidos (`#VALUE!`) y 45 localidades vacías. Las repeticiones se conservan como posibles duplicados; no son necesariamente observaciones distintas ni individuos adicionales.
5. Pulsa **Importar 115 registros como pendientes** y confirma. El alta es atómica: un fallo revierte todo el lote. Reintentar el mismo contenido, incluso cambiando el nombre del archivo, devuelve el lote existente y no duplica registros.
6. El historial permite **Retirar lote completo** (ocultar sin destruir) y **Restaurar lote** (volver a pendiente de revisión). No afecta otros lotes ni registros comunitarios. Los registros eliminados individualmente antes de retirar el lote no se restauran automáticamente.

El importador no atribuye avistamientos al administrador: `reporter_id` y `collaborator_role` quedan nulos; `created_by` identifica al operador únicamente en el historial privado. Se conserva cada fila original en `sighting_import_rows`, accesible solo a administración. Los nombres científicos se mantienen sin forzar una identificación a especie ni asignar un nombre común.

No se inventan fechas, horas, sexo, salud ni comportamiento. Las fechas de mes/año se guardan con `sighting_date = null`, `source_year`, `source_month` y `date_precision`. Las fechas originales con hora se conservan sin asumir hora local de Puerto Rico. El Excel no aporta identificadores de ocurrencia, licencias, atribución completa ni incertidumbre de coordenadas en esa hoja: cada registro conserva advertencias y requiere cotejo con la fuente original. Con la migración de estados públicos, los registros activos con coordenadas aparecen aunque estén pendientes, con la advertencia «Registro histórico de OBIS. Pendiente de revisión por GaleoTrack.» dentro de su tarjeta. Mostrar un registro no lo verifica ni constituye evidencia de abundancia poblacional.

Para comprobar la carga desde SQL Editor (solo lectura):

```sql
select id, file_name, row_count, duplicate_count, quality_summary, status
from public.sighting_import_batches
order by created_at desc;

select import_batch_id, status, count(*) as registros
from public.sightings
where source_name = 'OBIS' and deleted_at is null
group by import_batch_id, status;
```

La migración añade `publications`, `species_guides`, la autoría de reportes y las funciones `complete_profile` y `review_scientist`. Incluye tres fichas educativas iniciales con fuentes. Los reportes históricos conservan `reporter_id = null` y siguen visibles en la comunidad, sin atribuirlos a una cuenta.

La migración de cuentas añade `/cuenta`, historial de solicitudes de rol y cambio seguro de nombre/rol. Los usuarios no pueden asignarse el rol administrador; el rol científico queda pendiente de revisión. La eliminación requiere una sesión reciente y la confirmación `ELIMINAR`: conserva los datos estructurados de avistamientos sin autor, elimina contactos, texto libre potencialmente identificable, borradores y archivos de evidencia, y desasocia el autor de publicaciones ya publicadas. No se permite autoeliminar perfiles administradores.

Los roles históricos `admin` y `researcher` se conservan; los investigadores dejan de revisar avistamientos. Los perfiles existentes con otros roles hacen fallar la validación para que se mapeen explícitamente antes de aplicar el cambio. El SQL está verificado en PostgreSQL local mediante PGlite; ejecutarlo contra la instancia remota es un paso de despliegue independiente.

### Mapa público de la portada

Aplica las migraciones en orden: proyección inicial (`202610040001_public_tracker.sql`),
CRUD, cuentas, rol del colaborador, lotes OBIS y la proyección actualizada
`supabase/migrations/202610160002_public_map_review_states.sql`.
La función `public_map_sightings` permite consultar, sin iniciar sesión, solo los
campos públicos de los avistamientos pendientes o verificados activos con coordenadas válidas. No abre
la tabla `sightings`, contactos, notas ni evidencia privada. La consulta recorre
páginas de 500 filas; el listado lateral pagina independientemente en grupos de seis.

Los fondos oceánico y satélite proceden de los servicios cartográficos de Esri,
con atribución visible. Los puntos representan observaciones, no rutas de animales
ni datos de OCEARCH. Si no hay datos, el mapa permanece navegable y muestra un
estado vacío; si falla la consulta, ofrece reintento.

Si el tracker indica que está pendiente de configuración, un `404 / PGRST202` en
`public_map_sightings` significa que PostgREST no encuentra la función pública.
Si faltan los estados en la respuesta, aplica `202610160002_public_map_review_states.sql`;
la interfaz no supone que un registro sin estado esté verificado. Para comprobarlo:

```sql
select * from public.public_map_sightings(0);
select status, latitude, longitude from public.sightings;
```

Los pendientes comunitarios muestran «Este avistamiento aún no ha sido verificado.»
en su tarjeta; los pendientes OBIS tienen el aviso específico de la fuente. Los
verificados muestran su distintivo. No hay una alerta global fuera de las tarjetas.
Los rechazados, eliminados, registros sin coordenadas válidas y lotes retirados
siguen ocultos. El administrador puede revisar los reportes en `/admin`; no es
necesario marcarlos como verificados para hacerlos visibles. Las estadísticas por
modo mantienen sus filtros y valores iniciales independientes del mapa público.

## Estadísticas en los modos

Después de las migraciones de importación, ejecutar `supabase/migrations/202610160001_sighting_statistics.sql` en Supabase. La función `sighting_statistics` calcula los totales, registros por año, principales identificaciones, procedencia y calidad en una sola consulta; no utiliza la página del listado ni está limitada a 1000 filas de PostgREST. No inserta ni modifica avistamientos.

El resumen está dentro de los modos existentes y se alcanza desde **Resumen estadístico**:

- **Estudiante:** registros verificados por defecto, identificaciones distintas, años documentados y explicación educativa.
- **Científico:** verificados por defecto, filtros por identificación, fuente y año, calidad de datos y exclusión opcional de posibles duplicados.
- **Pescador/Buzo:** sus propios reportes por defecto, pendientes/verificados/rechazados y opción de consultar todas las fuentes.
- **Administrador:** resumen general, pendientes, verificados, advertencias y conteos globales de lotes activos/retirados, con enlace a su gestión.

Los filtros del resumen son independientes de los controles del mapa/listado y se identifican como **Estado/Fuente/Año/Alcance de las estadísticas**. Paginar no vuelve a calcular el resumen. Revisar o eliminar desde el espacio actual sí lo actualiza; también hay un botón **Actualizar estadísticas**. Las consultas anteriores se cancelan/ignoran al cambiar filtros.

Los gráficos cuentan **registros**, no individuos ni abundancia poblacional. «Identificaciones distintas» agrupa nombres o grupos tal como están documentados, excluye etiquetas desconocidas y no afirma que sean especies confirmadas ni unifica sinónimos. Los géneros y los registros pendientes de revisión taxonómica siguen diferenciados. Se muestran hasta ocho identificaciones y el resto como «Otros grupos», sin perder sus registros en el total.

Las fechas parciales usan únicamente el año documentado, no un día o mes inventados ni el año de importación. Los registros sin año se muestran por separado. OBIS, comunidad, otras fuentes y registros sin procedencia documentada se distinguen; una fila sin autor ni fuente no se etiqueta automáticamente como comunitaria. Los registros eliminados y los lotes retirados quedan excluidos incluso si un lote retirado conserva alguna fila sin marca de borrado. Los posibles duplicados se incluyen y señalan por defecto; su exclusión solo modifica el resumen y no borra nada.

La función comprueba la sesión y el rol en el servidor (solo `student`, `researcher`, `community`, `admin`); el alcance personal usa `auth.uid()`, nunca un UUID enviado por el navegador. Devuelve agregados, sin contactos, notas, evidencia, autores ni originales de importación. Los conteos globales de lotes solo se devuelven al administrador. Los errores de configuración/carga se muestran como error con reintento, no como conteos cero. Cada gráfico tiene valores visibles y una tabla accesible por teclado.

Las gráficas usan Apache ECharts con `echarts-for-react`: barras horizontales para años, composición de especies/identificaciones y procedencia; una gráfica circular de salud visual en Estudiante, Científico y Pescador Buzo. Se carga un módulo cliente separado, con solo los componentes necesarios, y los colores se obtienen de los tokens del sitio. El ancho responde al contenedor, las animaciones respetan el movimiento reducido y los años conservan su orden y la categoría «Sin año conocido»; las series largas permiten desplazamiento por teclado. Las tablas exactas siguen disponibles durante la carga de ECharts.

### Composición y salud visual

La composición mantiene los nombres originales sin unificar sinónimos ni atribuir observaciones a especies no documentadas. Las barras muestran registros; los tooltips y tablas incluyen su porcentaje sobre todos los registros de los filtros, incluidos los no identificados. Se conservan los años, la procedencia y el resto del resumen existente; no se añade profundidad ni hábitat ni se interpreta la altitud GPS como profundidad.

La salud requiere la migración **`202610170001_visual_health_statistics.sql`**, que añade `visual_health` a `sighting_statistics` y reutiliza exactamente los filtros, la autorización y las exclusiones de filas eliminadas, lotes retirados y posibles duplicados. No devuelve notas, textos de otras condiciones ni datos individuales. No necesita instalar nuevas dependencias.

- **Sin marcas visibles:** únicamente la opción «Sano / sin marcas visibles», sin combinarla con otras condiciones. No equivale a un diagnóstico de buena salud.
- **Con signos reportados:** heridas/cicatrices, ectoparásitos, anzuelo/red/basura u otra condición descrita. No se diagnostican enfermedades ni se atribuyen automáticamente todas las marcas a la pesca.
- **Sin información concluyente:** sin dato, desconocido, valores no reconocidos o combinaciones contradictorias; «Otro» sin descripción también se considera inconcluyente. Los OBIS sin salud documentada van aquí, no a «sanos».

Cada registro pertenece a una sola categoría y el denominador incluye las tres, sin ponderar por `quantity`: la condición se registra por avistamiento y no permite asignar salud a cada individuo de un grupo. Los porcentajes se redondean a un decimal y pueden sumar aproximadamente 100 %. Una consulta vacía no produce sectores ni porcentajes ficticios. La leyenda conserva los nombres, conteos y porcentajes con barras comparativas, además de una tabla accesible; no depende exclusivamente de los colores.

El desglose de signos cuenta cada tipo una vez por registro, pero sus categorías pueden coincidir y no deben sumarse como registros distintos. No se separan anzuelos de redes o basura porque el formulario los recoge en una sola opción. La aplicación funciona con la respuesta anterior del RPC, pero muestra un aviso de configuración en lugar de inventar el gráfico de salud hasta aplicar la nueva migración.

## Configurar el acceso con Google y Microsoft

La configuración del nuevo registro y sus mapas se describe en [Registro ampliado, archivos y búsqueda GPS](#registro-ampliado-archivos-y-búsqueda-gps).

Los botones están integrados con Supabase Auth. Para que funcionen con cuentas reales, activa los proveedores en tu proyecto de Supabase.

### 1. URLs de la aplicación en Supabase

En **Authentication → URL Configuration**:

- Configura **Site URL** con el origen de producción de la aplicación.
- Añade a **Redirect URLs** `http://localhost:3000/auth/callback` y `https://TU_DOMINIO/auth/callback`. Si utilizas otro puerto local, añádelo también.
- Añade también `http://localhost:3000/auth/callback?sb_flow_id=*` y `https://TU_DOMINIO/auth/callback?sb_flow_id=*` para permitir el identificador de cada flujo PKCE. El comodín se limita a ese parámetro en la ruta de retorno.

El cliente usa el origen actual y añade el identificador del flujo PKCE devuelto por Supabase al callback. Completa el acceso en el mismo navegador en el que lo iniciaste.

### 2. Google

1. En Google Cloud, configura la pantalla de consentimiento OAuth y crea un cliente OAuth de tipo **Aplicación web**.
2. Añade como URI de redirección autorizada el callback de **Supabase**: `https://TU_PROYECTO.supabase.co/auth/v1/callback` (copia el valor que muestra Supabase).
3. En **Authentication → Sign In / Providers → Google**, activa el proveedor y guarda el Client ID y Client Secret.
4. Si la aplicación OAuth está en modo de pruebas, añade las cuentas que utilizarás como usuarios de prueba.

### 3. Microsoft

1. En **Microsoft Entra ID → App registrations**, registra una aplicación y selecciona los tipos de cuenta que podrán acceder.
2. Añade una URI de redirección de tipo **Web** con el mismo callback de Supabase: `https://TU_PROYECTO.supabase.co/auth/v1/callback`.
3. Crea un secreto y copia su **valor**, junto con el **Application (client) ID**, en el proveedor **Azure (Microsoft)** de Supabase. Actívalo.
4. Configura el **Azure Tenant URL** de acuerdo con las cuentas permitidas: `https://login.microsoftonline.com/common` para cuentas organizativas y personales, `https://login.microsoftonline.com/consumers` para solo personales o `https://login.microsoftonline.com/TU_TENANT_ID` para una organización concreta. Debe coincidir con los tipos de cuenta registrados.

El código usa `provider: 'azure'` y solicita el scope `email` requerido por Supabase. Los secretos de Google y Microsoft se guardan en Supabase; no se añaden a variables `NEXT_PUBLIC_*`.

### 4. Permisos de acceso

Autenticarse con Google o Microsoft no asigna permisos administrativos. Las cuentas sin perfil completan la selección en `/completar-perfil`. Estudiantes y buzos/pescadores acceden a su módulo; los científicos quedan pendientes de validación. El rol se consulta en `profiles`, no se confía en metadatos modificables del usuario para conceder permisos.

La sesión se gestiona en el navegador, igual que el acceso por contraseña. `/auth/callback` intercambia el código una sola vez, comprueba el perfil y abre su ruta correspondiente. No se aceptan destinos de redirección proporcionados por el usuario.

## Contrato de datos de Supabase

### `profiles`

| Columna | Uso |
| --- | --- |
| `id` | Identificador del usuario de Supabase Auth |
| `role` | Uno de los seis perfiles de la tabla de rutas |
| `full_name` | Nombre visible, puede ser nulo |
| `science_status` | `pending`, `approved`, `rejected` o nulo |
| `affiliation` | Institución o actividad investigadora |
| `request_note`, `reviewed_by`, `reviewed_at` | Nota, administrador y fecha de la validación científica |

### `sightings`

| Columna | Uso |
| --- | --- |
| `id` | Identificador único del avistamiento |
| `reporter_id` | Usuario autor; nulo para registros históricos |
| `species` | Especie; puede ser nula |
| `location_name` | Nombre de la ubicación; puede ser nulo |
| `sighting_date` | Fecha del avistamiento; puede ser nula |
| `quantity` | Cantidad; puede ser nula |
| `estimated_size` | Tamaño aproximado en metros; puede ser nulo |
| `latitude`, `longitude` | Coordenadas opcionales del avistamiento; pueden ser nulas |
| `behavior`, `notes` | Información adicional; puede ser nula |
| `status` | `pending`, `verified` o `rejected` |
| `created_at` | Fecha de creación para ordenar el listado |
| `verified_by` | ID del usuario que aprueba o rechaza |
| `verified_at`, `updated_at` | Fecha y hora de la revisión, enviadas como ISO 8601 |

Las consultas solicitan únicamente las columnas utilizadas. Los registros anteriores pueden carecer de hora, medidas y coordenadas; el listado explica los datos ausentes. Las nuevas observaciones requieren latitud y longitud. `estimated_size` conserva su significado histórico en metros; la interfaz lo presenta en pies y no lo confunde con las nuevas medidas morfométricas.

La autorización de datos depende de las políticas RLS y la función de alta de la nueva migración. Solo el administrador revisa avistamientos. `submit_sighting` exige rol `community`, `researcher` o `admin`, establece el autor desde `auth.uid()` y el estado inicial `pending`. Los conteos y mapas consultan todas las filas visibles, no solo la página actual.

### Registro ampliado, archivos y búsqueda GPS

**Paso de despliegue necesario:** después de la migración de comunidad, ejecutar completo
`supabase/migrations/202610020001_sighting_observations.sql` en el SQL Editor del proyecto.
La migración está envuelta en una transacción y presupone el esquema base de `sightings`
descrito arriba. Ejecutar una sola vez; el archivo anterior no debe volver a aplicarse.

Añade:

- `collaborator_role`, `sighting_time`, `observed_at`, `species_other`, `sex`,
  `behavior_other`, `health_conditions`, `health_other`, `altitude`, `accuracy`.
- `total_length_m`, `fork_length_m`, `standard_length_m`, `interdorsal_length_m`:
  el formulario admite **pies decimales**, la base guarda metros (`pies × 0.3048`)
  y todas las fichas convierten a pies para mostrar. Las medidas son opcionales,
  mayores que cero y de un único ejemplar de referencia si la cantidad es mayor que uno.
- Fecha y hora en **America/Puerto_Rico (UTC−04:00)**. `observed_at` conserva el instante
  UTC; los registros históricos mantienen la hora desconocida, no se inventa una.
- `photo_path` y `video_path`, y bucket privado `sighting-evidence`. La foto y el video
  son opcionales. Formatos: JPG/PNG/WebP y MP4/WebM/MOV. La reproducción de MOV depende
  del códec y del navegador; MP4 es la opción más compatible.
- Límite técnico inicial **50 MB por archivo**, correspondiente al bucket y a
  `MAX_EVIDENCE_BYTES` en `lib/sightings/media.ts`. El texto heredado de 5 MB se retiró.
  Si se cambia la capacidad, ajustar bucket, constante y límite global del proyecto.
- `sighting_contacts`: contacto consentido, visible solo al autor, administradores y
  científicos aprobados mediante RLS. Nunca se incluye en la consulta general del mapa.
- `sighting_submissions`: recibos privados para reintentos con el mismo UUID y payload.
  La función transaccional guarda avistamiento y contacto de forma conjunta, verifica
  la existencia de la evidencia y no permite inyectar autor, estado o revisor.

Las cargas usan rutas propias y hashes del contenido, no nombres originales. Los errores
de envío intentan retirar archivos sin vincular; RLS protege la evidencia ya guardada.
Un cierre de pestaña durante una carga puede dejar archivos sin asociar. Para mantenimiento,
identificar objetos antiguos del bucket que no figuren en `photo_path`/`video_path` y
eliminarlos mediante la API de Storage, no eliminando directamente filas de `storage.objects`.

#### Buscador de lugares

`GET /api/places?q=...` requiere sesión y permiso de registro. Busca solo al pulsar
«Buscar lugar» o Enter. Usa Nominatim, con caché de resultados de 24 horas en el proceso,
identificación de GaleoTrack y cupo global de una petición por 1,1 segundos almacenado
en PostgreSQL mediante `claim_geocoding_request`. No realiza autocompletado.

El servicio público tiene una [política de uso](https://operations.osmfoundation.org/policies/nominatim/):
máximo de una petición por segundo para toda la aplicación, atribución e identificación,
sin consultas masivas ni autocompletado. Para otro proveedor compatible o una instancia
propia, configurar `GEOCODING_SEARCH_URL` en el servidor con la URL completa de búsqueda.
La consulta prioriza Puerto Rico sin excluir otros lugares. Si el servicio falla, siguen
disponibles el mapa, la introducción manual y el GPS del dispositivo. La altitud y precisión
son opcionales en metros; al cambiar manualmente de ubicación se borran sus valores anteriores.

#### Mapas y fichas

Los cuatro modos incluyen Leaflet/OpenStreetMap con puntos agrupados según el zoom.
Al pasar el cursor se abre una tarjeta; clic, toque o Enter la mantienen abierta y Escape
la cierra. Un selector permite consultar registros superpuestos. El mapa usa consultas
paginadas independientes (500 filas por petición), filtros de estado y autor, y cancela
peticiones obsoletas. Los registros sin coordenadas permanecen en el listado.

La ficha completa carga medidas, salud, comportamiento, evidencia y contacto autorizado
al solicitarla. Las URLs de evidencia son firmadas y duran 10 minutos; el botón de renovación
permite volver a abrirlas. Las fotografías ilustrativas de la web nunca sustituyen evidencia.

### `publications` y `species_guides`

`publications` contiene autor, título, resumen, contenido, referencias, estado `draft`/`published` y fechas. El contenido se muestra como texto con saltos de línea, sin ejecutar HTML. `species_guides` contiene nombre común, nombre científico, descripción, hábitat y enlace HTTPS de la fuente. Ambas se gestionan desde `/gestion`; el científico edita sus propias publicaciones desde `/cientifico`.

## Organización

```text
app/
  page.tsx / landing.css           Portada pública y diseño fotográfico
  layout.tsx                       Idioma, metadatos y fuentes
  globals.css                      Estilos globales
  favicon.ico / icon.png            Iconos de marca para el navegador
  apple-icon.png                   Icono para dispositivos Apple
  (auth)/
    layout.tsx                     Composición de acceso compartida
    login/page.tsx                 Inicio de sesión por contraseña, Google o Microsoft
    register/page.tsx              Registro y elección de perfil
    auth/callback/page.tsx         Retorno OAuth y comprobación de acceso
  (public)/
    layout.tsx                     Acceso protegido al formulario (nombre histórico del grupo)
    report/
      page.tsx                     Presentación del reporte autenticado
      _components/                 Formulario, selección de ubicación y mapa
      _hooks/use-geolocation.ts    Ubicación del dispositivo y sus estados
  (workspace)/
    layout.tsx                     Sesión, navegación por perfil y pie compartido
    estudiante/                    Catálogo educativo, avistamientos y publicaciones
    cientifico/                    Publicaciones propias, borradores y avistamientos
    comunidad/                     Avistamientos, estadísticas y acceso al reporte
    gestion/                       Validación científica, catálogo y publicaciones
    completar-perfil/              Selección inicial del perfil social
    solicitud/                     Estado de validación del científico
  admin/
    page.tsx                       Entrada al dashboard
    layout.tsx                     Composición administrativa
    _hooks/use-admin-dashboard.ts  Sesión, carga, filtros y acciones de la interfaz
    _components/                   Dashboard, métricas, registros y paginación
components/
  auth/                            Formularios y flujo de autenticación
  community/                       Catálogo, publicaciones, solicitudes y listados
  sightings/                       Listado y estadísticas compartidos
  icons/                           Iconos SVG y marcas de proveedores
  layout/                          Marca, cabecera, pie, títulos y composición de acceso
  ui/                              Botones, campos, tarjetas, alertas y estados
public/images/brand/               Logo original y versión WebP para la interfaz
public/images/landing/             Fotografías locales optimizadas y fuentes
supabase/migrations/               Cambios de esquema y políticas RLS
lib/
  supabase-client.ts               Cliente compartido de Supabase
  auth.ts                          Autorización social e intercambio PKCE
  access.ts                        Perfil, permisos de modos y rutas de inicio
  community.ts                     Consultas y validación de publicaciones y fichas
  types.ts                         Tipos del dominio usados por el panel
  admin.ts                         Consultas, validación del perfil y revisión
  dashboard-query.ts               Estado de filtros y páginas en la URL
  sightings/                       Esquema y creación de reportes
design-system/galeotrack/MASTER.md  Identidad visual, tokens y convenciones
tests/
  *.test.mjs                       Pruebas de datos, reportes, consultas y autenticación
  e2e/                             Flujos, responsive y accesibilidad con Playwright/Axe
```

La paleta y los estilos base están en `app/globals.css`: fondo azul noche `#020D1C`, paneles `#0C1828`, texto claro `#F5F8FC`, secundarios `#BDCDDD` y acentos `#91BFDF`. Los botones principales combinan azul claro con texto oscuro. `components/layout/auth.css` contiene la composición fotográfica del acceso y reutiliza los controles globales.

La portada añade una composición oceánica oscura en `app/landing.css`, documentada en `design-system/galeotrack/pages/landing.md`. Sus imágenes ilustrativas proceden de Unsplash y se sirven localmente como WebP; fuentes y licencia en `public/images/landing/README.md`. Los botones de las tres tarjetas quedan anclados a su borde inferior, con cualquier nota de acceso situada antes de la acción.

Los módulos extienden esta identidad mediante `PageHeading` (cabeceras fotográficas), `SectionLinks` (accesos visuales) y superficies oscuras para datos y formularios. Su composición está documentada en `design-system/galeotrack/pages/workspaces.md`.

## Comprobaciones

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

- `lint`: comprueba las reglas de Next.js, React Hooks y TypeScript.
- `typecheck`: genera los tipos de rutas de Next.js y comprueba TypeScript.
- `test`: ejecuta pruebas con el SDK real de Supabase y respuestas HTTP simuladas, más la migración y las políticas RLS en una instancia local de PostgreSQL con PGlite. No necesita credenciales ni modifica datos remotos. Cubre roles, autoría, borradores, validación científica, errores, conteos, filtros, paginación y revisiones concurrentes.
- `build`: genera el build de producción; requiere las variables de entorno y acceso a Google Fonts para las fuentes Geist configuradas en el layout.
- `test:e2e`: inicia un servidor local en el puerto 3100. Comprueba portada, alineación de tarjetas, fotos, login, registro, módulos por perfil, publicaciones, validación científica, reporte y panel. Incluye 375/768/1024/1440 px, Axe, teclado y texto ampliado. Usa respuestas simuladas y guarda capturas en `test-results/`. Requiere el navegador de Playwright (`npx playwright install chromium`).

Si ya está abierto `next dev`, las pruebas pueden reutilizarlo indicando su origen exacto. En PowerShell:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:3000'
npm run test:e2e
```

Usa el mismo host del servidor (`localhost` o `127.0.0.1`), porque Next.js comprueba el origen de los recursos de desarrollo.

Para servir el build localmente:

```bash
npm start
```

### Verificación manual con Supabase

1. Registra un estudiante, un buzo/pescador y un científico. Comprueba la confirmación de correo y el destino de cada perfil. Valida o rechaza al científico desde `/gestion` con un administrador.
2. Cambia entre estados y páginas; los contadores globales deben permanecer independientes del filtro. Cada cambio de filtro vuelve a la primera página.
3. Aprueba o rechaza un pendiente. Mientras se guarda, las acciones están deshabilitadas. Al terminar se actualizan el listado y los totales.
4. Abre el mismo pendiente en dos sesiones y revísalo en ambas. La segunda operación debe informar que no modificó el registro y actualizar el listado.
5. Revisa el último pendiente de la última página: el listado debe volver a una página válida.
6. Comprueba la navegación con teclado, la asociación de etiquetas del login y el cierre de sesión.
7. Inicia sesión con Google y Microsoft: comprueba la selección de cuenta y la llegada al módulo correcto. Una cuenta nueva sin perfil debe completar su selección; no puede elegir administrador.
8. Cancela el consentimiento del proveedor y comprueba el mensaje de retorno cuando el proveedor redirija a la aplicación. Un callback sin código o caducado debe ofrecer volver al login.
9. Comprueba el login en móvil, la opción de mostrar/ocultar contraseña y que las acciones se deshabilitan durante el envío.
10. Como científico, guarda un borrador, publícalo y vuelve a borrador. Comprueba que estudiantes y buzos/pescadores solo leen publicaciones publicadas y que otros científicos no editan tus artículos.
11. Como estudiante, abre `/report` y `/admin`: no debe permitir reportar ni revisar. Como científico aprobado y buzo/pescador, registra un avistamiento y comprueba «Mis avistamientos»; ninguno puede revisar en `/admin`.
12. Envía un avistamiento sin archivos y otro con foto, video y contacto consentido. Comprueba medidas en pies, hora, campos «Otro», reintento tras un fallo y acceso al contacto según el perfil.
13. Abre los mapas de los cuatro modos. Comprueba puntos fuera de la página actual, filtros, agrupaciones, teclado, toque y fichas de registros antiguos sin campos nuevos.

Las pruebas de navegador utilizan respuestas simuladas; las pruebas de permisos ejecutan RLS localmente. La configuración remota de Auth, triggers, tablas y RLS se verifica al aplicar la migración en la instancia de Supabase.
