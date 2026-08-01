import type { PropsWithChildren } from 'react';

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <a href="/" className="brand" aria-label="Product Tracker ana sayfa">
          Product Tracker
        </a>
        <span className="system-status" aria-label="Sistem durumu henüz yapılandırılmadı">
          Sistem durumu: hazırlanıyor
        </span>
      </header>
      <main>{children}</main>
    </div>
  );
}
