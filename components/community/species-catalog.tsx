'use client'

import { useCallback, useRef, useState, type FormEvent } from 'react'
import Image from 'next/image'
import { loadSpecies, saveSpecies, type SpeciesGuide } from '@/lib/community'
import { supabase } from '@/lib/supabase-client'
import { useResource } from '@/lib/use-resource'
import { Button } from '@/components/ui/button'
import { FormField, Input, Textarea } from '@/components/ui/form-field'
import { Alert } from '@/components/ui/alert'
import { ResourceState, Pagination } from './resource-state'

const featuredSpecies = [
  { scientificName: 'Ginglymostoma cirratum', image: '/images/sharks/Ginglymostoma_cirratum.webp', description: 'Cuerpo robusto y dos barbillas sensoriales junto a la boca. Suele descansar durante el día sobre fondos arenosos y arrecifes.', habitat: 'Fondos costeros, arenosos y arrecifes.', source: 'https://www.fishbase.org/summary/Ginglymostoma-cirratum.html' },
  { scientificName: 'Carcharhinus perezii', image: '/images/sharks/Carcharhinus perezi.webp', description: 'Tiburón gris y estilizado asociado a arrecifes del Atlántico occidental y el Caribe. Presenta hocico relativamente corto y una cresta entre las aletas dorsales.', habitat: 'Arrecifes coralinos del Caribe y Atlántico occidental.', source: 'https://www.fishbase.org/summary/Carcharhinus_perezii.html' },
  { scientificName: 'Galeocerdo cuvier', image: '/images/sharks/Tiger_shark.webp', description: 'Tiburón grande de hocico ancho. Sus franjas oscuras verticales se distinguen especialmente en ejemplares jóvenes; es un depredador de dieta variada.', habitat: 'Aguas tropicales y templadas cálidas, costeras y oceánicas.', source: 'https://www.fishbase.org/summary/Galeocerdo-cuvier.html' },
]

const referenceSpecies: SpeciesGuide[] = [
  { id: 'reference-carcharhinus-leucas', name: 'Tiburón toro', scientific_name: 'Carcharhinus leucas', description: 'Tiburón robusto de hocico ancho y corto. Puede habitar aguas costeras, estuarios y ríos gracias a su tolerancia al agua dulce.', habitat: 'Aguas costeras, estuarios y algunos ríos.', source_url: 'https://www.fishbase.org/summary/Carcharhinus-leucas.html' },
  { id: 'reference-carcharhinus-falciformis', name: 'Tiburón sedoso', scientific_name: 'Carcharhinus falciformis', description: 'Tiburón oceánico de cuerpo alargado y piel de apariencia lisa, con aletas pectorales largas y primera aleta dorsal relativamente pequeña.', habitat: 'Aguas tropicales oceánicas.', source_url: 'https://www.fishbase.org/summary/Carcharhinus-falciformis.html' },
  { id: 'reference-alopias-vulpinus', name: 'Tiburón zorro común', scientific_name: 'Alopias vulpinus', description: 'Se distingue por el lóbulo superior extraordinariamente largo de su aleta caudal, que utiliza para aturdir bancos de peces.', habitat: 'Aguas oceánicas y costeras.', source_url: 'https://www.fishbase.org/summary/Alopias-vulpinus.html' },
  { id: 'reference-carcharhinus-plumbeus', name: 'Tiburón de arenales', scientific_name: 'Carcharhinus plumbeus', description: 'Tiburón costero grisáceo con una primera aleta dorsal notablemente alta y triangular.', habitat: 'Plataformas continentales, bahías y fondos arenosos.', source_url: 'https://www.fishbase.org/summary/Carcharhinus-plumbeus.html' },
  { id: 'reference-negaprion-brevirostris', name: 'Tiburón limón', scientific_name: 'Negaprion brevirostris', description: 'Tiburón costero amarillo-marrón con dos aletas dorsales de tamaño parecido.', habitat: 'Aguas someras, manglares y bahías tropicales.', source_url: 'https://www.fishbase.org/summary/Negaprion-brevirostris.html' },
  { id: 'reference-carcharhinus-limbatus', name: 'Tiburón de punta prieta', scientific_name: 'Carcharhinus limbatus', description: 'Tiburón hidrodinámico que suele presentar extremos oscuros en varias aletas y puede formar agrupaciones.', habitat: 'Aguas costeras.', source_url: 'https://www.fishbase.org/summary/Carcharhinus-limbatus.html' },
  { id: 'reference-sphyrna-spp', name: 'Tiburones martillo', scientific_name: 'Sphyrna spp.', description: 'Grupo de tiburones con la cabeza extendida lateralmente en forma de martillo. Esta ficha representa varias especies: para identificar un ejemplar hace falta determinar la especie concreta.', habitat: 'El hábitat varía según la especie.', source_url: 'https://www.fishbase.org/summary/Sphyrna-lewini.html' },
  { id: 'reference-sphyrna-mokarran', name: 'Tiburón cornuda gigante', scientific_name: 'Sphyrna mokarran', description: 'El mayor tiburón martillo, reconocible por su cabeza ancha y casi recta y su primera aleta dorsal muy alta.', habitat: 'Aguas tropicales y templadas cálidas.', source_url: 'https://www.fishbase.org/summary/Sphyrna-mokarran.html' },
  { id: 'reference-rhizoprionodon-porosus', name: 'Tiburón hocicudo del Caribe', scientific_name: 'Rhizoprionodon porosus', description: 'Tiburón pequeño y esbelto, de hocico alargado y puntiagudo, asociado a aguas tropicales del Atlántico occidental.', habitat: 'Aguas costeras tropicales.', source_url: 'https://www.fishbase.org/summary/Rhizoprionodon-porosus.html' },
]

const referenceImages: Record<string, string> = {
  'Carcharhinus leucas': '/images/sharks/Bull_shark.webp', 'Carcharhinus falciformis': '/images/sharks/Carcharhinus_falciformis.webp',
  'Alopias vulpinus': '/images/sharks/Alopias vulpinus.webp', 'Carcharhinus plumbeus': '/images/sharks/Carcharhinus_plumbeus_georgia.webp',
  'Negaprion brevirostris': '/images/sharks/Lemonshark.webp', 'Carcharhinus limbatus': '/images/sharks/Carcharhinus limbatus.webp',
  'Sphyrna mokarran': '/images/sharks/Sphyrna mokarran.webp', 'Rhizoprionodon porosus': '/images/sharks/Rhizoprionodon_porosus.webp',
  'Sphyrna spp.': '/images/sharks/Great_hammerhead.webp', 'Familia Sphyrnidae': '/images/sharks/Great_hammerhead.webp',
}

function featuredImage(scientificName: string) {
  return featuredSpecies.find((species) => species.scientificName === scientificName)?.image ?? referenceImages[scientificName]
}

function FeaturedCard({ name, scientificName, description, habitat, source, guide, editable, editor, setEditor, setNotice }: { name: string; scientificName: string; description: string; habitat: string; source: string; guide?: SpeciesGuide; editable: boolean; editor: SpeciesGuide | null | undefined; setEditor: (guide: SpeciesGuide) => void; setNotice: (notice: string) => void }) {
  const image = featuredImage(scientificName)
  return <article className="ui-card flex h-full flex-col overflow-hidden">
    <div className="relative aspect-[16/10] w-full bg-soft">{image && <Image src={image} alt={`Fotografía de ${name} (${scientificName})`} fill sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw" className="object-cover" />}</div>
    <div className="flex flex-1 flex-col gap-4 p-6"><div><h3 className="break-words text-xl font-semibold text-ocean">{name}</h3><p className="mt-1 break-words text-sm text-muted italic">{scientificName}</p></div>
      <p className="article-body min-h-24 text-sm">{description}</p><div className="min-h-16"><h4 className="text-sm font-semibold text-primary">Hábitat</h4><p className="article-body mt-1 text-sm text-muted">{habitat}</p></div>
      <a href={source} target="_blank" rel="noopener noreferrer" className="button button--ghost mt-auto">Más info <span className="sr-only">sobre {name} en FishBase (nueva pestaña)</span></a>
      {editable && guide && <Button variant="secondary" disabled={editor !== undefined} onClick={() => { setEditor(guide); setNotice(''); document.getElementById('especies')?.scrollIntoView() }}>Editar ficha<span className="sr-only"> de {name}</span></Button>}
    </div>
  </article>
}

function FeaturedSpecies({ rows, editable, editor, setEditor, setNotice }: { rows: SpeciesGuide[]; editable: boolean; editor: SpeciesGuide | null | undefined; setEditor: (guide: SpeciesGuide) => void; setNotice: (notice: string) => void }) {
  const getCard = (scientificName: string, fallback: Omit<SpeciesGuide, 'id'>) => {
    const guide = rows.find((row) => row.scientific_name.toLowerCase() === scientificName.toLowerCase())
    return { ...fallback, ...guide, scientific_name: guide?.scientific_name || fallback.scientific_name, name: guide?.name || fallback.name, description: guide?.description || fallback.description, habitat: guide?.habitat || fallback.habitat, source_url: guide?.source_url || fallback.source_url, guide }
  }
  const nurse = getCard(featuredSpecies[0].scientificName, { name: 'Tiburón gata', scientific_name: featuredSpecies[0].scientificName, description: featuredSpecies[0].description, habitat: featuredSpecies[0].habitat, source_url: featuredSpecies[0].source })
  const caribbean = getCard(featuredSpecies[1].scientificName, { name: 'Tiburón de arrecife del Caribe', scientific_name: featuredSpecies[1].scientificName, description: featuredSpecies[1].description, habitat: featuredSpecies[1].habitat, source_url: featuredSpecies[1].source })
  const tiger = getCard(featuredSpecies[2].scientificName, { name: 'Tiburón tigre', scientific_name: featuredSpecies[2].scientificName, description: featuredSpecies[2].description, habitat: featuredSpecies[2].habitat, source_url: featuredSpecies[2].source })
  return <div className="grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
    {[nurse, caribbean, tiger].map((species) => <FeaturedCard key={species.scientific_name} name={species.name} scientificName={species.scientific_name} description={species.description} habitat={species.habitat} source={species.source_url} guide={species.guide} editable={editable} editor={editor} setEditor={setEditor} setNotice={setNotice} />)}
  </div>
}

function CatalogCard({ guide, editable, editor, setEditor, setNotice }: { guide: SpeciesGuide; editable: boolean; editor: SpeciesGuide | null | undefined; setEditor: (guide: SpeciesGuide) => void; setNotice: (notice: string) => void }) {
  const image = featuredImage(guide.scientific_name)
  return <article className="ui-card flex h-full flex-col overflow-hidden" key={guide.id}>
    <div className="relative aspect-[16/10] w-full bg-soft">{image && <Image src={image} alt={`Fotografía de ${guide.name} (${guide.scientific_name})`} fill sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw" className="object-cover" />}</div>
    <div className="flex flex-1 flex-col gap-4 p-6"><div><h3 className="break-words text-xl font-semibold text-ocean">{guide.name}</h3><p className="mt-1 break-words text-sm text-muted italic">{guide.scientific_name}</p></div><p className="article-body min-h-24 text-sm">{guide.description}</p>
      {guide.habitat && <div className="min-h-16"><h4 className="text-sm font-semibold text-primary">Hábitat</h4><p className="article-body mt-1 text-sm text-muted">{guide.habitat}</p></div>}
      {guide.source_url.startsWith('https://') && <a href={guide.source_url} target="_blank" rel="noopener noreferrer" className="button button--ghost mt-auto">Más info <span className="sr-only">sobre {guide.name} en la fuente (nueva pestaña)</span></a>}
      {editable && <Button variant="secondary" disabled={editor !== undefined} onClick={() => { setEditor(guide); setNotice(''); document.getElementById('especies')?.scrollIntoView() }}>Editar ficha<span className="sr-only"> de {guide.name}</span></Button>}
    </div>
  </article>
}

function SpeciesEditor({ guide, onSaved, onCancel }: { guide: SpeciesGuide | null; onSaved: () => void; onCancel: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const sending = useRef(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending.current) return
    sending.current = true; setBusy(true); setError('')
    try { await saveSpecies(supabase, Object.fromEntries(new FormData(event.currentTarget)), guide?.id); onSaved() }
    catch (error) { setError(error instanceof Error ? error.message : 'No se pudo guardar.') }
    finally { sending.current = false; setBusy(false) }
  }
  return <form onSubmit={submit} aria-busy={busy} className="ui-card space-y-5 p-6"><h3 className="text-xl font-semibold text-ocean">{guide ? 'Editar ficha educativa' : 'Nueva ficha educativa'}</h3><fieldset disabled={busy} className="space-y-5">
    <FormField id="species-name" label="Nombre común" required><Input id="species-name" name="name" defaultValue={guide?.name} minLength={3} maxLength={120} required /></FormField>
    <FormField id="scientific-name" label="Nombre científico"><Input id="scientific-name" name="scientific_name" defaultValue={guide?.scientific_name} maxLength={160} /></FormField>
    <FormField id="species-description" label="Descripción educativa" required hint="Al menos 20 caracteres."><Textarea id="species-description" name="description" defaultValue={guide?.description} minLength={20} maxLength={10000} rows={6} aria-describedby="species-description-hint" required /></FormField>
    <FormField id="species-habitat" label="Hábitat"><Textarea id="species-habitat" name="habitat" defaultValue={guide?.habitat} maxLength={1000} rows={3} /></FormField>
    <FormField id="species-source" label="Fuente (enlace HTTPS)"><Input id="species-source" name="source_url" defaultValue={guide?.source_url} type="url" pattern="https://.*" /></FormField>
  </fieldset>{error && <Alert kind="error">{error}</Alert>}<div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy} loading={busy}>Guardar ficha</Button><Button variant="secondary" disabled={busy} onClick={onCancel}>Cancelar edición</Button></div></form>
}

export function SpeciesCatalog({ editable = false }: { editable?: boolean }) {
  const [page, setPage] = useState(1)
  const [showMore, setShowMore] = useState(false)
  const [editor, setEditor] = useState<SpeciesGuide | null | undefined>(undefined)
  const [notice, setNotice] = useState('')
  const load = useCallback(() => loadSpecies(supabase, page), [page])
  const resource = useResource(load)
  const moreGuides = resource.data ? [
    ...resource.data.rows.filter((guide) => !featuredSpecies.some((species) => species.scientificName.toLowerCase() === guide.scientific_name.toLowerCase())),
    ...referenceSpecies.filter((reference) => !resource.data?.rows.some((guide) => guide.scientific_name.toLowerCase() === reference.scientific_name.toLowerCase())),
  ] : []
  return <section id="especies" aria-labelledby="species-title" className="scroll-mt-6 space-y-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 id="species-title" className="text-2xl font-semibold text-ocean">Conoce las especies</h2><p className="mt-2 text-muted">Una guía para observar mejor. La identificación de un avistamiento requiere revisión.</p></div>{editable && <Button disabled={editor !== undefined} onClick={() => { setEditor(null); setNotice('') }}>Nueva ficha</Button>}</div>
    <div className="editorial-banner editorial-banner--compact">
      <div className="editorial-banner-media"><Image src="/images/landing/coral.webp" alt="Diversidad de formas y colores de un arrecife de coral" fill sizes="(max-width: 767px) 100vw, 45vw" /></div>
      <div className="editorial-banner-copy"><p className="section-eyebrow">Aprender a observar</p><h3 className="mt-3 text-2xl font-medium tracking-tight">Cada especie, una nueva perspectiva.</h3><p>Conoce sus características y hábitats. Una observación cuidadosa es el primer paso para comprender mejor el océano.</p></div>
    </div>
    {notice && <Alert kind="success">{notice}</Alert>}
    {editor !== undefined && <SpeciesEditor key={editor?.id ?? 'new'} guide={editor} onCancel={() => setEditor(undefined)} onSaved={() => { setEditor(undefined); setNotice('Ficha educativa guardada.'); resource.refresh() }} />}
    <ResourceState {...resource} retry={resource.refresh} />
    {resource.data && <><FeaturedSpecies rows={resource.data.rows} editable={editable} editor={editor} setEditor={setEditor} setNotice={setNotice} />
      <>
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="text-xl font-semibold text-ocean">Explora otras especies</h3><p className="mt-1 text-sm text-muted">Más tiburones para aprender a reconocer y observar.</p></div><Button variant="secondary" aria-expanded={showMore} aria-controls="more-species" onClick={() => setShowMore((visible) => !visible)}>{showMore ? 'Ver menos' : 'Ver más especies'}</Button></div>
        {showMore && <div id="more-species" className="grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">{moreGuides.map((guide) => <CatalogCard key={guide.id} guide={guide} editable={editable && Boolean(resource.data?.rows.some((row) => row.id === guide.id))} editor={editor} setEditor={setEditor} setNotice={setNotice} />)}</div>}
        {showMore && resource.data.total > resource.data.rows.length && <Pagination page={page} total={resource.data.total} onPage={setPage} label="Paginación de especies" />}
      </>
      </>}
  </section>
}
