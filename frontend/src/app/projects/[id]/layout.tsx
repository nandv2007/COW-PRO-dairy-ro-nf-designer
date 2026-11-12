import React, { Suspense } from "react";

export default function ProjectWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-600">
          Loading project workspace...
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
