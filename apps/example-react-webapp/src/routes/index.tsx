import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <h1 className="text-3xl font-bold text-gray-900">Example Web App</h1>
      <p className="text-gray-500">Powered by NX</p>
    </div>
  );
}
