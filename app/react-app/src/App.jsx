import { BrowserRouter, Routes, Route } from 'react-router-dom'
import TopNav from './components/TopNav.jsx'
import TodayView from './components/TodayView.jsx'
import LibraryPage from './components/LibraryPage.jsx'
import StatsPage from './components/StatsPage.jsx'
import HistoryLessonView from './components/HistoryLessonView.jsx'
import './styles/globals.css'

export default function App() {
  return (
    <BrowserRouter>
      <TopNav />
      <Routes>
        <Route path="/" element={<TodayView />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/lesson/:slug" element={<HistoryLessonView />} />
      </Routes>
    </BrowserRouter>
  )
}
