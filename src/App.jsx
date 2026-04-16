import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Screener from './pages/Screener';
import Basket from './pages/Basket';
import ShadowPortfolio from './pages/ShadowPortfolio';
import CommodityDashboard from './pages/CommodityDashboard';
import TrendsRadar from './pages/TrendsRadar';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import StockDetails from './pages/StockDetails';
import IPOs from './pages/IPOs';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/screener" element={<Screener />} />
          <Route path="/basket" element={<Basket />} />
          <Route path="/shadow" element={<ShadowPortfolio />} />
          <Route path="/commodities" element={<CommodityDashboard />} />
          <Route path="/trends" element={<TrendsRadar />} />
          <Route path="/ipos" element={<IPOs />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/stock/:symbol" element={<StockDetails />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
