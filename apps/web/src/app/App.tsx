import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { ProductListPage } from '../pages/ProductListPage';
import { SetupPage } from '../pages/SetupPage';
import { SetupGuard } from './SetupGuard';

export function App() {
  return (
    <AppShell>
      <SetupGuard>
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/products" element={<ProductListPage />} />
          <Route path="*" element={<ProductListPage />} />
        </Routes>
      </SetupGuard>
    </AppShell>
  );
}
