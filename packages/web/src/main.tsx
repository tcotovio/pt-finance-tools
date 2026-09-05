import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installServiceWorkerReload } from './lib/sw-update.js'

// The shell is precached, so a returning visitor would otherwise run the
// previous build for a whole visit — with a tax calculator, that means last
// year's tables under a source list citing this year's despacho. Reload as
// soon as the new worker takes over instead.
installServiceWorkerReload()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
