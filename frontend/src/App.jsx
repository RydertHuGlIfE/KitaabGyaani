import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import UploadPage from './pages/UploadPage'
import ViewerPage from './pages/ViewerPage'
import CollabViewerPage from './pages/CollabViewerPage'

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/viewer" element={<ViewerPage />} />
        <Route path="/session" element={<CollabViewerPage />} />
      </Routes>
    </BrowserRouter>
  )
}
