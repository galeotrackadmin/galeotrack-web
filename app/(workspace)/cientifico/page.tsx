import type { Metadata } from 'next'
import { ModuleDashboard } from '@/components/community/module-dashboard'
export const metadata: Metadata = { title: 'Espacio científico' }
export default function ScientistPage() { return <ModuleDashboard mode="researcher" /> }
