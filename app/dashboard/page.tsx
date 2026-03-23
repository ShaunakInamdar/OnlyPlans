import { auth, currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import Chat from "@/components/chat";

export default async function DashboardPage() {
  const { userId } = await auth();
  const user = await currentUser();

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Welcome back, {user?.firstName ?? "there"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-800">
            ← Home
          </Link>
          <UserButton />
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-6 mb-8 max-w-md">
        <h2 className="font-semibold mb-3">Session Info</h2>
        <div className="space-y-2 text-sm text-gray-600">
          <p>
            <span className="font-medium text-gray-900">User ID:</span>{" "}
            {userId}
          </p>
          <p>
            <span className="font-medium text-gray-900">Email:</span>{" "}
            {user?.emailAddresses[0]?.emailAddress}
          </p>
        </div>
      </div>

      <div className="max-w-2xl">
        <h2 className="font-semibold text-xl mb-4">AI Assistant</h2>
        <Chat />
      </div>
    </main>
  );
}
