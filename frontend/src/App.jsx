import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { SessionProvider } from './context/SessionContext'
import Header from './components/Header'
import UploadPage from './pages/UploadPage'
import ViewerPage from './pages/ViewerPage'
import CollabViewerPage from './pages/CollabViewerPage'

export default function App() {
  return (
    <ThemeProvider>
      <SessionProvider>
        <BrowserRouter>
          <Header />
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/viewer" element={<ViewerPage />} />
            <Route path="/session" element={<CollabViewerPage />} />
          </Routes>
        </BrowserRouter>
      </SessionProvider>
    </ThemeProvider>
  )
}
