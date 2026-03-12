export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8" style={{ backgroundColor: '#1b1b1b' }}>
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#5b5fc7' }}>
            Seatvio
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Your interview preparation companion
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
