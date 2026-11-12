"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  Copy,
  FileText,
  FolderOpen,
  FolderPlus,
  Layers,
  Play,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert, Badge, Button, Card, CardBody, CardHeader } from "@/components/ui";
import { useProject } from "@/context/ProjectContext";
import { api, ApiError } from "@/lib/api";
import { formatDate, projectStatusColor } from "@/lib/utils";
import type { ProjectSummary } from "@/types/cowpro";

export default function DashboardPage() {
  const router = useRouter();
  const { setCurrentProject } = useProject();
  const [summary, setSummary] = useState({
    total_projects: 0,
    completed_designs: 0,
    draft_designs: 0,
    recent_simulations: 0,
  });
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.projects.dashboard();
      setSummary(res.summary);
      setProjects(res.recent_projects);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api.projects
      .dashboard()
      .then((res) => {
        if (!active) return;
        setSummary(res.summary);
        setProjects(res.recent_projects);
      })
      .catch((err) => {
        if (!active) return;
        setErrorMsg(err instanceof ApiError ? err.message : "Failed to load dashboard.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleLoadDemo = async () => {
    setErrorMsg(null);
    try {
      const res = await api.projects.loadDemo();
      setCurrentProject(res.project);
      setNotice(`Loaded Section 27 Demonstration Project (${res.project.project_code}).`);
      await fetchDashboard();
      router.push(`/projects/${res.project.id}/results`);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to load demonstration project.");
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const res = await api.projects.duplicate(id);
      setNotice(`Duplicated project as "${res.project.project_name}".`);
      await fetchDashboard();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Could not duplicate project.");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete project "${name}"? This removes all associated calculations and reports.`)) {
      return;
    }
    try {
      await api.projects.delete(id);
      setNotice(`Deleted project "${name}".`);
      await fetchDashboard();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Could not delete project.");
    }
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await api.projects.importJson(parsed);
      setCurrentProject(res.project);
      setNotice(`Imported project "${res.project.project_name}".`);
      await fetchDashboard();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Invalid JSON project file.");
    } finally {
      e.target.value = "";
    }
  };

  const lastProject = projects[0];

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header & Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Engineering Dashboard
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Design, size, validate, and simulate dairy RO &amp; NF membrane processing systems.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 w-full lg:w-auto">
            <Button variant="teal" onClick={() => router.push("/projects/new")}>
              <FolderPlus className="w-4 h-4" /> Create New Project
            </Button>
            {lastProject && (
              <Button
                variant="secondary"
                onClick={() => router.push(`/projects/${lastProject.id}/feed`)}
              >
                <Play className="w-4 h-4" /> Continue Last Project
              </Button>
            )}
            <Button variant="outline" onClick={handleLoadDemo}>
              <Sparkles className="w-4 h-4 text-teal-600" /> Load Section 27 Demo
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportJson}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4" /> Import JSON
            </Button>
          </div>
        </div>

        {notice && <Alert variant="success">{notice}</Alert>}
        {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardBody className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total Projects
                </p>
                <p className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">
                  {summary.total_projects}
                </p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <FolderOpen className="w-5 h-5" />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Completed Designs
                </p>
                <p className="text-3xl font-bold text-teal-700 mt-1 tabular-nums">
                  {summary.completed_designs}
                </p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Draft Designs
                </p>
                <p className="text-3xl font-bold text-sky-700 mt-1 tabular-nums">
                  {summary.draft_designs}
                </p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <FolderPlus className="w-5 h-5" />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Recent Simulations
                </p>
                <p className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">
                  {summary.recent_simulations}
                </p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Recent Projects Table */}
        <Card>
          <CardHeader
            title="Recent Engineering Projects"
            subtitle="Projects are isolated to your account. Calculations never auto-mark a design as Validated without complete checks."
            action={
              <Link
                href="/projects"
                className="text-xs font-semibold text-teal-700 hover:text-teal-800"
              >
                View All Projects →
              </Link>
            }
          />
          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-slate-100">
            {loading ? (
              <div className="px-4 py-8 text-center text-slate-500 text-xs">
                Loading projects...
              </div>
            ) : projects.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No engineering projects yet.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Create a new project or load the Section 27 NF Demonstration Case to explore COW PRO.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button variant="teal" size="sm" onClick={() => router.push("/projects/new")}>
                    Create Project
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleLoadDemo}>
                    Load Demo Case
                  </Button>
                </div>
              </div>
            ) : (
              projects.map((p) => (
                <div key={p.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/projects/${p.id}/feed`}
                        className="font-semibold text-sm text-slate-900 hover:text-teal-700 block truncate"
                      >
                        {p.project_name}
                      </Link>
                      <span className="text-[11px] font-mono text-slate-400">
                        {p.project_code}
                      </span>
                    </div>
                    <Badge className={projectStatusColor(p.status)}>{p.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2.5 text-xs">
                    <div>
                      <span className="text-slate-400 block">Milk Type</span>
                      <span className="font-medium text-slate-800 truncate block">{p.milk_type}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Process · CF</span>
                      <span className="font-medium text-slate-800 font-mono tabular-nums">
                        {p.process_type} · {p.concentration_factor ? `${p.concentration_factor.toFixed(2)}×` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Configuration</span>
                      <span className="font-medium text-slate-800">{p.configuration}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Last Modified</span>
                      <span className="text-slate-600">{formatDate(p.updated_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => router.push(`/projects/${p.id}/feed`)}
                    >
                      Open Workspace
                    </Button>
                    <div className="inline-flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        title="View Reports"
                        onClick={() => router.push(`/projects/${p.id}/report`)}
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Duplicate Project"
                        onClick={() => handleDuplicate(p.id)}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Delete Project"
                        className="text-rose-600 hover:bg-rose-50"
                        onClick={() => handleDelete(p.id, p.project_name)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Project Name</th>
                  <th className="px-4 py-3">Milk Type</th>
                  <th className="px-4 py-3">Process</th>
                  <th className="px-4 py-3">Conc. Factor</th>
                  <th className="px-4 py-3">Configuration</th>
                  <th className="px-4 py-3">Last Modified</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500 text-xs">
                      Loading projects...
                    </td>
                  </tr>
                ) : projects.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center">
                      <p className="text-sm font-medium text-slate-700">
                        No engineering projects yet.
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Create a new project or load the Section 27 NF Demonstration Case to explore COW PRO.
                      </p>
                      <div className="mt-4 flex justify-center gap-2">
                        <Button variant="teal" size="sm" onClick={() => router.push("/projects/new")}>
                          Create Project
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleLoadDemo}>
                          Load Demo Case
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  projects.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <Link
                          href={`/projects/${p.id}/feed`}
                          className="font-semibold text-slate-900 hover:text-teal-700 block"
                        >
                          {p.project_name}
                        </Link>
                        <span className="text-[11px] font-mono text-slate-400">
                          {p.project_code}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">{p.milk_type}</td>
                      <td className="px-4 py-3">
                        <Badge className="bg-slate-100 text-slate-800 border-slate-200">
                          {p.process_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono tabular-nums text-slate-800">
                        {p.concentration_factor ? p.concentration_factor.toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">{p.configuration}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(p.updated_at)}</td>
                      <td className="px-4 py-3">
                        <Badge className={projectStatusColor(p.status)}>{p.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/projects/${p.id}/feed`)}
                          >
                            Open
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="View Reports"
                            onClick={() => router.push(`/projects/${p.id}/report`)}
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Duplicate Project"
                            onClick={() => handleDuplicate(p.id)}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Delete Project"
                            className="text-rose-600 hover:bg-rose-50"
                            onClick={() => handleDelete(p.id, p.project_name)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
