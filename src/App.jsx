import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Shell from "@/components/Shell";
import Home from "@/pages/Home";
import Journey from "@/pages/Journey";
import Pulse from "@/pages/Pulse";
import Setup from "@/pages/Setup";
import SignIn, { NotOnTeam } from "@/pages/SignIn";
import { SessionProvider, useSession } from "@/lib/session";

function Gate() {
  const { loading, user, me, signOut } = useSession();
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-line border-t-accent rounded-full animate-spin" aria-label="Loading" />
      </div>
    );
  }
  if (!user) return <SignIn />;
  if (!me) return <NotOnTeam email={user.email} onSignOut={signOut} />;
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Home />} />
        <Route path="/pulse" element={<Pulse />} />
        <Route path="/journey" element={<Journey />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
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
