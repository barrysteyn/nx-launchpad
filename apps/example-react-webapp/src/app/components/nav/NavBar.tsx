import { Link } from '@tanstack/react-router';
import { ADMIN_ROLE } from '@nx-launchpad/auth-browser';
import { authClient } from '../../lib/auth-client';

export function NavBar() {
  const { data: session } = authClient.useSession();
  const role = session?.user.role;

  return (
    <nav className="border-b bg-white px-6 py-3 flex gap-4 items-center">
      <Link
        to="/"
        className="text-gray-700 hover:text-gray-900 [&.active]:font-semibold"
      >
        Home
      </Link>
      <Link
        to="/about"
        className="text-gray-700 hover:text-gray-900 [&.active]:font-semibold"
      >
        About
      </Link>
      <Link
        to="/restricted"
        className="text-gray-700 hover:text-gray-900 [&.active]:font-semibold"
      >
        Restricted
      </Link>
      {role === ADMIN_ROLE && (
        <Link
          to="/admin"
          className="text-gray-700 hover:text-gray-900 [&.active]:font-semibold"
        >
          Admin
        </Link>
      )}
      {role && (
        <span className="ml-auto text-xs text-gray-400">
          role:{' '}
          <span className={role === ADMIN_ROLE ? 'text-green-600 font-medium' : 'text-gray-500'}>
            {role}
          </span>
        </span>
      )}
    </nav>
  );
}
