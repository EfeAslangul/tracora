import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { ProductListPage } from './ProductListPage';

describe('ProductListPage', () => {
  it('shows the Sprint 0 empty placeholder', () => {
    render(<ProductListPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Henüz izlenen ürün yok.');
  });
});
