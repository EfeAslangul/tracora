import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { ProductListPage } from '../pages/ProductListPage';

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="*" element={<ProductListPage />} />
      </Routes>
    </AppShell>
  );
}
