import './index.css';
import { Route, Routes } from 'react-router-dom';
import Base from './components/Base.jsx';
import Serpentin from './components/Serpentin.jsx';
import Planning from './components/Planning.jsx';
import Poule from './components/Poule.jsx';
import PhasesFinal from './components/PhasesFinal.jsx';
import ClassementFinal from './components/ClassementFinal.jsx';
import SavedTournaments from './components/SavedTournaments.jsx';
import AppHeader from './components/layout/AppHeader.jsx';
import AppToolbar from './components/layout/AppToolbar.jsx';
import LegalFooter from './components/layout/LegalFooter.jsx';
import ShareTournamentPanel from './components/live/ShareTournamentPanel.jsx';
import LiveTournamentPage from './pages/LiveTournamentPage.jsx';
import { useTournamentState } from './hooks/useTournamentState';

function MainPadelingoApp() {
    const ctx = useTournamentState();
    const { activeTab } = ctx;

    return (
        <div className="app">
            <AppHeader />
            <AppToolbar ctx={ctx} />

            <ShareTournamentPanel ctx={ctx} />

            {activeTab === 'base' ? (
                <Base ctx={ctx} />
            ) : activeTab === 'serpentin' ? (
                <Serpentin ctx={ctx} />
            ) : activeTab === 'planning' ? (
                <Planning ctx={ctx} />
            ) : activeTab === 'finals' ? (
                <PhasesFinal ctx={ctx} />
            ) : activeTab === 'final-ranking' ? (
                <ClassementFinal ctx={ctx} />
            ) : activeTab === 'saves' ? (
                <SavedTournaments ctx={ctx} />
            ) : (
                <Poule ctx={ctx} />
            )}

            <LegalFooter />
        </div>
    );
}

function App() {
    return (
        <Routes>
            <Route path="/live/:publicId" element={<LiveTournamentPage />} />
            <Route path="*" element={<MainPadelingoApp />} />
        </Routes>
    );
}

export default App;
