import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { WorkspaceProvider } from '@/data/workspace-context'
import { loadRuntimeConnection } from '@/data/supabase'
import App from './App'
import './index.css'

const root = createRoot(document.getElementById('root')!)
root.render(<main className="workspace-page" role="status">Cargando conexión de RCFito…</main>)
void loadRuntimeConnection().then(() => {
  root.render(<StrictMode><HashRouter><TooltipProvider><WorkspaceProvider><App/></WorkspaceProvider></TooltipProvider></HashRouter></StrictMode>)
}).catch(error => {
  root.render(<main className="workspace-page" role="alert"><h1 className="page-title">No se pudo abrir la aplicación</h1><p>{error instanceof Error ? error.message : 'No se pudo cargar la conexión.'}</p><p>Recarga la página o solicita a la administración revisar la conexión.</p></main>)
})
