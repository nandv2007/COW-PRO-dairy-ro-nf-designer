"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  CheckCircle2,
  Database,
  Droplets,
  FileText,
  FolderKanban,
  Gauge,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  PlusCircle,
  Settings,
  SlidersHorizontal,
  User,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { cn, projectStatusColor } from "@/lib/utils";
import { Badge } from "@/components/ui";

const WORKFLOW_STEPS = [
  { key: "setup", label: "Project Setup", path: "setup" },
  { key: "feed", label: "Feed Analysis", path: "feed" },
  { key: "equipment", label: "Equipment Design", path: "equipment" },
  { key: "simulation", label: "Simulation", path: "simulation" },
  { key: "results", label: "Results", path: "results" },
  { key: "report", label: "Report", path: "report" },
];

export function AppShell({
  children,
  activeStep,
}: {
  children: React.ReactNode;
  activeStep?: string;
}) {
  const { user, loading, logout, updateUnits } = useAuth();
  const { currentProject, projects, loadProjectsList, saveStatus } = useProject();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unitsOpen, setUnitsOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user && projects.length === 0) {
      loadProjectsList().catch(() => {});
    }
  }, [user, projects.length, loadProjectsList]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-600">Loading COW PRO workspace...</p>
        </div>
      </div>
    );
  }

  const targetProjectId = currentProject?.id || projects[0]?.id;

  const projectRoute = (subpath: string) =>
    targetProjectId ? `/projects/${targetProjectId}/${subpath}` : "/projects";

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "New Project", href: "/projects/new", icon: PlusCircle },
    { label: "My Projects", href: "/projects", icon: FolderKanban },
    { label: "Feed Analysis", href: projectRoute("feed"), icon: Droplets },
    { label: "Equipment Design", href: projectRoute("equipment"), icon: SlidersHorizontal },
    { label: "Membrane Selection", href: targetProjectId ? `/projects/${targetProjectId}/equipment?tab=membranes` : "/membranes", icon: Layers },
    { label: "Process Simulation", href: projectRoute("simulation"), icon: Activity },
    { label: "Results", href: projectRoute("results"), icon: BarChart3 },
    { label: "Reports", href: projectRoute("report"), icon: FileText },
    { label: "Membrane Database", href: "/membranes", icon: Database },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  const validation = currentProject?.latest_simulation?.result_snapshot?.validation;
  const alertCount =
    (validation?.failed_count || 0) +
    (validation?.warning_count || 0) +
    (validation?.not_evaluated_count || 0);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 overflow-x-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar (Deep Navy/Charcoal) */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-slate-950 text-slate-200 flex flex-col border-r border-slate-800 transition-transform duration-200 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-sky-600 text-white font-bold text-sm shadow-sm">
              CP
            </div>
            <div>
              <span className="block text-sm font-bold tracking-wider text-white">COW PRO</span>
              <span className="block text-[10px] text-teal-400 uppercase tracking-widest">
                RO / NF Design v1.0
              </span>
            </div>
          </Link>
          <button
            className="lg:hidden p-1 text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const baseHref = item.href.split("?")[0];
            const isActive =
              pathname === baseHref ||
              (baseHref !== "/dashboard" &&
                baseHref !== "/projects" &&
                pathname.startsWith(baseHref));
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-teal-600/20 text-teal-300 border border-teal-500/30"
                    : "text-slate-300 hover:bg-slate-900 hover:text-white"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50 text-xs">
          <p className="text-slate-400 font-medium">Engineering Basis</p>
          <p className="text-slate-300 mt-1">Preliminary RO / NF Sizing</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Unverified catalog specs explicitly flagged.
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 lg:px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              {currentProject ? (
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                    {currentProject.project_code}
                  </span>
                  <span className="font-semibold text-sm text-slate-900 truncate max-w-[140px] sm:max-w-[240px] lg:max-w-xs">
                    {currentProject.project_name}
                  </span>
                  <Badge className={projectStatusColor(currentProject.status)}>
                    {currentProject.status}
                  </Badge>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
                      saveStatus === "Saved"
                        ? "text-emerald-700 bg-emerald-50"
                        : saveStatus === "Error"
                        ? "text-rose-700 bg-rose-50"
                        : "text-amber-700 bg-amber-50"
                    )}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {saveStatus}
                  </span>
                </div>
              ) : (
                <div className="text-xs sm:text-sm font-medium text-slate-600 truncate">
                  Dairy Membrane Design Workspace
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Unit Preferences Popover */}
              <div className="relative">
                <button
                  onClick={() => {
                    setUnitsOpen((o) => !o);
                    setNotifOpen(false);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                  title="Unit preferences"
                >
                  <Gauge className="w-3.5 h-3.5 text-teal-600" />
                  <span>
                    {user.preferred_units?.flow || "L/h"} ·{" "}
                    {user.preferred_units?.pressure || "bar"} · °
                    {user.preferred_units?.temperature || "C"}
                  </span>
                </button>
                {unitsOpen && (
                  <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-64 sm:w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-lg z-40 space-y-3 text-xs">
                    <div className="font-semibold text-slate-900">Preferred Display Units</div>
                    <div>
                      <span className="text-slate-500 block mb-1">Flow Rate</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(["L/h", "m3/h"] as const).map((u) => (
                          <button
                            key={u}
                            onClick={() => updateUnits({ flow: u })}
                            className={cn(
                              "px-2 py-1.5 rounded border font-medium cursor-pointer",
                              user.preferred_units?.flow === u
                                ? "bg-teal-600 text-white border-teal-600"
                                : "bg-white text-slate-700 border-slate-200"
                            )}
                          >
                            {u === "m3/h" ? "m³/h" : "L/h"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">Pressure</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(["bar", "kPa", "psi"] as const).map((u) => (
                          <button
                            key={u}
                            onClick={() => updateUnits({ pressure: u })}
                            className={cn(
                              "px-2 py-1.5 rounded border font-medium cursor-pointer",
                              user.preferred_units?.pressure === u
                                ? "bg-teal-600 text-white border-teal-600"
                                : "bg-white text-slate-700 border-slate-200"
                            )}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">Temperature</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(["C", "F"] as const).map((u) => (
                          <button
                            key={u}
                            onClick={() => updateUnits({ temperature: u })}
                            className={cn(
                              "px-2 py-1.5 rounded border font-medium cursor-pointer",
                              user.preferred_units?.temperature === u
                                ? "bg-teal-600 text-white border-teal-600"
                                : "bg-white text-slate-700 border-slate-200"
                            )}
                          >
                            °{u}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Notifications / Validation Alerts */}
              <div className="relative">
                <button
                  onClick={() => {
                    setNotifOpen((o) => !o);
                    setUnitsOpen(false);
                  }}
                  className="relative p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                  aria-label="Engineering notifications"
                >
                  <Bell className="w-4 h-4" />
                  {alertCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                      {alertCount}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-xs sm:w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-lg z-40 text-xs">
                    <div className="font-semibold text-slate-900 mb-2">
                      Engineering Validation Alerts
                    </div>
                    {validation ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {validation.checks
                          .filter((c) => c.status !== "Passed")
                          .map((c) => (
                            <div key={c.id} className="rounded-lg bg-slate-50 p-2 border border-slate-200">
                              <div className="font-semibold text-slate-800">
                                [{c.status}] {c.title}
                              </div>
                              <div className="text-slate-600 mt-0.5">{c.message}</div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-slate-500">
                        Open a calculated project to review engineering validation checks.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* User Profile */}
              <Link
                href="/settings"
                className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <User className="w-3.5 h-3.5 text-sky-600" />
                <span className="max-w-[140px] truncate">{user.full_name}</span>
              </Link>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 cursor-pointer"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Logout</span>
              </button>
            </div>
          </div>

          {/* Step-by-Step Engineering Workspace Progress Indicator */}
          {currentProject && activeStep && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1 overflow-x-auto max-w-full pb-1">
              {WORKFLOW_STEPS.map((step, idx) => {
                const isCurrent = activeStep === step.key;
                return (
                  <React.Fragment key={step.key}>
                    <Link
                      href={`/projects/${currentProject.id}/${step.path}`}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                        isCurrent
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold",
                          isCurrent ? "bg-teal-500 text-white" : "bg-white text-slate-700"
                        )}
                      >
                        {idx + 1}
                      </span>
                      {step.label}
                    </Link>
                    {idx < WORKFLOW_STEPS.length - 1 && (
                      <span className="text-slate-300 text-xs px-0.5">→</span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
