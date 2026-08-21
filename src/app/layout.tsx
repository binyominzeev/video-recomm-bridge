import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "Video Recomm Bridge - Admin",
  description: "Admin panel for video processing pipeline",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-gray-50">
          <nav className="bg-gray-900 px-3 py-3 text-white sm:px-6">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-6">
              <span className="text-lg font-bold">📹 VRB Admin</span>
              <Link href="/" className="text-sm hover:text-gray-300">
                Dashboard
              </Link>
              <Link href="/sources" className="text-sm hover:text-gray-300">
                Sources
              </Link>
              <Link href="/videos" className="text-sm hover:text-gray-300">
                Videos
              </Link>
              <Link href="/batches" className="text-sm hover:text-gray-300">
                Batches
              </Link>
              <Link href="/claims" className="text-sm hover:text-gray-300">
                Claims
              </Link>
              <Link href="/search" className="text-sm hover:text-gray-300">
                Search
              </Link>
            </div>
          </nav>
          <main className="p-3 sm:p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
