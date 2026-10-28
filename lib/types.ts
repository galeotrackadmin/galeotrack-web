export type ReviewerRole = 'admin'
export type SightingStatus = 'pending' | 'verified' | 'rejected'
export type ReviewStatus = Exclude<SightingStatus, 'pending'>
export type SightingFilter = SightingStatus | 'all'

export type Reviewer = {
  id: string
  email: string
  fullName: string
  role: ReviewerRole
}

export type Sighting = {
  id: string
  reporter_id?: string | null
  species: string | null
  location_name: string | null
  sighting_date: string | null
  quantity: number | null
  estimated_size: number | null
  latitude: number | null
  longitude: number | null
  behavior: string | null
  notes: string | null
  status: SightingStatus
  updated_at?: string | null
  deleted_at?: string | null
  import_batch_id?: string | null
  source_name?: string | null
  source_date?: string | null
  source_year?: number | null
  source_month?: number | null
  date_precision?: 'day' | 'month' | 'year' | 'unknown' | null
  quality_flags?: string[] | null
}

export type SightingCounts = Record<SightingStatus, number>

export type Observation = Sighting & {
  collaborator_role?: string | null
  sighting_time?: string | null
  observed_at?: string | null
  species_other?: string | null
  total_length_m?: number | null
  fork_length_m?: number | null
  standard_length_m?: number | null
  interdorsal_length_m?: number | null
  sex?: string | null
  behavior_other?: string | null
  health_conditions?: string[] | null
  health_other?: string | null
  altitude?: number | null
  accuracy?: number | null
  photo_path?: string | null
  video_path?: string | null
}
export type MapSighting = Pick<Observation, 'id' | 'species' | 'location_name' | 'sighting_date' | 'sighting_time' | 'photo_path' | 'quantity' | 'status' | 'source_name' | 'source_year' | 'source_month' | 'date_precision'> & { latitude: number; longitude: number }

export type DashboardData = {
  sightings: Sighting[]
  counts: SightingCounts
  total: number
  page: number
  totalPages: number
}
