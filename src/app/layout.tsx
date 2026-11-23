import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LabLink — GenAI Campus Laboratory Resource Sharing",
  description:
    "Discover specialized college lab equipment across departments, book project-tied slots, route faculty approvals, and resolve scheduling conflicts fairly with GenAI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased selection:bg-[#2CBEF1] selection:text-[#051124]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[#82FA6F] focus:text-[#051124] focus:font-bold"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}