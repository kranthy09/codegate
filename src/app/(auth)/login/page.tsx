// Auth is handled entirely by the external system.
// Users land here only if their external JWT is missing/expired.
// Direct them to the external login URL.

export default function LoginPage() {
  const externalLoginUrl = process.env.NEXT_PUBLIC_LOGIN_URL ?? '/api/auth/me'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 w-full max-w-sm text-center space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">CodeGate</h1>
          <p className="text-sm text-gray-500 mt-1">Interview Portal</p>
        </div>
        <p className="text-sm text-gray-600">
          Your session has expired or you are not authenticated.
        </p>
        <a
          href={externalLoginUrl}
          className="block w-full px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors text-center"
        >
          Sign in
        </a>
      </div>
    </div>
  )
}
