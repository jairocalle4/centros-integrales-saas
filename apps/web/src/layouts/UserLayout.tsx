import { Outlet, useNavigate, Link, useLocation } from 'react-router';
import { useAuth } from '../features/auth/AuthProvider';
import { OrgProvider, useOrg } from '../features/organizations/OrgContext';
import type { Organization } from '../features/organizations/OrgContext';
import { SuspendedTenant } from '../features/organizations/SuspendedTenant';
import { BillingGraceAlert } from '../features/organizations/BillingGraceAlert';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';

type NavItem = {
  to: string;
  label: string;
  exact?: boolean;
  icon: React.ReactNode;
};

const BASE_NAV_ITEMS: NavItem[] = [
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
    to: '/app/gastos',
    label: 'Gastos',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4m16 0a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4a2 2 0 012-2m16 0a2 2 0 00-2-2H6a2 2 0 00-2 2m8-8v4m-3-2h6" />
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

const FACTURAS_NAV_ITEM: NavItem = {
  to: '/app/facturas',
  label: 'Facturas',
  icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
};

function buildNavItems(hasElectronicBilling: boolean): NavItem[] {
  if (!hasElectronicBilling) return BASE_NAV_ITEMS;
  const cobrosIndex = BASE_NAV_ITEMS.findIndex((item) => item.to === '/app/cobros');
  const items = [...BASE_NAV_ITEMS];
  items.splice(cobrosIndex + 1, 0, FACTURAS_NAV_ITEM);
  return items;
}

// Fast, styled replacement for the native `title` tooltip — the browser
// default has a near-1s delay and can't be themed. Rendered through a
// portal straight into <body> with fixed positioning computed from the
// trigger's own bounding box: it never lives inside the sidebar's scroll
// container, so it can't push that container into horizontal overflow
// the way an absolutely-positioned child (even an invisible one) does.
function SidebarTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const show = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.top + rect.height / 2, left: rect.right + 10 });
  };
  const hide = () => setCoords(null);

  return (
    <div ref={triggerRef} className="w-full" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {coords && createPortal(
        <span
          role="tooltip"
          style={{ top: coords.top, left: coords.left }}
          className="fixed z-[100] -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg pointer-events-none animate-fadeIn"
        >
          {label}
        </span>,
        document.body
      )}
    </div>
  );
}

function UserMenuPopoverItems({ onSelect, onSignOut }: { onSelect: () => void; onSignOut: () => void }) {
  return (
    <>
      <Link
        to="/app/configuracion"
        onClick={onSelect}
        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
      >
        <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Configuración del Centro
      </Link>
      <button
        onClick={onSignOut}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer text-left"
      >
        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Cerrar sesión
      </button>
    </>
  );
}

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

function CollapsedNavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const location = useLocation();
  const isActive = item.exact
    ? location.pathname === item.to
    : location.pathname.startsWith(item.to);

  return (
    <SidebarTooltip label={item.label}>
      <Link
        to={item.to}
        onClick={onClick}
        className={`w-full flex items-center justify-center p-2.5 rounded-lg transition-colors ${
          isActive
            ? 'bg-indigo-50 text-indigo-600'
            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
        }`}
      >
        {item.icon}
      </Link>
    </SidebarTooltip>
  );
}

function SelectOrganizationScreen({
  organizations,
  onSelect,
  onSignOut,
  userEmail,
}: {
  organizations: Organization[];
  onSelect: (org: Organization) => void;
  onSignOut: () => void;
  userEmail?: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg shadow-sm flex items-center justify-center text-white font-bold text-sm mb-3">
            NK
          </div>
          <h1 className="font-bold text-slate-900 text-lg">Selecciona un centro</h1>
          <p className="text-sm text-slate-500 mt-1">
            {userEmail} tiene acceso a más de una organización. Elige con cuál quieres trabajar ahora.
          </p>
        </div>

        <div className="p-4 max-h-80 overflow-y-auto">
          {organizations.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-6">
              No tienes ninguna organización activa todavía. Contacta al administrador de tu centro para que te invite.
            </p>
          ) : (
            <div className="space-y-2">
              {organizations.map(org => (
                <button
                  key={org.id}
                  onClick={() => onSelect(org)}
                  className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  <p className="font-bold text-sm text-slate-700">{org.name}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onSignOut}
            className="text-xs font-semibold text-red-600 hover:text-red-800 cursor-pointer"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}

function LayoutContent() {
  const { user, signOut } = useAuth();
  const { currentOrg, organizations, isLoading, setCurrentOrg, isActive, currentRole, refreshOrgs, hasElectronicBilling } = useOrg();
  const navItems = buildNavItems(hasElectronicBilling);
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [isFetchingOrgs, setIsFetchingOrgs] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('nexo_sidebar_collapsed') === '1');
  const userMenuRef = useRef<HTMLDivElement>(null);
  // When the sidebar is collapsed, the popover is portaled out of the
  // <aside> (which clips overflow-x) — this second ref lets the
  // click-outside check also recognize clicks landing inside that
  // portaled content as "inside".
  const collapsedMenuRef = useRef<HTMLDivElement>(null);
  const [collapsedMenuCoords, setCollapsedMenuCoords] = useState<{ left: number; bottom: number } | null>(null);

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (userMenuRef.current?.contains(target)) return;
      if (collapsedMenuRef.current?.contains(target)) return;
      setIsUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUserMenuOpen]);

  const toggleSidebarCollapsed = () => {
    setIsSidebarCollapsed(prev => {
      localStorage.setItem('nexo_sidebar_collapsed', prev ? '0' : '1');
      return !prev;
    });
  };

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

  if (!isLoading && !currentOrg) {
    return (
      <SelectOrganizationScreen
        organizations={organizations}
        onSelect={setCurrentOrg}
        onSignOut={handleSignOut}
        userEmail={user?.email}
      />
    );
  }

  const SidebarContent = ({ onNavClick, collapsed = false }: { onNavClick?: () => void; collapsed?: boolean }) => (
    <>
      {/* Org selector display */}
      <div className={`border-b border-slate-100 flex flex-col justify-center ${collapsed ? 'p-2 min-h-[85px] items-center' : 'p-4 min-h-[85px]'}`}>
        {isLoading ? (
          <div className="animate-pulse w-full">
            <div className="h-3 bg-slate-200 rounded w-20 mb-2.5 ml-1"></div>
            <div className="h-9 bg-slate-100 ring-1 ring-inset ring-slate-200 rounded-lg w-full"></div>
          </div>
        ) : currentOrg ? (
          collapsed ? (
            <SidebarTooltip label={`Centro actual: ${currentOrg.name} — clic para cambiar`}>
              <button
                onClick={async () => {
                  setIsOrgModalOpen(true);
                  if (organizations.length === 0) {
                    setIsFetchingOrgs(true);
                    await refreshOrgs();
                    setIsFetchingOrgs(false);
                  }
                }}
                className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 hover:border-indigo-300 flex items-center justify-center font-bold text-indigo-700 text-sm cursor-pointer transition-colors mx-auto"
              >
                {currentOrg.name[0]?.toUpperCase() ?? '?'}
              </button>
            </SidebarTooltip>
          ) : (
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
          )
        ) : null}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-1 ${collapsed ? 'px-2' : 'px-4'}`}>
        {navItems.map((item) => (
          collapsed ? (
            <CollapsedNavLink key={item.to} item={item} onClick={onNavClick} />
          ) : (
            <NavLink key={item.to} item={item} onClick={onNavClick} />
          )
        ))}

        {/* Nueva Matrícula CTA */}
        <div className="pt-3 mt-2 border-t border-slate-100">
          {collapsed ? (
            <SidebarTooltip label="Nueva Matrícula">
              <Link
                to="/app/matricula"
                onClick={onNavClick}
                className="flex items-center justify-center p-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md hover:shadow-lg active:scale-95"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </Link>
            </SidebarTooltip>
          ) : (
            <Link
              to="/app/matricula"
              onClick={onNavClick}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Nueva Matrícula
            </Link>
          )}
        </div>
      </nav>

      {/* User footer with collapse popover */}
      <div className={`border-t border-slate-200 relative ${collapsed ? 'p-2' : 'p-4'}`} ref={userMenuRef}>
        <button
          onClick={() => {
            if (collapsed && !isUserMenuOpen) {
              const rect = userMenuRef.current?.getBoundingClientRect();
              if (rect) setCollapsedMenuCoords({ left: rect.right + 8, bottom: window.innerHeight - rect.bottom });
            }
            setIsUserMenuOpen(!isUserMenuOpen);
          }}
          className={`w-full flex items-center rounded-xl hover:bg-slate-100 transition-colors cursor-pointer ${
            collapsed ? 'justify-center p-2' : 'justify-between p-2 text-left'
          }`}
        >
          <div className={`flex items-center ${collapsed ? '' : 'gap-3'}`}>
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-800 truncate">{user?.email?.split('@')[0] || 'Usuario'}</p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          )}
        </button>

        {/* Collapse / Popover Menu */}
        {isUserMenuOpen && (
          collapsed && collapsedMenuCoords ? createPortal(
            <div
              ref={collapsedMenuRef}
              style={{ position: 'fixed', left: collapsedMenuCoords.left, bottom: collapsedMenuCoords.bottom }}
              className="w-48 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 space-y-1 z-[100] animate-popIn"
            >
              <UserMenuPopoverItems onSelect={() => { setIsUserMenuOpen(false); onNavClick?.(); }} onSignOut={handleSignOut} />
            </div>,
            document.body
          ) : (
            <div className="absolute bottom-full mb-2 left-4 right-4 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 space-y-1 z-50 animate-popIn">
              <UserMenuPopoverItems onSelect={() => { setIsUserMenuOpen(false); onNavClick?.(); }} onSignOut={handleSignOut} />
            </div>
          )
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
      <aside className={`hidden lg:flex lg:flex-col bg-white border-r border-slate-200 shrink-0 overflow-x-hidden transition-all duration-200 ease-in-out ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className={`h-16 flex items-center border-b border-slate-200 ${isSidebarCollapsed ? 'justify-center px-2' : 'px-6'}`}>
          {!isSidebarCollapsed && (
            <>
              <div className="w-8 h-8 bg-indigo-600 rounded-lg shadow-sm flex items-center justify-center text-white font-bold tracking-tight text-sm shrink-0">
                NK
              </div>
              <div className="ml-3 flex-1 overflow-hidden">
                <span className="text-lg font-bold tracking-tight text-slate-900 leading-none">NexoKids</span>
              </div>
            </>
          )}
          <button
            onClick={toggleSidebarCollapsed}
            title={isSidebarCollapsed ? 'Expandir menú' : 'Colapsar menú a solo íconos'}
            className="text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg p-1.5 transition-colors cursor-pointer"
          >
            <svg className={`w-4 h-4 transition-transform duration-200 ${isSidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <SidebarContent collapsed={isSidebarCollapsed} />
      </aside>

      {/* --- MOBILE SIDEBAR & OVERLAY --- */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm animate-fadeIn" onClick={() => setIsMobileMenuOpen(false)} />
          <aside className="relative flex-1 max-w-xs w-full bg-white flex flex-col shadow-xl animate-slideInLeft">
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

      {/* Aviso de plan vencido — solo mientras el centro sigue activo
          (isActive) y solo para el dueño; SuspendedTenant ya cubre el
          caso de que la suspensión automática ya haya ocurrido. */}
      {isActive && currentRole === 'owner' && currentOrg && (
        <BillingGraceAlert organizationId={currentOrg.id} />
      )}
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
