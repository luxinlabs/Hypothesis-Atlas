// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { SessionProvider } from "next-auth/react";

/** next-auth's SessionProvider is a client component — RootLayout (src/app/layout.tsx) is a server component, so this thin wrapper is the standard way to use it in the App Router. */
export default function SessionProviderWrapper({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
