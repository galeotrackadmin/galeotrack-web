export const EVIDENCE_BUCKET = 'sighting-evidence'
// Coincide con file_size_limit de la migración. Adaptar ambos al plan de Storage.
export const MAX_EVIDENCE_BYTES = 50 * 1024 * 1024
export const MEDIA_TYPES = {
  photo: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' },
  video: { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' },
} as const
export type EvidenceKind = keyof typeof MEDIA_TYPES
export type EvidenceFiles = Partial<Record<EvidenceKind, File>>
export function validateEvidence(file: File, kind: EvidenceKind) {
  if (!Object.hasOwn(MEDIA_TYPES[kind], file.type)) throw new Error(kind === 'photo' ? 'Selecciona una foto JPG, PNG o WebP.' : 'Selecciona un video MP4, WebM o MOV.')
  if (file.size === 0) throw new Error('El archivo está vacío.')
  if (file.size > MAX_EVIDENCE_BYTES) throw new Error('El archivo supera la capacidad configurada de 50 MB. Selecciona uno más pequeño.')
}

export async function evidencePath(file: File, kind: EvidenceKind, userId: string, reportId: string) {
  validateEvidence(file, kind)
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  const fingerprint = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
  const extension = (MEDIA_TYPES[kind] as Record<string, string>)[file.type]
  return `${userId}/${reportId}/${kind}-${fingerprint}.${extension}`
}
