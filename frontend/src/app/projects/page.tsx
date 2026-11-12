"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, FileText, FolderPlus, Search, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert, Badge, Button, Card, CardBody, Input, Select } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { formatDate, projectStatusColor } from "@/lib/utils";
import type { ProjectSummary } from "@/types/cowpro";

export default function ProjectsListPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [search, setSearch] = useState("");
  const [processFilter, setProcessFilter] = useState("ALL");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.projects.list();
      setProjects(res.projects);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to load projects.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    api.projects
      .list()
      .then((res) => {
        if (active) setProjects(res.projects);
      })
      .catch((err) => {
        if (active) setErrorMsg(err instanceof ApiError ? err.message : "Failed to load projects.");
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = projects.filter((p) => {
    const matchesSearch =
      !search.trim() ||
      p.project_name.toLowerCase().includes(search.toLowerCase()) ||
      p.project_code.toLowerCase().includes(search.toLowerCase()) ||
      p.milk_type.toLowerCase().includes(search.toLowerCase());
    const matchesProc = processFilter === "ALL" || p.process_type === processFilter;
    return matchesSearch && matchesProc;
  });

  const handleDuplicate = async (id: string) => {
    await api.projects.duplicate(id);
    await load();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    await api.projects.delete(id);
    await load();
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Projects</h1>
            <p className="text-sm text-slate-500">
              Manage saved dairy RO &amp; NF membrane design projects.
            </p>
          </div>
          <Button variant="teal" onClick={() => router.push("/projects/new")}>
            <FolderPlus className="w-4 h-4" /> New Project
          </Button>
        </div>

        {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

        <Card>
          <CardBody className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <Input
                placeholder="Search by name, code, or milk type..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-44">
              <Select value={processFilter} onChange={(e) => setProcessFilter(e.target.value)}>
                <option value="ALL">All Processes</option>
                <option value="RO">Reverse Osmosis (RO)</option>
                <option value="NF">Nanofiltration (NF)</option>
              </Select>
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((p) => (
            <Card key={p.id} className="hover:border-teal-300 transition-colors">
              <CardBody className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-mono text-slate-500">{p.project_code}</span>
                    <Link
                      href={`/projects/${p.id}/feed`}
                      className="block text-base font-semibold text-slate-900 hover:text-teal-700"
                    >
                      {p.project_name}
                    </Link>
                  </div>
                  <Badge className={projectStatusColor(p.status)}>{p.status}</Badge>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2">
                  {p.description || "No description provided."}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2.5 text-xs">
                  <div>
                    <span className="text-slate-400 block">Process</span>
                    <span className="font-semibold text-slate-800">{p.process_type}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Milk Type</span>
                    <span className="font-semibold text-slate-800 truncate block">{p.milk_type}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">CF / Loops</span>
                    <span className="font-semibold text-slate-800 tabular-nums">
                      {p.concentration_factor ? `${p.concentration_factor.toFixed(2)} (${p.configuration})` : "Not Set"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400">Updated {formatDate(p.updated_at)}</span>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="primary" onClick={() => router.push(`/projects/${p.id}/feed`)}>
                      Open
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => router.push(`/projects/${p.id}/report`)}>
                      <FileText className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDuplicate(p.id)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-rose-600"
                      onClick={() => handleDelete(p.id, p.project_name)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
