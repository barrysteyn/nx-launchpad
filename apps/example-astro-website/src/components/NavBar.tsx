interface NavBarProps {
  siteName: string;
}

export function NavBar({ siteName }: NavBarProps) {
  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
      <a href="/" className="text-xl font-bold tracking-tight">
        {siteName}
      </a>
      <div className="flex gap-6 text-sm font-medium">
        <a
          href="/"
          className="text-gray-600 hover:text-gray-900 transition-colors"
        >
          Home
        </a>
        <a
          href="/about"
          className="text-gray-600 hover:text-gray-900 transition-colors"
        >
          About
        </a>
      </div>
    </nav>
  );
}
