import { BrowserRouter, Routes, Route } from 'react-router-dom'
import TopNav from './components/TopNav.jsx'
import TodayView from './components/TodayView.jsx'
import LibraryPage from './components/LibraryPage.jsx'
import StatsPage from './components/StatsPage.jsx'
import HistoryLessonView from './components/HistoryLessonView.jsx'
import NotesPage from './components/NotesPage.jsx'
import TopicMapPage from './components/TopicMapPage.jsx'
import SearchPage from './components/SearchPage.jsx'
import BookmarksPage from './components/BookmarksPage.jsx'
import TimelinePage from './components/TimelinePage.jsx'
import TILPage from './components/TILPage.jsx'
import HighlightsPage from './components/HighlightsPage.jsx'
import GlossaryPage from './components/GlossaryPage.jsx'
import SnippetsPage from './components/SnippetsPage.jsx'
import ReviewPage from './components/ReviewPage.jsx'
import ReviewSplitPage from './components/ReviewSplitPage.jsx'
import CollectionsPage from './components/CollectionsPage.jsx'
import PlannerPage from './components/PlannerPage.jsx'
import FlashcardsPage from './components/FlashcardsPage.jsx'
import './styles/globals.css'

export default function App() {
  return (
    <BrowserRouter>
      <TopNav />
      <Routes>
        <Route path="/" element={<TodayView />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/lesson/:slug" element={<HistoryLessonView />} />
        <Route path="/map" element={<TopicMapPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/bookmarks" element={<BookmarksPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/til" element={<TILPage />} />
        <Route path="/highlights" element={<HighlightsPage />} />
        <Route path="/glossary" element={<GlossaryPage />} />
        <Route path="/snippets" element={<SnippetsPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/review/lesson/:slug" element={<ReviewSplitPage />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/planner" element={<PlannerPage />} />
        <Route path="/flashcards" element={<FlashcardsPage />} />
      </Routes>
    </BrowserRouter>
  )
}
