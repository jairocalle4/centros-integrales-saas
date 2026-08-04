import { Link } from 'react-router';

export default function App() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">NexoKids</h1>
        <p className="mt-4 text-lg text-gray-500">Sistema Administrativo de Centros Integrales</p>
        <div className="mt-8">
          <Link
            to="/login"
            className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Iniciar Sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
