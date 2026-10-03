// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import AuthModal from "./AuthModal";

/**
 * The one global, reachable entry point into real accounts (phase 1 of
 * #36/V3.6) — every other page in this app rolls its own bespoke header, so
 * rather than redesign each one (out of scope for "make login/signup
 * real"), this is a small fixed corner widget available everywhere via
 * RootLayout. Anonymous usage is completely unaffected: nothing here gates
 * any page, it only adds a way to sign in if you want to.
 */
export default function AuthWidget() {
  const { data: session, status } = useSession();
  const [modalOpen, setModalOpen] = useState(false);

  if (status === "loading") return null;

  return (
    <>
      <div className="fixed top-3 right-3 z-40">
        {session?.user ? (
          <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full pl-3 pr-1.5 py-1 shadow-sm text-xs">
            <span className="text-gray-700 font-medium max-w-[140px] truncate">
              {session.user.name ?? session.user.email}
            </span>
            <button
              onClick={() => signOut()}
              className="text-gray-400 hover:text-red-500 px-2 py-1 rounded-full hover:bg-gray-50 transition-colors font-medium"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={() => setModalOpen(true)}
            className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full px-3 py-1.5 shadow-sm text-xs font-semibold text-gray-700 hover:bg-white transition-colors"
          >
            Sign in
          </button>
        )}
      </div>

      <AuthModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
