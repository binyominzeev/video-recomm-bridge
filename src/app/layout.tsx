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
          <nav className="bg-gray-900 px-6 py-3 text-white">
            <div className="flex items-center gap-6">
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
              <Link href="/search" className="text-sm hover:text-gray-300">
                Search
              </Link>
            </div>
          </nav>
          <main className="p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
