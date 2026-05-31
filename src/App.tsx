import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import TableDetail from './pages/TableDetail';
import Players from './pages/Players';
import PlayerProfile from './pages/PlayerProfile';
import Layout from './components/Layout';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/table/:id" element={<TableDetail />} />
          <Route path="/players" element={<Players />} />
          <Route path="/player/:id" element={<PlayerProfile />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
