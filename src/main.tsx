import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: { borderRadius: '12px', fontFamily: 'inherit', fontSize: '14px' },
          success: { iconTheme: { primary: '#0d9488', secondary: '#fff' } },
        }}
      />
    </BrowserRouter>
  </StrictMode>,
)
