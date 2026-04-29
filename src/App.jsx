import './index.css';
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
import { useTournamentState } from './hooks/useTournamentState';

function App() {
    const ctx = useTournamentState();
    const { activeTab } = ctx;

    return (
        <div className="app">
            <AppHeader />
            <AppToolbar ctx={ctx} />

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

export default App;
