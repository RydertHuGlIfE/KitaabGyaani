import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import Header from './components/Header'
import UploadPage from './pages/UploadPage'
import ViewerPage from './pages/ViewerPage'

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Header />
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/viewer" element={<ViewerPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
