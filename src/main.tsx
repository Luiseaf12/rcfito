import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { WorkspaceProvider } from '@/data/workspace-context'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(<StrictMode><HashRouter><TooltipProvider><WorkspaceProvider><App/></WorkspaceProvider></TooltipProvider></HashRouter></StrictMode>)
