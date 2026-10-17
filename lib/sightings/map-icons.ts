import L from 'leaflet'

export function sharkMarkerIcon(className: string) {
  return L.divIcon({
    className,
    html: '<span class="shark-marker-ring" aria-hidden="true"><span class="shark-map-glyph"></span></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}
