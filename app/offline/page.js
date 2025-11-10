'use client';

export default function Offline() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">You&apos;re offline</h1>
        <p className="text-gray-600 mb-4">
          Please check your internet connection and try again. Some features may still work offline.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
        >
          Retry Connection
        </button>
      </div>
    </div>
  );
}