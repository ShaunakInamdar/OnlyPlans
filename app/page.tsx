import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 gap-8">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl font-bold mb-4">The Baseline</h1>
        <p className="text-xl text-gray-500 mb-8">
          Your hackathon starter — auth, database, and AI already wired up.
          Just build.
        </p>

        <div className="flex gap-4 justify-center">
          <SignedOut>
            <Link
              href="/sign-in"
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Sign Up
            </Link>
          </SignedOut>

          <SignedIn>
            <Link
              href="/dashboard"
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition"
            >
              Go to Dashboard
            </Link>
            <UserButton />
          </SignedIn>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 w-full max-w-2xl">
        {[
          { name: "Next.js 15", desc: "App Router + API Routes" },
          { name: "Clerk", desc: "Auth, sessions, user mgmt" },
          { name: "Supabase", desc: "Postgres + realtime" },
          { name: "Claude AI", desc: "Anthropic AI integration" },
        ].map((item) => (
          <div
            key={item.name}
            className="border border-gray-200 rounded-lg p-4 text-center"
          >
            <p className="font-semibold">{item.name}</p>
            <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
