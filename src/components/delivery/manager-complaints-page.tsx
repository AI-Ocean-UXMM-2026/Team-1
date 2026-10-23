"use client";

import { useState } from "react";
import { AuthDialog } from "@/components/delivery/auth-dialog";
import {
  LoadingBlock,
  signOut,
  UserActions,
} from "@/components/delivery/common";
import { ComplaintsApp } from "@/components/delivery/complaints-app";
import { ManagerSidebar } from "@/components/delivery/manager-sidebar";
import { useWorkspace } from "@/lib/delivery/use-workspace";
import "./manager-complaints-page.css";

export function ManagerComplaintsPage() {
  const workspace = useWorkspace("manager");
  const [authOpen, setAuthOpen] = useState(false);

  if (workspace.isLoading) {
    return <LoadingBlock title="Opening complaints dashboard…" />;
  }

  return (
    <main className="manager-app manager-complaints-page">
      <ManagerSidebar active="complaints" />

      <div className="manager-main">
        <header className="manager-topbar manager-complaints-topbar">
          <div style={{ flex: 1 }} />
          <UserActions
            profile={workspace.profile}
            isAuthenticated={workspace.isAuthenticated}
            onSignIn={() => setAuthOpen(true)}
            onSignOut={() => void signOut()}
            label="Manager"
          />
        </header>

        <div className="manager-content">
          <div className="manager-complaints-view">
            <ComplaintsApp hideMobileNav hideClassification />
          </div>
        </div>
      </div>

      <AuthDialog
        open={authOpen}
        audience="team"
        onClose={() => setAuthOpen(false)}
      />
    </main>
  );
}
