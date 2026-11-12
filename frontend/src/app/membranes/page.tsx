"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { MembraneExplorer } from "@/components/membranes/MembraneExplorer";

export default function MembraneDatabasePage() {
  return (
    <AppShell>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Membrane Database</h1>
          <p className="text-sm text-slate-500 mt-1">
            COW PRO Version 1 catalog featuring the 8 preliminary reference elements. Confirm exact
            manufacturer datasheet specifications before marking designs as Manufacturer Verified.
          </p>
        </div>
        <MembraneExplorer mode="browse" />
      </div>
    </AppShell>
  );
}
