import { Outlet, useNavigate } from 'react-router';
import { useAuth } from '../features/auth/AuthProvider';
import { OrgProvider, useOrg } from '../features/organizations/OrgContext';
import type { Organization } from '../features/organizations/OrgContext';

function LayoutContent() {
  const { user, signOut } = useAuth();
  const { currentOrg, organizations, setCurrentOrg, isLoading } = useOrg();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between items-center">
            <div className="flex items-center space-x-8">
              <div className="flex flex-shrink-0 items-center">
                <span className="text-xl font-bold text-indigo-600">NexoKids</span>
              </div>
              
              {!isLoading && organizations.length > 0 && (
                <div className="relative">
                  <select
                    value={currentOrg?.id || ''}
                    onChange={(e) => {
                      const org = organizations.find((o: Organization) => o.id === e.target.value);
                      if (org) setCurrentOrg(org);
                    }}
                    className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  >
                    {organizations.map(org => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700">{user?.email}</span>
              <button
                onClick={handleSignOut}
                className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="py-10">
        <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
          <Outlet />
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
