import { z } from 'zod'

export const SPECIES = [
  'Tiburón gata (Ginglymostoma cirratum)',
  'Tiburón de arrecife del Caribe (Carcharhinus perezi)',
  'Tiburón tigre (Galeocerdo cuvier)',
  'Tiburón martillo (Sphyrna spp.)',
  'Tiburón toro (Carcharhinus leucas)',
  'Tiburón punta blanca de arrecife (Triaenodon obesus)',
  'Tiburón sedoso (Carcharhinus falciformis)',
  'Tiburón zorro común (Alopias vulpinus)',
  'Tiburón de arenales (Carcharhinus plumbeus)',
  'Tiburón limón (Negaprion brevirostris)',
  'Tiburón de punta prieta (Carcharhinus limbatus)',
  'Tiburón cornuda gigante (Sphyrna mokarran)',
  'Tiburón hocicudo del Caribe (Rhizoprionodon porosus)',
  'Otro', 'No identificado',
] as const
export const SEXES = ['Hembra', 'Macho (claspers visibles)', 'No determinado'] as const
export const BEHAVIORS = ['Nadando tranquilamente', 'Alimentándose / cazando', 'Comportamiento curioso', 'Comportamiento evasivo', 'Comportamiento territorial / agresivo', 'Nado errático', 'Otro'] as const
export const HEALTH_CONDITIONS = ['Sano / sin marcas visibles', 'Ectoparásitos visibles', 'Heridas o cicatrices', 'Anzuelo / red / basura enganchada', 'Desconocido / no fue posible observar bien', 'Otro'] as const
export const MEASUREMENTS = [
  { name: 'total_length_ft', column: 'total_length_m', label: 'Longitud total' },
  { name: 'fork_length_ft', column: 'fork_length_m', label: 'Longitud de horquilla' },
  { name: 'standard_length_ft', column: 'standard_length_m', label: 'Longitud estándar' },
  { name: 'interdorsal_length_ft', column: 'interdorsal_length_m', label: 'Longitud interdorsal' },
] as const
export const FEET_TO_METERS = 0.3048
export function metersToFeet(value: number) { return value / FEET_TO_METERS }

function numberInput(value: unknown) {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) return undefined
  return typeof value === 'string' ? Number(value) : value
}
const optionalNumber = (schema: z.ZodNumber) => z.preprocess(numberInput, schema.optional())
const measurement = () => optionalNumber(z.number({ error: 'Escribe una longitud válida.' }).positive('La longitud debe ser mayor que cero.').max(100, 'Revisa la longitud: el máximo es 100 pies.'))
const detail = z.string().trim().max(1000, 'Usa un máximo de 1000 caracteres.').default('')

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export const sightingSchema = z.object({
  species: z.string().pipe(z.enum(SPECIES, { error: 'Selecciona una especie o indica que no la conoces.' })),
  species_other: z.string().trim().max(200).default(''),
  location_name: z.string().trim().min(2, 'Escribe una ubicación de al menos 2 caracteres.').max(200, 'Usa un máximo de 200 caracteres.'),
  sighting_date: z.string().refine(isCalendarDate, 'Selecciona una fecha válida.'),
  sighting_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Indica una hora válida.'),
  quantity: z.preprocess(numberInput, z.number({ error: 'Escribe una cantidad válida.' }).int('La cantidad debe ser un número entero.').min(1, 'La cantidad debe ser al menos 1.').max(2147483647, 'La cantidad es demasiado grande.')),
  total_length_ft: measurement(), fork_length_ft: measurement(), standard_length_ft: measurement(), interdorsal_length_ft: measurement(),
  sex: z.string().pipe(z.enum(SEXES, { error: 'Selecciona el sexo o «No determinado».' })),
  behavior: z.string().pipe(z.enum(BEHAVIORS, { error: 'Selecciona el comportamiento observado.' })),
  behavior_other: detail,
  health_conditions: z.array(z.enum(HEALTH_CONDITIONS)).min(1, 'Selecciona una condición o indica que no pudiste observarla.').max(6),
  health_other: detail,
  notes: z.string().trim().max(3000, 'Usa un máximo de 3000 caracteres.').default(''),
  latitude: z.preprocess(numberInput, z.number({ error: 'Selecciona la ubicación o escribe la latitud.' }).min(-90).max(90)),
  longitude: z.preprocess(numberInput, z.number({ error: 'Selecciona la ubicación o escribe la longitud.' }).min(-180).max(180)),
  altitude: optionalNumber(z.number({ error: 'Escribe una altitud válida.' }).min(-12000).max(10000)),
  accuracy: optionalNumber(z.number({ error: 'Escribe una precisión válida.' }).min(0, 'La precisión no puede ser negativa.').max(20000000)),
  contact_consent: z.enum(['yes', 'no'], { error: 'Indica si deseas incluir tus datos de contacto.' }),
  contact_name: z.string().trim().max(120).default(''),
  contact_email: z.string().trim().max(254).default(''),
  contact_phone: z.string().trim().max(40).default(''),
}).superRefine((data, context) => {
  const issue = (path: string, message: string) => context.addIssue({ code: 'custom', path: [path], message })
  if (data.species === 'Otro' && data.species_other.length < 2) issue('species_other', 'Describe la especie observada.')
  if (data.behavior === 'Otro' && data.behavior_other.length < 2) issue('behavior_other', 'Describe el comportamiento observado.')
  if (data.health_conditions.includes('Otro') && data.health_other.length < 2) issue('health_other', 'Describe la condición de salud observada.')
  if (new Set(data.health_conditions).size !== data.health_conditions.length) issue('health_conditions', 'Hay condiciones repetidas.')
  if (data.health_conditions.length > 1 && data.health_conditions.some((v) => v === HEALTH_CONDITIONS[0] || v === HEALTH_CONDITIONS[4])) issue('health_conditions', '«Sano» y «Desconocido» se seleccionan sin otras condiciones.')
  if (isCalendarDate(data.sighting_date) && Date.parse(`${data.sighting_date}T${data.sighting_time}:00-04:00`) > Date.now()) issue('sighting_date', 'La fecha y hora del avistamiento no pueden estar en el futuro.')
  if (data.contact_consent === 'yes') {
    if (data.contact_name.length < 2) issue('contact_name', 'Escribe tu nombre para el seguimiento.')
    if (!z.email().safeParse(data.contact_email).success) issue('contact_email', 'Escribe un correo válido para el seguimiento.')
    if (data.contact_phone && !/^[+\d\s().-]{5,40}$/.test(data.contact_phone)) issue('contact_phone', 'Escribe un teléfono válido.')
  }
})

export type SightingFormInput = z.input<typeof sightingSchema>
export type SightingFormData = z.output<typeof sightingSchema>
export const REPORT_DEFAULTS = {
  species: '', species_other: '', location_name: '', sighting_date: '', sighting_time: '', quantity: 1,
  total_length_ft: '', fork_length_ft: '', standard_length_ft: '', interdorsal_length_ft: '', sex: 'No determinado',
  behavior: '', behavior_other: '', health_conditions: [], health_other: '', notes: '', latitude: '', longitude: '', altitude: '', accuracy: '',
  contact_consent: 'no', contact_name: '', contact_email: '', contact_phone: '',
} satisfies SightingFormInput

export function coordinateValue(value: unknown, min: number, max: number): number | undefined {
  const number = numberInput(value)
  return typeof number === 'number' && Number.isFinite(number) && number >= min && number <= max ? number : undefined
}
