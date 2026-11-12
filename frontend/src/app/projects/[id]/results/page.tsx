"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, FileText, ShieldCheck, ShieldAlert } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { Alert, Badge, Button, Card, CardBody, CardHeader } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { ApiError } from "@/lib/api";
import { formatFlow, formatPressure, validationStatusColor } from "@/lib/utils";
import type { FullDesignOutput } from "@/types/cowpro";

export default function ResultsDashboardPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { loadProject } = useProject();
  const [design, setDesign] = useState<FullDesignOutput | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    loadProject(params.id)
      .then((p) => {
        setDesign(p.latest_simulation?.result_snapshot || null);
      })
      .catch((err) => setErrorMsg(err instanceof ApiError ? err.message : "Failed to load results."));
  }, [params.id, loadProject]);

  if (!design) {
    return (
      <AppShell activeStep="results">
        <div className="space-y-4">
          {errorMsg && <Alert variant="error">{errorMsg}</Alert>}
          <Alert variant="warning" title="No Calculated Results Available">
            Complete Feed Analysis and Equipment Design to generate calculated engineering results and validation checks.
            <div className="mt-3">
              <Button variant="teal" size="sm" onClick={() => router.push(`/projects/${params.id}/equipment`)}>
                Configure Equipment Design
              </Button>
            </div>
          </Alert>
        </div>
      </AppShell>
    );
  }

  const flowUnit = user?.preferred_units?.flow || "L/h";
  const pressUnit = user?.preferred_units?.pressure || "bar";
  const s1 = design.loop_sizings.find((s) => s.loop_number === 1);
  const s2 = design.loop_sizings.find((s) => s.loop_number === 2);
  const h1 = design.hydraulic_loops.find((h) => h.loop_number === 1);
  const h2 = design.hydraulic_loops.find((h) => h.loop_number === 2);
  const twoLoops = design.loops.loop2_active;

  const flowBalanceChart = [
    { name: "Feed Flow", value: Number(design.feed.feed_flow_lh.toFixed(2)) },
    { name: "Permeate Removal", value: Number(design.concentration.total_permeate_removal_lh.toFixed(2)) },
    { name: "Final Retentate", value: Number(design.loops.final_retentate_flow_lh.toFixed(2)) },
  ];

  const loopPermeateChart = [
    { name: "Loop 1", permeate: Number(design.loops.loop1_permeate_flow_lh.toFixed(2)) },
    { name: "Loop 2", permeate: Number(design.loops.loop2_permeate_flow_lh.toFixed(2)) },
  ];

  const areaDistChart = [
    { name: "Loop 1 Area (m²)", value: Number((s1?.installed_area_m2 || 0).toFixed(2)) },
    ...(twoLoops
      ? [{ name: "Loop 2 Area (m²)", value: Number((s2?.installed_area_m2 || 0).toFixed(2)) }]
      : []),
  ];

  const membraneCountChart = [
    {
      name: "Loop 1",
      membranes: s1?.membrane_count || 0,
      designFlux: s1?.design_flux_lmh || 0,
      actualFlux: Number((s1?.actual_operating_flux_lmh || 0).toFixed(2)),
    },
    ...(twoLoops
      ? [
          {
            name: "Loop 2",
            membranes: s2?.membrane_count || 0,
            designFlux: s2?.design_flux_lmh || 0,
            actualFlux: Number((s2?.actual_operating_flux_lmh || 0).toFixed(2)),
          },
        ]
      : []),
  ];

  const val = design.validation;

  return (
    <AppShell activeStep="results">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Engineering Results &amp; Validation Dashboard
            </h1>
            <p className="text-sm text-slate-500">
              Calculated loop balances, membrane sizing, charts, and 5-category engineering validation audit.
            </p>
          </div>
          <Button variant="teal" onClick={() => router.push(`/projects/${params.id}/report`)}>
            <FileText className="w-4 h-4" /> Proceed to Engineering Report <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Validation Status Banner */}
        <Alert
          variant={val.can_mark_validated ? "success" : "warning"}
          title={`Validation Outcome: ${val.overall_status} (${val.passed_count} Passed · ${val.warning_count} Warning · ${val.failed_count} Failed · ${val.not_evaluated_count} Not Evaluated)`}
        >
          {val.can_mark_validated
            ? "All engineering, hydraulic, and manufacturer verification checks passed."
            : "Preliminary calculations are complete, but this design is NOT marked Validated until unverified membrane specifications and hydraulic operating checks are resolved."}
        </Alert>

        {/* 7 Main Result Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {[
            { label: "Feed Flow", value: formatFlow(design.feed.feed_flow_lh, flowUnit) },
            { label: "Conc. Factor", value: `${design.concentration.concentration_factor.toFixed(3)}×` },
            { label: "Permeate Removal", value: formatFlow(design.concentration.total_permeate_removal_lh, flowUnit) },
            { label: "Final Retentate", value: formatFlow(design.loops.final_retentate_flow_lh, flowUnit) },
            { label: "Active Loops", value: `${design.loops.active_loops} (${design.loops.configuration_label})` },
            { label: "Total Membranes", value: String(design.total_membranes) },
            { label: "Installed Area", value: `${design.total_installed_area_m2.toFixed(2)} m²` },
          ].map((item) => (
            <Card key={item.label}>
              <CardBody className="p-3.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 block">
                  {item.label}
                </span>
                <span className="text-base font-bold font-mono text-slate-900 mt-1 block">
                  {item.value}
                </span>
              </CardBody>
            </Card>
          ))}
        </div>

        {/* Loop Comparison Table */}
        <Card>
          <CardHeader
            title="Loop 1 vs Loop 2 Engineering Comparison"
            subtitle={twoLoops ? "Two-loop sequential arrangement (2/3 & 1/3 permeate split)" : "Single-loop system — Loop 2 inactive"}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 uppercase text-[11px] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Parameter</th>
                  <th className="px-4 py-3">Loop 1</th>
                  <th className="px-4 py-3">Loop 2</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  ["Feed Flow", formatFlow(design.loops.loop1_feed_flow_lh, flowUnit), twoLoops ? formatFlow(design.loops.loop2_feed_flow_lh, flowUnit) : "Inactive"],
                  ["Permeate Removal", formatFlow(design.loops.loop1_permeate_flow_lh, flowUnit), twoLoops ? formatFlow(design.loops.loop2_permeate_flow_lh, flowUnit) : "Inactive (0 L/h)"],
                  ["Retentate Flow", formatFlow(design.loops.loop1_retentate_flow_lh, flowUnit), twoLoops ? formatFlow(design.loops.loop2_retentate_flow_lh, flowUnit) : "Inactive"],
                  ["Membrane Model", s1?.membrane_model || "—", twoLoops ? s2?.membrane_model || "—" : "Inactive"],
                  ["Membrane Area / Element", s1 ? `${s1.membrane_area_m2} m²` : "—", twoLoops && s2 ? `${s2.membrane_area_m2} m²` : "Inactive"],
                  ["Design Flux", s1 ? `${s1.design_flux_lmh} LMH (${s1.flux_source})` : "—", twoLoops && s2 ? `${s2.design_flux_lmh} LMH (${s2.flux_source})` : "Inactive"],
                  ["Membrane Count", s1 ? `${s1.membrane_count}` : "—", twoLoops && s2 ? `${s2.membrane_count}` : "0 (Inactive)"],
                  ["Installed Area", s1 ? `${s1.installed_area_m2.toFixed(2)} m²` : "—", twoLoops && s2 ? `${s2.installed_area_m2.toFixed(2)} m²` : "0 m²"],
                  ["Housing Count", s1 ? `${s1.housing_count} (${s1.elements_per_housing}/housing)` : "—", twoLoops && s2 ? `${s2.housing_count} (${s2.elements_per_housing}/housing)` : "0"],
                  [
                    "Operating Pressure (Inlet)",
                    h1?.inlet_pressure_bar !== null && h1?.inlet_pressure_bar !== undefined
                      ? formatPressure(h1.inlet_pressure_bar, pressUnit)
                      : "Pending Hydraulic Input",
                    twoLoops
                      ? h2?.inlet_pressure_bar !== null && h2?.inlet_pressure_bar !== undefined
                        ? formatPressure(h2.inlet_pressure_bar, pressUnit)
                        : "Pending Hydraulic Input"
                      : "Inactive",
                  ],
                ].map(([param, v1, v2]) => (
                  <tr key={param}>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">{param}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-900">{v1}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-600">{v2}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Engineering Charts (5 plots strictly from calculated values) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader title="Feed vs Permeate Removal vs Final Retentate (L/h)" />
            <CardBody className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={flowBalanceChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Flow (L/h)" radius={[6, 6, 0, 0]}>
                    <Cell fill="#0f172a" />
                    <Cell fill="#0d9488" />
                    <Cell fill="#0284c7" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Loop 1 vs Loop 2 Permeate Removal (L/h)" />
            <CardBody className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={loopPermeateChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="permeate" name="Permeate Removal (L/h)" fill="#0d9488" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Installed Membrane Area Distribution (m²)" />
            <CardBody className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={areaDistChart}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label
                  >
                    <Cell fill="#0d9488" />
                    <Cell fill="#0284c7" />
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Membrane Count Comparison" />
            <CardBody className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={membraneCountChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="membranes" name="Membrane Elements" fill="#0f172a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader title="Flux Comparison — Design vs Actual Operating Flux (LMH)" />
            <CardBody className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={membraneCountChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="designFlux" name="Design Flux (LMH)" fill="#0284c7" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actualFlux" name="Actual Installed Flux (LMH)" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        </div>

        {/* Engineering Validation Engine Results (Section 23) */}
        <Card>
          <CardHeader
            title="Engineering Validation Engine Audit"
            subtitle="Five-category validation: Composition, Concentration, Membrane, Hydraulic, and Mass Balance"
            action={
              <Badge className={validationStatusColor(val.overall_status)}>
                {val.can_mark_validated ? (
                  <ShieldCheck className="w-3.5 h-3.5" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5" />
                )}
                {val.overall_status}
              </Badge>
            }
          />
          <CardBody className="space-y-4">
            <div className="space-y-2">
              {val.checks.map((chk) => (
                <div
                  key={chk.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 bg-white"
                >
                  <div className="space-y-0.5 max-w-3xl">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        {chk.category}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{chk.title}</p>
                    <p className="text-xs text-slate-600">{chk.message}</p>
                    {chk.details && <p className="text-[11px] text-slate-500">{chk.details}</p>}
                  </div>
                  <Badge className={validationStatusColor(chk.status)}>{chk.status}</Badge>
                </div>
              ))}
            </div>

            {val.unverified_properties.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                <p className="font-semibold mb-1">Unverified Technical Properties</p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {val.unverified_properties.map((u, idx) => (
                    <li key={idx}>{u}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
              <p className="font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                Engineering Scope &amp; Model Limitations
              </p>
              <ul className="list-disc pl-5 space-y-0.5">
                {val.engineering_limitations.map((lim, idx) => (
                  <li key={idx}>{lim}</li>
                ))}
              </ul>
            </div>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
