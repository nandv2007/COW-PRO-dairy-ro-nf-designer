"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download, FileCode2, FileSpreadsheet, FileText } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert, Badge, Button, Card, CardBody, CardHeader } from "@/components/ui";
import { useProject } from "@/context/ProjectContext";
import { api, ApiError } from "@/lib/api";
import { formatDate, projectStatusColor } from "@/lib/utils";

const REPORT_SECTIONS = [
  "Cover Page — COW PRO Branding, Project ID, Engineer & Validation Status",
  "Section 1 — Project Overview & Design Basis",
  "Section 2 — Feed Analysis (Milk Composition, Feed Flow & Physical Properties)",
  "Section 3 — Concentration Design (Initial, Target, CF & Permeate Removal)",
  "Section 4 — Loop Configuration & Flow Balances",
  "Section 5 — Membrane Selection, Datasheet References & Verification Status",
  "Section 6 — Membrane Sizing (Loop 1, Loop 2, Installed Area & Design Flux)",
  "Section 7 — Equipment Arrangement (Housings, Operating Pressures & Pumps)",
  "Section 8 — Vector Process Flow Diagram",
  "Section 9 — Summary Results & Performance Charts",
  "Section 10 — Engineering Validation Audit & Unverified Properties",
  "Section 11 — Calculation Methodology, Formulas, Units & Assumptions",
  "Section 12 — Conclusion & Required Remaining Engineering Checks",
];

export default function ProjectReportPage() {
  const params = useParams<{ id: string }>();
  const { currentProject, loadProject } = useProject();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      loadProject(params.id).catch((err) =>
        setErrorMsg(err instanceof ApiError ? err.message : "Failed to load project report view.")
      );
    }
  }, [params.id, loadProject]);

  const handleDownload = async (format: "pdf" | "csv" | "json") => {
    if (!currentProject) return;
    setDownloading(format);
    setErrorMsg(null);
    setNotice(null);
    try {
      if (format === "pdf") {
        await api.reports.downloadPdf(currentProject.id, currentProject.project_code);
        await loadProject(currentProject.id);
        setNotice("Generated and downloaded 12-section PDF engineering report.");
      } else if (format === "csv") {
        await api.reports.downloadCsv(currentProject.id, currentProject.project_code);
        setNotice("Downloaded calculated engineering values CSV.");
      } else {
        await api.reports.downloadJson(currentProject.id, currentProject.project_code);
        setNotice("Exported complete COW PRO project JSON bundle.");
      }
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Report export failed.");
    } finally {
      setDownloading(null);
    }
  };

  if (!currentProject) {
    return (
      <AppShell activeStep="report">
        <div className="p-8 text-center text-sm text-slate-500">Loading report module...</div>
      </AppShell>
    );
  }

  const readyForReport = Boolean(currentProject.latest_simulation);
  const valStatus = currentProject.latest_simulation?.validation_status || "Not Evaluated";

  return (
    <AppShell activeStep="report">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Engineering Report &amp; Exports</h1>
            <p className="text-sm text-slate-500">
              Generate server-rendered 12-section PDF engineering reports, CSV tables, and JSON backups.
            </p>
          </div>
          <Badge className={projectStatusColor(currentProject.status)}>
            Project Status: {currentProject.status}
          </Badge>
        </div>

        {notice && <Alert variant="success">{notice}</Alert>}
        {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

        {!readyForReport ? (
          <Alert variant="warning" title="Calculations Required Before Report Export">
            Complete Feed Analysis and Equipment Design before generating PDF or CSV reports.
          </Alert>
        ) : (
          <Alert
            variant={valStatus === "Passed" ? "success" : "warning"}
            title={`Validation Status Embedded in Report: ${valStatus}`}
          >
            {valStatus === "Passed"
              ? "Design is fully validated."
              : "Generated reports will explicitly flag preliminary assumptions, unverified membrane specs, and pending hydraulic checks."}
          </Alert>
        )}

        {/* Export Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardBody className="space-y-3">
              <div className="flex items-center gap-2.5 text-slate-900 font-semibold">
                <FileText className="w-5 h-5 text-rose-600" />
                PDF Engineering Report
              </div>
              <p className="text-xs text-slate-600">
                Complete 12-section server-generated PDF including cover page, vector Process Flow
                Diagram, Matplotlib performance charts, formulas, and validation audit.
              </p>
              <Button
                variant="teal"
                className="w-full"
                disabled={!readyForReport || downloading !== null}
                onClick={() => handleDownload("pdf")}
              >
                <Download className="w-4 h-4" />
                {downloading === "pdf" ? "Generating PDF..." : "Download PDF Report"}
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <div className="flex items-center gap-2.5 text-slate-900 font-semibold">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                CSV Calculations Export
              </div>
              <p className="text-xs text-slate-600">
                Structured spreadsheet export containing feed composition, concentration factor,
                loop flows, membrane counts, installed area, and validation status.
              </p>
              <Button
                variant="primary"
                className="w-full"
                disabled={!readyForReport || downloading !== null}
                onClick={() => handleDownload("csv")}
              >
                <Download className="w-4 h-4" />
                {downloading === "csv" ? "Exporting CSV..." : "Download CSV Data"}
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <div className="flex items-center gap-2.5 text-slate-900 font-semibold">
                <FileCode2 className="w-5 h-5 text-sky-600" />
                JSON Project Archive
              </div>
              <p className="text-xs text-slate-600">
                Full portable JSON export that can be re-imported into COW PRO via the Dashboard
                Import JSON action without losing design parameters.
              </p>
              <Button
                variant="outline"
                className="w-full"
                disabled={downloading !== null}
                onClick={() => handleDownload("json")}
              >
                <Download className="w-4 h-4" />
                {downloading === "json" ? "Exporting JSON..." : "Export Project JSON"}
              </Button>
            </CardBody>
          </Card>
        </div>

        {/* Report Structure Outline */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader
              title="12-Section PDF Report Structure"
              subtitle="Compliant with Section 24 Specification"
            />
            <CardBody>
              <ol className="space-y-2 text-xs text-slate-700">
                {REPORT_SECTIONS.map((sec, idx) => (
                  <li key={idx} className="flex items-center gap-2.5 py-1 border-b border-slate-100 last:border-0">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                      {idx === 0 ? "C" : idx}
                    </span>
                    <span>{sec}</span>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Generated Report History"
              subtitle="Previously rendered PDF engineering reports for this project"
            />
            <CardBody>
              {currentProject.reports.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  No PDF reports generated for this project yet. Click &ldquo;Download PDF Report&rdquo; to generate one.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {currentProject.reports.map((r) => (
                    <div key={r.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-mono font-semibold text-slate-800 block">
                          {r.report_name}
                        </span>
                        <span className="text-[11px] text-slate-500">{formatDate(r.generated_at)}</span>
                      </div>
                      <Badge className="bg-slate-100 text-slate-700 border-slate-200">
                        {r.report_format}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
