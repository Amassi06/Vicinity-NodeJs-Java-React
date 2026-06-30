import { BrowserRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import { AuthProvider } from './context/AuthContext.js';
import { AppShell, RequireAuthGate } from './layout/AppShell.js';
import { NeighbourhoodOutlet } from './layout/NeighbourhoodOutlet.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { HomePage } from './pages/HomePage.js';
import { QuartiersPage } from './pages/QuartiersPage.js';
import { EventsPage } from './pages/EventsPage.js';
import { ListingsPage } from './pages/ListingsPage.js';
import { PollsPage } from './pages/PollsPage.js';
import { MessagesPage } from './pages/MessagesPage.js';
import { MfaPage } from './pages/MfaPage.js';
import { DocumentsPage } from './pages/DocumentsPage.js';
import { PrivacyPage } from './pages/PrivacyPage.js';
import { WalletPage } from './pages/WalletPage';

export function App(): ReactElement {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route element={<RequireAuthGate />}>
              <Route element={<NeighbourhoodOutlet />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/quartiers" element={<QuartiersPage />} />
                <Route path="/evenements" element={<EventsPage />} />
                <Route path="/annonces" element={<ListingsPage />} />
                <Route path="/sondages" element={<PollsPage />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/portefeuille" element={<WalletPage />} />
                <Route path="/documents" element={<DocumentsPage />} />
                <Route path="/mfa" element={<MfaPage />} />
                <Route path="/confidentialite" element={<PrivacyPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
