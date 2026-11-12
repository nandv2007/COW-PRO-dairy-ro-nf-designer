"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Activity, ArrowRight, Lock, Play, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ProcessFlowDiagram } from "@/components/pfd/ProcessFlowDiagram";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Modal } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { api, ApiError } from "@/lib/api";
import { formatFlow } from "@/lib/utils";
import type { FullDesignOutput } from "@/types/cowpro";

export default function ProcessSimulationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { currentProject, loadProject, setCurrentProject } = useProject();
  const [design, setDesign] = useState<FullDesignOutput | null>(null);
  const [inspectLoop, setInspectLoop] = useState<1 | 2 | null>(null);
  const [level2Info, setLevel2Info] = useState<{
    message: string;
    missing_requirements: string[];
  } | null>(null);
  const [running, setRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    loadProject(params.id)
      .then((p) => {
        if (p.latest_simulation?.result_snapshot) {
          setDesign(p.latest_simulation.result_snapshot);
        }
      })
      .catch((err) => setErrorMsg(err instanceof ApiError ? err.message : "Failed to load simulation."));
  }, [params.id, loadProject]);

  const runSim = async (level: "Level 1" | "Level 2") => {
    if (!params.id) return;
    setRunning(true);
    setErrorMsg(null);
    try {
      const res = await api.projects.simulate(params.id, level);
      if (level === "Level 1") {
        setCurrentProject(res.project as typeof currentProject);
        setDesign(res.design as FullDesignOutput);
      } else {
        setLevel2Info(
          res.level2_readiness as { message: string; missing_requirements: string[] }
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Simulation execution failed.");
    } finally {
      setRunning(false);
    }
  };

  const flowUnit = user?.preferred_units?.flow || "L/h";
  const units = user?.preferred_units || { flow: "L/h", pressure: "bar", temperature: "C", area: "m2" };
  const inspectedSizing = design?.loop_sizings.find((s) => s.loop_number === inspectLoop);
  const inspectedHyd = design?.hydraulic_loops.find((h) => h.loop_number === inspectLoop);
  const inspectedMetric = design?.level1_simulation?.loop_metrics.find((m) => m.loop_number === inspectLoop);

  return (
    <AppShell activeStep="simulation">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Process Flow Diagram &amp; Simulation
            </h1>
            <p className="text-sm text-slate-500">
              Interactive sequential loop schematic and Level 1 preliminary performance simulation.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => runSim("Level 1")} disabled={running}>
              <Play className="w-4 h-4" /> Run Level 1 Simulation
            </Button>
            <Button variant="outline" onClick={() => runSim("Level 2")} disabled={running}>
              <Lock className="w-4 h-4" /> Check Level 2 Readiness
            </Button>
            <Button variant="teal" onClick={() => router.push(`/projects/${params.id}/results`)}>
              Results &amp; Validation <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

        {!design ? (
          <Alert variant="warning" title="Equipment Design Required">
            Complete Feed Analysis and Equipment Design (membrane selection &amp; flux) to render the
            Process Flow Diagram and execute simulations.
            <div className="mt-3">
              <Button variant="teal" size="sm" onClick={() => router.push(`/projects/${params.id}/equipment`)}>
                Go to Equipment Design
              </Button>
            </div>
          </Alert>
        ) : (
          <>
            {/* Interactive React Flow Process Flow Diagram */}
            <Card>
              <CardHeader
                title="Interactive Process Flow Diagram (React Flow)"
                subtitle={`${design.loops.configuration_label} (${design.level1_simulation?.process_type || currentProject?.process_type}) — Click a membrane loop node to inspect full calculations`}
                action={
                  <Badge className="bg-slate-100 text-slate-700 border-slate-200">
                    Preliminary Sequential Arrangement
                  </Badge>
                }
              />
              <CardBody className="space-y-3">
                <ProcessFlowDiagram
                  design={design}
                  units={units}
                  onSelectLoop={(loopNum) => setInspectLoop(loopNum)}
                />
                <p className="text-[11px] text-slate-500">
                  Engineering Note: This sequential schematic represents the preliminary COW PRO
                  arrangement and does not imply an unverified plant piping layout or common
                  recirculation tank configuration.
                </p>
              </CardBody>
            </Card>

            {/* Level 1 Simulation Results */}
            {design.level1_simulation && (
              <Card>
                <CardHeader
                  title="Level 1 — Preliminary Design Simulation Results"
                  subtitle="Calculated strictly using agreed preliminary volumetric & loop-split equations"
                  action={
                    <Badge className="bg-teal-50 text-teal-700 border-teal-200">
                      <Activity className="w-3 h-3" /> Level 1 Executed
                    </Badge>
                  }
                />
                <CardBody className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                      <span className="text-[11px] text-slate-500 block">Overall Permeate Recovery</span>
                      <span className="text-lg font-bold font-mono text-slate-900">
                        {design.level1_simulation.overall_recovery_pct.toFixed(2)}%
                      </span>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                      <span className="text-[11px] text-slate-500 block">Concentration Factor</span>
                      <span className="text-lg font-bold font-mono text-teal-700">
                        {design.level1_simulation.concentration_factor.toFixed(3)}×
                      </span>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                      <span className="text-[11px] text-slate-500 block">Total Membranes</span>
                      <span className="text-lg font-bold font-mono text-slate-900">
                        {design.level1_simulation.total_membranes}
                      </span>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                      <span className="text-[11px] text-slate-500 block">Installed Membrane Area</span>
                      <span className="text-lg font-bold font-mono text-sky-700">
                        {design.level1_simulation.total_installed_area_m2.toFixed(2)} m²
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px]">
                        <tr>
                          <th className="px-3 py-2.5">Loop</th>
                          <th className="px-3 py-2.5">Status</th>
                          <th className="px-3 py-2.5">Feed Flow</th>
                          <th className="px-3 py-2.5">Permeate Flow</th>
                          <th className="px-3 py-2.5">Retentate Flow</th>
                          <th className="px-3 py-2.5">Stage Recovery</th>
                          <th className="px-3 py-2.5">Cum. CF</th>
                          <th className="px-3 py-2.5">Actual Flux</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {design.level1_simulation.loop_metrics.map((m) => (
                          <tr key={m.loop_number} className={!m.is_active ? "opacity-50" : ""}>
                            <td className="px-3 py-2.5 font-semibold">Loop {m.loop_number}</td>
                            <td className="px-3 py-2.5">
                              {m.is_active ? (
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
                              ) : (
                                <Badge className="bg-slate-100 text-slate-600 border-slate-200">Inactive</Badge>
                              )}
                            </td>
                            <td className="px-3 py-2.5 font-mono">
                              {m.is_active ? formatFlow(m.feed_flow_lh, flowUnit) : "—"}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-teal-700">
                              {m.is_active ? formatFlow(m.permeate_flow_lh, flowUnit) : "—"}
                            </td>
                            <td className="px-3 py-2.5 font-mono">
                              {m.is_active ? formatFlow(m.retentate_flow_lh, flowUnit) : "—"}
                            </td>
                            <td className="px-3 py-2.5 font-mono">
                              {m.is_active ? `${m.permeate_recovery_pct.toFixed(2)}%` : "—"}
                            </td>
                            <td className="px-3 py-2.5 font-mono font-semibold">
                              {m.is_active ? `${m.cumulative_concentration_factor.toFixed(3)}×` : "—"}
                            </td>
                            <td className="px-3 py-2.5 font-mono">
                              {m.is_active && m.actual_flux_lmh !== null
                                ? `${m.actual_flux_lmh.toFixed(2)} LMH`
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Level 2 Advanced Simulation Guard */}
            <Card>
              <CardHeader
                title="Level 2 — Advanced Performance Simulation"
                subtitle="Component mass balance, mineral rejection, osmotic pressure, viscosity, and concentration polarization"
                action={
                  <Badge className="bg-amber-50 text-amber-800 border-amber-200">
                    <ShieldAlert className="w-3 h-3" /> Verified Physical Models Required
                  </Badge>
                }
              />
              <CardBody className="space-y-3 text-xs">
                <Alert variant="warning" title="No Fictional Advanced Simulation Outputs">
                  {level2Info?.message ||
                    design.level2_readiness?.message ||
                    "Level 2 simulation is locked until validated physical parameters are provided."}
                </Alert>
                <div>
                  <span className="font-semibold text-slate-800 block mb-1.5">
                    Missing Requirements for Level 2 Execution:
                  </span>
                  <ul className="list-disc pl-5 space-y-1 text-slate-600">
                    {(level2Info?.missing_requirements || design.level2_readiness?.missing_requirements || []).map(
                      (req, i) => (
                        <li key={i}>{req}</li>
                      )
                    )}
                  </ul>
                </div>
              </CardBody>
            </Card>
          </>
        )}
      </div>

      {/* Clickable Loop Detail Modal */}
      <Modal
        open={inspectLoop !== null}
        onClose={() => setInspectLoop(null)}
        title={`Loop ${inspectLoop} Engineering Inspection`}
      >
        {inspectedSizing && inspectedMetric ? (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 border border-slate-200">
              <div>
                <span className="text-slate-500 block">Membrane Model</span>
                <span className="font-semibold text-slate-900">
                  {inspectedSizing.membrane_model} ({inspectedSizing.membrane_area_m2} m²)
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Design / Actual Flux</span>
                <span className="font-mono font-semibold text-slate-900">
                  {inspectedSizing.design_flux_lmh} / {inspectedSizing.actual_operating_flux_lmh.toFixed(2)} LMH
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Membranes &amp; Area</span>
                <span className="font-mono font-semibold text-teal-700">
                  {inspectedSizing.membrane_count} elements ({inspectedSizing.installed_area_m2.toFixed(2)} m²)
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Housing Arrangement</span>
                <span className="font-mono font-semibold text-slate-900">
                  {inspectedSizing.housing_count} housing(s) × {inspectedSizing.elements_per_housing}/housing ({inspectedSizing.spare_positions} spare)
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Feed → Permeate → Retentate</span>
                <span className="font-mono text-slate-800">
                  {formatFlow(inspectedMetric.feed_flow_lh, flowUnit)} →{" "}
                  {formatFlow(inspectedMetric.permeate_flow_lh, flowUnit)} →{" "}
                  {formatFlow(inspectedMetric.retentate_flow_lh, flowUnit)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Hydraulic ΔP / TMP</span>
                <span className="font-mono text-slate-800">
                  {inspectedHyd?.pressure_drop_bar !== null && inspectedHyd?.pressure_drop_bar !== undefined
                    ? `${inspectedHyd.pressure_drop_bar.toFixed(2)} bar / ${inspectedHyd.transmembrane_pressure_bar?.toFixed(2) ?? "—"} bar`
                    : "Not Evaluated"}
                </span>
              </div>
            </div>
            {inspectedSizing.housing_warnings.map((w, i) => (
              <Alert key={i} variant="warning">
                {w}
              </Alert>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Loop details unavailable.</p>
        )}
      </Modal>
    </AppShell>
  );
}
