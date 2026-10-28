import L from 'leaflet'

export function sharkMarkerIcon(className: string) {
  return L.divIcon({
    className,
    html: '<span class="shark-marker-ring" aria-hidden="true"><span class="shark-map-glyph"></span></span>',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  })
}
