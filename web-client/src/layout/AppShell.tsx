import type { ReactElement } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

export function AppShell(): ReactElement {
  const { user, logout } = useAuth();

  return (
    <div className="shell">
      <header>
        <strong>Vicinity</strong>
        <nav>
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'router-active' : '')}>
            Accueil
          </NavLink>
          <NavLink to="/quartiers" className={({ isActive }) => (isActive ? 'router-active' : '')}>
            Quartiers
          </NavLink>
          <NavLink to="/evenements" className={({ isActive }) => (isActive ? 'router-active' : '')}>
            Événements
          </NavLink>
          <NavLink to="/annonces" className={({ isActive }) => (isActive ? 'router-active' : '')}>
            Annonces
          </NavLink>
          <NavLink to="/sondages" className={({ isActive }) => (isActive ? 'router-active' : '')}>
            Sondages
          </NavLink>
          <NavLink to="/messages" className={({ isActive }) => (isActive ? 'router-active' : '')}>
            Messages
          </NavLink>
          <NavLink to="/portefeuille" className={({ isActive }) => (isActive ? 'router-active' : '')}>
            Portefeuille
          </NavLink>
          <NavLink to="/documents" className={({ isActive }) => (isActive ? 'router-active' : '')}>
            Documents
          </NavLink>
          <NavLink to="/mfa" className={({ isActive }) => (isActive ? 'router-active' : '')}>
            MFA
          </NavLink>
          <NavLink to="/confidentialite" className={({ isActive }) => (isActive ? 'router-active' : '')}>
            RGPD
          </NavLink>
          <NavLink to="/incidents" className={({ isActive }) => (isActive ? 'router-active' : '')}>
            Incidents
          </NavLink>
	  <NavLink to="/portefeuille">Points</NavLink>
          {!user ? (
            <>
              <NavLink to="/login">Connexion</NavLink>
              <NavLink to="/register">Inscription</NavLink>
            </>
          ) : (
            <span className="user-chip">{user.email}</span>
          )}
          {user ? (
            <button type="button" className="secondary" onClick={() => void logout()}>
              Déconnexion
            </button>
          ) : null}
        </nav>
      </header>
      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  );
}

export function RequireAuthGate(): ReactElement {
  const { ready, user } = useAuth();
  if (!ready) return <p className="muted">Chargement…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
