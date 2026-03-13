import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock fetch para API
vi.stubGlobal('fetch', vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve([{ id: '1', catalogo: 'ELF 100E', familia: 'ELF', precio: '766800' }]),
  } as Response)
));

describe('App', () => {
  it('debe renderizar el login o la app', () => {
    render(<App />);
    expect(screen.getByText(/ISUZU/i)).toBeTruthy();
  });
});
