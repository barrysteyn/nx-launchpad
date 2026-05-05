import { Link } from '@tanstack/react-router';

export function NavBar() {
  return (
    <nav className="border-b bg-white px-6 py-3 flex gap-4">
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
    </nav>
  );
}
