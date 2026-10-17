import type { Metadata } from 'next'
import { ModuleDashboard } from '@/components/community/module-dashboard'
export const metadata: Metadata = { title: 'Espacio Pescador Buzo' }
export default function CommunityPage() { return <ModuleDashboard mode="community" /> }
