import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Shell from "@/components/Shell";
import { Spinner } from "@/components/ui";
import { LiveProvider } from "@/lib/live";
import { SessionProvider, useSession } from "@/lib/session";
import Dashboard from "@/pages/Dashboard";
import Journey from "@/pages/Journey";
import Pulse from "@/pages/Pulse";
import Setup from "@/pages/Setup";
import SignIn, { NotOnTeam } from "@/pages/SignIn";
import Team from "@/pages/Team";

/** The gate: signed out is the sign-in, signed in but not on the team is a polite no, the team gets the app. */
function Gate() {
  const { loading, user, me, signOut } = useSession();
  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4">
        <img src="/icon.svg" alt="" width={44} height={44} className="cc-mark" style={{ borderRadius: 12 }} />
        <span className="cc-secondary">
          <Spinner size={24} label="Loading" />
        </span>
      </div>
    );
  }
  if (!user) return <SignIn />;
  if (!me) return <NotOnTeam email={user.email} onSignOut={signOut} />;
  return (
    <LiveProvider>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pulse" element={<Pulse />} />
          <Route path="/journey" element={<Journey />} />
          <Route path="/team" element={<Team />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </LiveProvider>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </SessionProvider>
  );
}
