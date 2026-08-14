import { Outlet, useNavigate, Link, useLocation } from 'react-router';
import { useAuth } from '../features/auth/AuthProvider';
import { OrgProvider, useOrg } from '../features/organizations/OrgContext';
import type { Organization } from '../features/organizations/OrgContext';
import { SuspendedTenant } from '../features/organizations/SuspendedTenant';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type NavItem = {
  to: string;
  label: string;
  exact?: boolean;
  icon: React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  {
    to: '/app',
    label: 'Dashboard',
    exact: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    to: '/app/beneficiarios',
    label: 'Beneficiarios',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    to: '/app/representantes',
    label: 'Representantes',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    to: '/app/asistencia',
    label: 'Asistencia',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    to: '/app/cobros',
    label: 'Cobros y Pagos',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    to: '/app/equipo',
    label: 'Equipo',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    to: '/app/finanzas',
    label: 'Reportes',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const location = useLocation();
  const isActive = item.exact
    ? location.pathname === item.to
    : location.pathname.startsWith(item.to);

  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? 'bg-indigo-50 text-indigo-700'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <span className={isActive ? 'text-indigo-600' : 'text-slate-400'}>{item.icon}</span>
      {item.label}
    </Link>
  );
}

function LayoutContent() {
  const { user, signOut } = useAuth();
  const { currentOrg, organizations, isLoading, setCurrentOrg, isActive, refreshOrgs } = useOrg();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [isFetchingOrgs, setIsFetchingOrgs] = useState(false);

  useEffect(() => {
    supabase.rpc('is_platform_admin').then(({ data }) => {
      if (data) {
        navigate('/admin', { replace: true });
      }
    });
  }, [navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const SidebarContent = ({ onNavClick }: { onNavClick?: () => void }) => (
    <>
      {/* Org selector display */}
      <div className="p-4 border-b border-slate-100 min-h-[85px] flex flex-col justify-center">
        {isLoading ? (
          <div className="animate-pulse">
            <div className="h-3 bg-slate-200 rounded w-20 mb-2.5 ml-1"></div>
            <div className="h-9 bg-slate-100 ring-1 ring-inset ring-slate-200 rounded-lg w-full"></div>
          </div>
        ) : currentOrg ? (
          <div>
            <div className="flex items-center justify-between mb-1.5 ml-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Centro Actual
              </label>
              <button
                onClick={async () => {
                  setIsOrgModalOpen(true);
                  if (organizations.length === 0) {
                    setIsFetchingOrgs(true);
                    await refreshOrgs();
                    setIsFetchingOrgs(false);
                  }
                }}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded cursor-pointer transition-colors"
              >
                Cambiar
              </button>
            </div>
            <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg shadow-sm">
              <p className="text-sm font-bold text-slate-800 truncate">{currentOrg.name}</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} item={item} onClick={onNavClick} />
        ))}

        {/* Nueva Matrícula CTA */}
        <div className="pt-3 mt-2 border-t border-slate-100">
          <Link
            to="/app/matricula"
            onClick={onNavClick}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Nueva Matrícula
          </Link>
        </div>
      </nav>

      {/* User footer with collapse popover */}
      <div className="p-4 border-t border-slate-200 relative">
        <button
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-slate-800 truncate">{user?.email?.split('@')[0] || 'Usuario'}</p>
              <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>

        {/* Collapse / Popover Menu */}
        {isUserMenuOpen && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 space-y-1 z-50">
            <Link
              to="/app/configuracion"
              onClick={() => { setIsUserMenuOpen(false); onNavClick?.(); }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
            >
              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Configuración del Centro
            </Link>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer text-left"
            >
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Cerrar sesión
            </button>
          </div>
        )}
      </div>

      {/* Switch Organization Modal */}
      {isOrgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-popIn border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800">Cambiar de Centro</h3>
              <button 
                onClick={() => setIsOrgModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 max-h-64 overflow-y-auto">
              {isFetchingOrgs ? (
                <div className="flex justify-center items-center py-6 text-slate-400 text-sm">
                  <div className="animate-pulse flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-indigo-600 animate-spin"></div>
                    Cargando centros...
                  </div>
                </div>
              ) : organizations.length === 0 ? (
                <p className="text-center text-sm text-slate-500 py-4">No hay otros centros disponibles.</p>
              ) : (
                <div className="space-y-2">
                  {organizations.map(org => (
                    <button
                      key={org.id}
                      onClick={() => {
                        setCurrentOrg(org);
                        setIsOrgModalOpen(false);
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                        currentOrg?.id === org.id 
                          ? 'border-indigo-500 bg-indigo-50 shadow-sm ring-1 ring-indigo-500' 
                          : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                      }`}
                    >
                      <p className={`font-bold text-sm ${currentOrg?.id === org.id ? 'text-indigo-900' : 'text-slate-700'}`}>
                        {org.name}
                      </p>
                      {currentOrg?.id === org.id && (
                        <p className="text-[10px] font-semibold text-indigo-500 mt-0.5">Centro Activo</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">

      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-white border-r border-slate-200 shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-slate-200">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg shadow-sm flex items-center justify-center text-white font-bold tracking-tight text-sm">
            NK
          </div>
          <div className="ml-3">
            <span className="text-lg font-bold tracking-tight text-slate-900 leading-none">NexoKids</span>
          </div>
        </div>
        <SidebarContent />
      </aside>

      {/* --- MOBILE SIDEBAR & OVERLAY --- */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <aside className="relative flex-1 max-w-xs w-full bg-white flex flex-col shadow-xl">
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">NK</div>
                <span className="text-lg font-bold text-slate-900">NexoKids</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-500 hover:text-slate-900">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <SidebarContent onNavClick={() => setIsMobileMenuOpen(false)} />
          </aside>
        </div>
      )}

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col overflow-hidden relative">

        {/* Mobile Header */}
        <header className="lg:hidden h-16 bg-white border-b border-slate-200 flex items-center px-4 justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-500 hover:text-slate-900">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-lg font-bold text-slate-900">{currentOrg?.name || 'NexoKids'}</span>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto h-full">
            {isActive === false ? <SuspendedTenant /> : <Outlet />}
          </div>
        </div>
      </main>
    </div>
  );
}

export function UserLayout() {
  return (
    <OrgProvider>
      <LayoutContent />
    </OrgProvider>
  );
}
