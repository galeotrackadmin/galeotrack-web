const references: { citation: string; doi?: string; url?: string }[] = [
  { citation: 'Credille, K. M., Frazier, K. S., Hullinger, G. A., & Hines, M. E. (1993). Meningoencephalitis in a nurse shark (Ginglymostoma cirratum) caused by a nematode. Journal of Wildlife Diseases, 29(1), 165–168.' },
  { citation: 'Espinoza, M., Lino, P. G., & García, V. (2018). Guía de campo para la identificación de tiburones en aguas territoriales de Puerto Rico. Editorial Marina.' },
  { citation: 'Hernández-Delgado, E. A. (2015). Uso de Sistemas de Información Geográfica (SIG) para el manejo de áreas marinas protegidas en Puerto Rico. Universidad de Puerto Rico.' },
  { citation: 'Llerena, N., Sanjuan, M., & Pérez, J. (2012). Protocolo de marcaje y toma de datos biométricos para el monitoreo de elasmobranquios en el Caribe. Revista de Ciencias Marinas, 4(2), 45–58.' },
  { citation: 'Nature Editorial. (2023). Environmental DNA (eDNA) as a non-invasive tool for monitoring shark diversity and distribution in coastal ecosystems. Nature Communications, 14(12), 1022.' },
  { citation: 'Ward-Paige, C. A., Mora, C., Lotze, H. K., Pattengill-Semmens, C., McClenachan, L., Arias-Schreiber, M., & Myers, R. A. (2010). Large-scale absence of sharks on reefs in the greater-Caribbean: A baseline for fish and future conservation. PLoS ONE, 5(8), e11916.' },
  { citation: 'Bond, M. E., Valentin-Albanese, J., Babcock, E. A., Abercrombie, D., Lamb, N. F., Miranda, A., Pikitch, E. K., & Chapman, D. D. (2017). Abundance and size structure of a reef shark population within a marine reserve has remained stable for more than a decade. Marine Ecology Progress Series, 576, 1–10.', doi: 'https://doi.org/10.3354/meps12241' },
  { citation: 'Departamento de Recursos Naturales y Ambientales (DRNA). (2010). Reglamento de Pesca de Puerto Rico (Reglamento 7949). Gobierno de Puerto Rico.' },
  { citation: 'Garner, M. M. (2013). A retrospective study of disease in elasmobranchs. Veterinary Pathology, 50(3), 377–389.', doi: 'https://doi.org/10.1177/0300985813482147' },
  { citation: 'National Oceanic and Atmospheric Administration. (2019). Guía de cumplimiento para el negociante, importador/exportador de especies altamente migratorias (HMS). Oficina de Pesquerías Sostenibles; NMFS.' },
  { citation: 'Ostrander, G. K., Cheng, K. C., Wolf, J. C., & Spitsbergen, J. M. (2004). Shark cartilage, cancer and the growing threat of pseudoscience. Cancer Research, 64(23), 8485–8491.', doi: 'https://doi.org/10.1158/0008-5472.CAN-04-1813' },
  { citation: 'Shipley, O. N., Lee, C.-S., Fisher, N. S., Sternlicht, J. K., Kattan, S., Staaterman, E. R., Hammerschlag, N., & Gallagher, A. J. (2021). Metal concentrations in coastal sharks from The Bahamas with a focus on the Caribbean reef shark. Scientific Reports, 11(218), 1–11.', doi: 'https://doi.org/10.1038/s41598-020-79973-w' },
  { citation: 'Smith, M., et al. (Eds.). (2017). Elasmobranch Husbandry Manual II: Recent Advances in the Care of Sharks, Rays and their Relatives. Ohio Biological Survey.' },
  { citation: 'Ward-Paige, C. A., Mora, C., Lotze, H. K., Pattengill-Semmens, C., McClenachan, L., Arias-Castro, E., & Myers, R. A. (2010). Large-scale absence of sharks on reefs in the greater-Caribbean: A footprint of human pressures. PLoS ONE, 5(8), e11916.', doi: 'https://doi.org/10.1371/journal.pone.0011916' },
  { citation: 'OBIS Mapper. (n.d.).', url: 'https://mapper.obis.org/?taxonid=10193&areaid=276#' },
  { citation: 'Carrier, J. C., Simpfendorfer, C. A., Heithaus, M. R., & Yopak, K. E. (Eds.). (2022). Biology of sharks and their relatives.' },
]

export function References() {
  return <section id="referencias" aria-labelledby="references-title" className="space-y-6">
    <h2 id="references-title" className="text-2xl font-semibold text-ocean">Referencias</h2>
    <div className="ui-card min-w-0 p-6 sm:p-8">
      <ul className="max-w-[80ch] space-y-6 text-base leading-relaxed text-muted" role="list">
        {references.map(({ citation, doi, url }) => <li key={citation} className="min-w-0">
          <p>{citation}</p>
          {doi && <a href={doi} className="inline-flex min-h-11 max-w-full items-center break-all text-primary underline underline-offset-4">{doi}</a>}
          {url && <a href={url} className="inline-flex min-h-11 max-w-full items-center break-all text-primary underline underline-offset-4">{url}</a>}
        </li>)}
      </ul>
    </div>
  </section>
}
