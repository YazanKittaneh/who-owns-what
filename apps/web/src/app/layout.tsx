import type { Metadata } from "next";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Who Owns What",
  description: "Who Owns What MVP on OpenNext + Convex",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ConvexAuthNextjsServerProvider storageNamespace="wow-mvp-auth">
          <Providers>{children}</Providers>
        </ConvexAuthNextjsServerProvider>
      </body>
    </html>
  );
}
