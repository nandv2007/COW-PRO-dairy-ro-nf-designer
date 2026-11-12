"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calculator,
  Gauge,
  Layers,
  Sliders,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { MembraneExplorer } from "@/components/membranes/MembraneExplorer";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Label,
  Modal,
  Select,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { api, ApiError } from "@/lib/api";
import { formatFlow } from "@/lib/utils";
import type { FullDesignOutput, Membrane } from "@/types/cowpro";

interface LoopFormState {
  membrane_id: number;
  design_flux_lmh: string;
  elements_per_housing: string;
  housing_type: string;
  housing_pressure_rating_bar: string;
  max_elements_per_housing: string;
  max_housing_feed_flow_lh: string;
  max_housing_pressure_drop_bar: string;
  recirculation_flow_lh: string;
  inlet_pressure_bar: string;
  retentate_pressure_bar: string;
  permeate_pressure_bar: string;
  pump_efficiency: string;
}

const DEFAULT_LOOP_STATE = (defaultMembraneId: number, nominalSize: string): LoopFormState => ({
  membrane_id: defaultMembraneId,
  design_flux_lmh: "15",
  elements_per_housing: "1",
  housing_type:
    nominalSize === "8038"
      ? 'Sanitary 8.0" Stainless Vessel (8038)'
      : 'Sanitary 3.8" Stainless Vessel (3838)',
  housing_pressure_rating_bar: "",
  max_elements_per_housing: "6",
  max_housing_feed_flow_lh: "",
  max_housing_pressure_drop_bar: "",
  recirculation_flow_lh: "",
  inlet_pressure_bar: "",
  retentate_pressure_bar: "",
  permeate_pressure_bar: "",
  pump_efficiency: "",
});

export default function EquipmentDesignPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { currentProject, loadProject, setCurrentProject, setSaveStatus } = useProject();

  const [membranes, setMembranes] = useState<Membrane[]>([]);
  const [loop1, setLoop1] = useState<LoopFormState>(DEFAULT_LOOP_STATE(8, "3838"));
  const [loop2, setLoop2] = useState<LoopFormState>({
    ...DEFAULT_LOOP_STATE(8, "3838"),
    design_flux_lmh: "10",
  });
  const [feedPumpDp, setFeedPumpDp] = useState<string>("");
  const [feedPumpEff, setFeedPumpEff] = useState<string>("");
  const [selectorForLoop, setSelectorForLoop] = useState<1 | 2 | null>(
    searchParams.get("tab") === "membranes" ? 1 : null
  );
  const [designResult, setDesignResult] = useState<FullDesignOutput | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!params.id) return;
    try {
      const proj = await loadProject(params.id);
      const memRes = await api.membranes.list({
        process_type: proj.process_type,
        ash_supplied: Boolean(proj.feed_composition?.ash_design_supplied),
      });
      setMembranes(memRes.membranes);

      const defaultMem =
        memRes.membranes.find((m) => m.id === 8) || memRes.membranes[0];
      const defId = defaultMem ? defaultMem.id : 8;
      const defSize = defaultMem ? defaultMem.nominal_size : "3838";

      const ld1 = proj.loop_designs.find((l) => l.loop_number === 1);
      const ld2 = proj.loop_designs.find((l) => l.loop_number === 2);

      if (ld1) {
        const m1 = memRes.membranes.find((m) => m.id === ld1.membrane_id) || defaultMem;
        setLoop1({
          membrane_id: ld1.membrane_id || defId,
          design_flux_lmh: ld1.membrane_flux ? String(ld1.membrane_flux) : "15",
          elements_per_housing: String(ld1.elements_per_housing || 1),
          housing_type:
            ld1.housing_type ||
            (m1?.nominal_size === "8038"
              ? 'Sanitary 8.0" Stainless Vessel (8038)'
              : 'Sanitary 3.8" Stainless Vessel (3838)'),
          housing_pressure_rating_bar:
            ld1.housing_pressure_rating !== null ? String(ld1.housing_pressure_rating) : "",
          max_elements_per_housing:
            ld1.max_elements_per_housing !== null ? String(ld1.max_elements_per_housing) : "6",
          max_housing_feed_flow_lh:
            ld1.max_housing_feed_flow !== null ? String(ld1.max_housing_feed_flow) : "",
          max_housing_pressure_drop_bar:
            ld1.max_housing_pressure_drop !== null ? String(ld1.max_housing_pressure_drop) : "",
          recirculation_flow_lh:
            ld1.recirculation_flow !== null ? String(ld1.recirculation_flow) : "",
          inlet_pressure_bar: ld1.inlet_pressure !== null ? String(ld1.inlet_pressure) : "",
          retentate_pressure_bar:
            ld1.retentate_pressure !== null ? String(ld1.retentate_pressure) : "",
          permeate_pressure_bar:
            ld1.permeate_pressure !== null ? String(ld1.permeate_pressure) : "",
          pump_efficiency: ld1.pump_efficiency !== null ? String(ld1.pump_efficiency) : "",
        });
      } else {
        setLoop1(DEFAULT_LOOP_STATE(defId, defSize));
      }

      if (ld2) {
        const m2 = memRes.membranes.find((m) => m.id === ld2.membrane_id) || defaultMem;
        setLoop2({
          membrane_id: ld2.membrane_id || defId,
          design_flux_lmh: ld2.membrane_flux ? String(ld2.membrane_flux) : "10",
          elements_per_housing: String(ld2.elements_per_housing || 1),
          housing_type:
            ld2.housing_type ||
            (m2?.nominal_size === "8038"
              ? 'Sanitary 8.0" Stainless Vessel (8038)'
              : 'Sanitary 3.8" Stainless Vessel (3838)'),
          housing_pressure_rating_bar:
            ld2.housing_pressure_rating !== null ? String(ld2.housing_pressure_rating) : "",
          max_elements_per_housing:
            ld2.max_elements_per_housing !== null ? String(ld2.max_elements_per_housing) : "6",
          max_housing_feed_flow_lh:
            ld2.max_housing_feed_flow !== null ? String(ld2.max_housing_feed_flow) : "",
          max_housing_pressure_drop_bar:
            ld2.max_housing_pressure_drop !== null ? String(ld2.max_housing_pressure_drop) : "",
          recirculation_flow_lh:
            ld2.recirculation_flow !== null ? String(ld2.recirculation_flow) : "",
          inlet_pressure_bar: ld2.inlet_pressure !== null ? String(ld2.inlet_pressure) : "",
          retentate_pressure_bar:
            ld2.retentate_pressure !== null ? String(ld2.retentate_pressure) : "",
          permeate_pressure_bar:
            ld2.permeate_pressure !== null ? String(ld2.permeate_pressure) : "",
          pump_efficiency: ld2.pump_efficiency !== null ? String(ld2.pump_efficiency) : "",
        });
      } else {
        setLoop2({ ...DEFAULT_LOOP_STATE(defId, defSize), design_flux_lmh: "10" });
      }

      if (proj.hydraulics_config) {
        setFeedPumpDp(
          proj.hydraulics_config.feed_pump_diff_pressure_bar !== undefined &&
            proj.hydraulics_config.feed_pump_diff_pressure_bar !== null
            ? String(proj.hydraulics_config.feed_pump_diff_pressure_bar)
            : ""
        );
        setFeedPumpEff(
          proj.hydraulics_config.feed_pump_efficiency !== undefined &&
            proj.hydraulics_config.feed_pump_efficiency !== null
            ? String(proj.hydraulics_config.feed_pump_efficiency)
            : ""
        );
      }

      if (proj.latest_simulation?.result_snapshot) {
        setDesignResult(proj.latest_simulation.result_snapshot);
      }
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to load equipment design.");
    }
  }, [params.id, loadProject]);

  useEffect(() => {
    let active = true;
    const init = async () => {
      if (!active) return;
      await loadAll();
    };
    void init();
    return () => {
      active = false;
    };
  }, [loadAll]);

  const toLoopPayload = (loopNum: 1 | 2, st: LoopFormState) => ({
    loop_number: loopNum,
    membrane_id: Number(st.membrane_id),
    design_flux_lmh: Number(st.design_flux_lmh),
    flux_source: "User Supplied",
    elements_per_housing: Number(st.elements_per_housing) || 1,
    housing_type: st.housing_type || null,
    housing_pressure_rating_bar: st.housing_pressure_rating_bar
      ? Number(st.housing_pressure_rating_bar)
      : null,
    max_elements_per_housing: st.max_elements_per_housing
      ? Number(st.max_elements_per_housing)
      : null,
    max_housing_feed_flow_lh: st.max_housing_feed_flow_lh
      ? Number(st.max_housing_feed_flow_lh)
      : null,
    max_housing_pressure_drop_bar: st.max_housing_pressure_drop_bar
      ? Number(st.max_housing_pressure_drop_bar)
      : null,
    recirculation_flow_lh: st.recirculation_flow_lh
      ? Number(st.recirculation_flow_lh)
      : null,
    inlet_pressure_bar: st.inlet_pressure_bar ? Number(st.inlet_pressure_bar) : null,
    retentate_pressure_bar: st.retentate_pressure_bar
      ? Number(st.retentate_pressure_bar)
      : null,
    permeate_pressure_bar: st.permeate_pressure_bar
      ? Number(st.permeate_pressure_bar)
      : null,
    pump_efficiency: st.pump_efficiency ? Number(st.pump_efficiency) : null,
  });

  const handleCalculateSave = async (goToNext: boolean) => {
    if (!params.id || !currentProject?.concentration_design) return;
    setSaving(true);
    setSaveStatus("Saving...");
    setErrorMsg(null);
    setNotice(null);

    const isTwoLoop = currentProject.concentration_design.selected_loops === 2;
    const loopsPayload = isTwoLoop
      ? [toLoopPayload(1, loop1), toLoopPayload(2, loop2)]
      : [toLoopPayload(1, loop1)];

    try {
      const res = await api.projects.saveEquipmentDesign(params.id, {
        loops: loopsPayload,
        feed_pump_diff_pressure_bar: feedPumpDp ? Number(feedPumpDp) : null,
        feed_pump_efficiency: feedPumpEff ? Number(feedPumpEff) : null,
      });
      setCurrentProject(res.project);
      setDesignResult(res.design as unknown as FullDesignOutput);
      setSaveStatus("Saved");
      setNotice("Equipment sizing, housings, hydraulics, and validation checks recalculated.");
      if (goToNext) {
        router.push(`/projects/${params.id}/simulation`);
      }
    } catch (err) {
      setSaveStatus("Error");
      setErrorMsg(err instanceof ApiError ? err.message : "Calculation failed.");
    } finally {
      setSaving(false);
    }
  };

  if (!currentProject) {
    return (
      <AppShell activeStep="equipment">
        <div className="p-8 text-center text-sm text-slate-500">Loading equipment workspace...</div>
      </AppShell>
    );
  }

  if (!currentProject.concentration_design || !currentProject.feed_conditions) {
    return (
      <AppShell activeStep="equipment">
        <Alert variant="warning" title="Feed Analysis Required">
          Complete Module 1 (Feed Analysis) before configuring membranes and sizing loops.
          <div className="mt-3">
            <Button variant="teal" size="sm" onClick={() => router.push(`/projects/${params.id}/feed`)}>
              Go to Feed Analysis
            </Button>
          </div>
        </Alert>
      </AppShell>
    );
  }

  const conc = currentProject.concentration_design;
  const cond = currentProject.feed_conditions;
  const twoLoops = conc.selected_loops === 2;
  const flowUnit = user?.preferred_units?.flow || "L/h";
  const ld1Saved = currentProject.loop_designs.find((l) => l.loop_number === 1);
  const ld2Saved = currentProject.loop_designs.find((l) => l.loop_number === 2);

  const renderLoopCard = (
    loopNum: 1 | 2,
    state: LoopFormState,
    setState: React.Dispatch<React.SetStateAction<LoopFormState>>,
    netFeedLh: number,
    permLh: number,
    retLh: number
  ) => {
    const selectedMem = membranes.find((m) => m.id === Number(state.membrane_id));
    const compatHousings =
      selectedMem?.nominal_size === "8038"
        ? [
            'Sanitary 8.0" Stainless Vessel (8038)',
            'FRP 8.0" Pressure Vessel (8038)',
          ]
        : [
            'Sanitary 3.8" Stainless Vessel (3838)',
            'FRP 3.8" Pressure Vessel (3838)',
          ];

    return (
      <Card key={loopNum}>
        <CardHeader
          title={`Loop ${loopNum} — Membrane Selection, Flux, Housing & Hydraulics`}
          subtitle={`Net Feed: ${formatFlow(netFeedLh, flowUnit)} | Permeate Removal: ${formatFlow(permLh, flowUnit)} | Retentate: ${formatFlow(retLh, flowUnit)}`}
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectorForLoop(loopNum)}
            >
              <Layers className="w-3.5 h-3.5" /> Browse &amp; Select Membrane
            </Button>
          }
        />
        <CardBody className="space-y-5">
          {/* Membrane & Design Flux */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Label required>Selected Membrane Element</Label>
              <Select
                value={state.membrane_id}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  const mem = membranes.find((m) => m.id === id);
                  setState((prev) => ({
                    ...prev,
                    membrane_id: id,
                    housing_type:
                      mem?.nominal_size === "8038"
                        ? 'Sanitary 8.0" Stainless Vessel (8038)'
                        : 'Sanitary 3.8" Stainless Vessel (3838)',
                  }));
                }}
              >
                {membranes.map((m) => (
                  <option key={m.id} value={m.id}>
                    #{m.id} — {m.process_type} {m.model} ({m.membrane_area} m², {m.nominal_size}) [{m.verification_status}]
                  </option>
                ))}
              </Select>
              {selectedMem && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Area: <strong>{selectedMem.membrane_area} m²</strong> · Status:{" "}
                  <strong>{selectedMem.verification_status}</strong>
                  {selectedMem.id === 8 && " · Note: Confirm 3838-TS40-46 datasheet"}
                </p>
              )}
            </div>

            <div>
              <Label required>Loop {loopNum} Design Flux (LMH)</Label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                value={state.design_flux_lmh}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, design_flux_lmh: e.target.value }))
                }
              />
              <p className="text-[11px] text-amber-700 mt-1">
                User Supplied (No verified manufacturer flux curve loaded)
              </p>
            </div>
          </div>

          {/* Housing Arrangement */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
              <Sliders className="w-3.5 h-3.5 text-teal-600" />
              Membrane Housing Configuration (Compatible with {selectedMem?.nominal_size || "Element"})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Housing Type</Label>
                <Select
                  value={state.housing_type}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, housing_type: e.target.value }))
                  }
                >
                  {compatHousings.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label required>Elements per Housing</Label>
                <Select
                  value={state.elements_per_housing}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, elements_per_housing: e.target.value }))
                  }
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} element{n > 1 ? "s" : ""} / housing
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Max Allowable Elements / Housing</Label>
                <Input
                  type="number"
                  min="1"
                  value={state.max_elements_per_housing}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, max_elements_per_housing: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Housing Pressure Rating (bar)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Optional"
                  value={state.housing_pressure_rating_bar}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, housing_pressure_rating_bar: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Max Housing Feed Flow (L/h)</Label>
                <Input
                  type="number"
                  step="1"
                  placeholder="Optional"
                  value={state.max_housing_feed_flow_lh}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, max_housing_feed_flow_lh: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Max Housing ΔP (bar)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Optional"
                  value={state.max_housing_pressure_drop_bar}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, max_housing_pressure_drop_bar: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Hydraulic Inputs */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
              <Gauge className="w-3.5 h-3.5 text-sky-600" />
              Hydraulic Inputs (Optional — Leave Blank if Pending Manufacturer Limits)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <Label>Recirculation Flow (L/h)</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="Pending"
                  value={state.recirculation_flow_lh}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, recirculation_flow_lh: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Inlet Pressure (bar)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="Pending"
                  value={state.inlet_pressure_bar}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, inlet_pressure_bar: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Retentate Pressure (bar)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="Pending"
                  value={state.retentate_pressure_bar}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, retentate_pressure_bar: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Permeate Pressure (bar)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="Pending"
                  value={state.permeate_pressure_bar}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, permeate_pressure_bar: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Pump Efficiency (0–1)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="1"
                  placeholder="e.g. 0.72"
                  value={state.pump_efficiency}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, pump_efficiency: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  };

  return (
    <AppShell activeStep="equipment">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Module 2 — Equipment Design</h1>
            <p className="text-sm text-slate-500">
              Automatic loop allocation, membrane selection, loop sizing, housing arrangement, and hydraulic calculations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={() => handleCalculateSave(false)} disabled={saving}>
              <Calculator className="w-4 h-4" />
              {saving ? "Calculating..." : "Calculate & Save Sizing"}
            </Button>
            <Button variant="teal" onClick={() => handleCalculateSave(true)} disabled={saving}>
              <Activity className="w-4 h-4" /> Save &amp; Open Process Diagram
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {notice && <Alert variant="success">{notice}</Alert>}
        {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

        {conc.concentration_factor >= 3 && (
          <Alert variant="warning" title="Concentration Factor Outside Automatic Range">
            CF = {conc.concentration_factor.toFixed(3)} (&gt;= 3.0) is outside the defined COW PRO v1
            automatic design range. Preliminary two-loop heuristics are shown with engineering caution.
          </Alert>
        )}

        {/* Section 8–12: Design Basis, Concentration Factor, Permeate Removal & Loop Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardBody>
              <span className="text-xs font-semibold uppercase text-slate-500">Feed Flow</span>
              <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
                {formatFlow(cond.feed_flow, flowUnit)}
              </p>
              <span className="text-[11px] text-slate-500">
                {currentProject.process_type} · {currentProject.milk_type}
              </span>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <span className="text-xs font-semibold uppercase text-slate-500">
                Concentration Factor
              </span>
              <p className="text-xl font-bold text-teal-700 mt-1 tabular-nums">
                {conc.concentration_factor.toFixed(3)}×
              </p>
              <span className="text-[11px] text-slate-500">
                {conc.initial_percentage.toFixed(2)}% → {conc.target_percentage.toFixed(2)}% {conc.target_basis}
              </span>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <span className="text-xs font-semibold uppercase text-slate-500">
                Total Permeate Removal
              </span>
              <p className="text-xl font-bold text-sky-700 mt-1 tabular-nums">
                {formatFlow(conc.permeate_removal, flowUnit)}
              </p>
              <span className="text-[11px] text-slate-500">
                Final Retentate: {formatFlow(conc.final_retentate_flow, flowUnit)}
              </span>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <span className="text-xs font-semibold uppercase text-slate-500">
                Auto Loop Configuration
              </span>
              <p className="text-xl font-bold text-slate-900 mt-1">
                {twoLoops ? "Two Loops" : "Single Loop"}
              </p>
              <span className="text-[11px] text-slate-500">
                {twoLoops ? "2/3 Loop 1 · 1/3 Loop 2" : "100% Loop 1"}
              </span>
            </CardBody>
          </Card>
        </div>

        {/* Loop 1 Card */}
        {renderLoopCard(
          1,
          loop1,
          setLoop1,
          ld1Saved?.feed_flow ?? cond.feed_flow,
          ld1Saved?.permeate_flow ?? (twoLoops ? (conc.permeate_removal * 2) / 3 : conc.permeate_removal),
          ld1Saved?.retentate_flow ?? (cond.feed_flow - (twoLoops ? (conc.permeate_removal * 2) / 3 : conc.permeate_removal))
        )}

        {/* Loop 2 Card (or Inactive Notice) */}
        {twoLoops ? (
          renderLoopCard(
            2,
            loop2,
            setLoop2,
            ld2Saved?.feed_flow ?? (cond.feed_flow - (conc.permeate_removal * 2) / 3),
            ld2Saved?.permeate_flow ?? conc.permeate_removal / 3,
            ld2Saved?.retentate_flow ?? conc.final_retentate_flow
          )
        ) : (
          <Alert variant="info" title="Loop 2 Inactive (Single-Loop Configuration)">
            Since 1.0 &lt;= Concentration Factor ({conc.concentration_factor.toFixed(3)}) &lt;= 1.6,
            COW PRO automatically activates Loop 1 only (Loop 2 Permeate Removal = 0 L/h).
          </Alert>
        )}

        {/* Feed Pump Sizing (Distinguished from Recirculation Pumps) */}
        <Card>
          <CardHeader
            title="Feed Pump Hydraulic Parameters (SI Sizing)"
            subtitle="Distinguished separately from Loop 1 & Loop 2 recirculation pumps. Evaluated only when pressure differential & efficiency are supplied."
          />
          <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Required Feed Pump Differential Pressure ΔP (bar)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                placeholder="Pending hydraulic circuit design"
                value={feedPumpDp}
                onChange={(e) => setFeedPumpDp(e.target.value)}
              />
            </div>
            <div>
              <Label>Feed Pump Efficiency (0–1)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max="1"
                placeholder="e.g. 0.75"
                value={feedPumpEff}
                onChange={(e) => setFeedPumpEff(e.target.value)}
              />
            </div>
          </CardBody>
        </Card>

        {/* Equipment Sizing Summary */}
        {designResult && (
          <Card>
            <CardHeader
              title="Calculated Equipment & Housing Summary"
              subtitle="Rounded upward per active loop; full precision preserved internally"
              action={
                <Badge
                  className={
                    designResult.validation.can_mark_validated
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-800 border-amber-200"
                  }
                >
                  Validation: {designResult.validation.overall_status}
                </Badge>
              }
            />
            <CardBody className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 uppercase text-[11px] text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5">Loop</th>
                      <th className="px-3 py-2.5">Membrane Model</th>
                      <th className="px-3 py-2.5">Flux (LMH)</th>
                      <th className="px-3 py-2.5">Exact Elements</th>
                      <th className="px-3 py-2.5">Membranes Req.</th>
                      <th className="px-3 py-2.5">Installed Area</th>
                      <th className="px-3 py-2.5">Housings</th>
                      <th className="px-3 py-2.5">Spare Pos.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {designResult.loop_sizings.map((s) => (
                      <tr key={s.loop_number}>
                        <td className="px-3 py-2.5 font-semibold">Loop {s.loop_number}</td>
                        <td className="px-3 py-2.5">
                          {s.membrane_model} ({s.membrane_area_m2} m²)
                        </td>
                        <td className="px-3 py-2.5 font-mono">{s.design_flux_lmh.toFixed(1)}</td>
                        <td className="px-3 py-2.5 font-mono">{s.exact_membranes_required.toFixed(3)}</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-slate-900">
                          {s.membrane_count}
                        </td>
                        <td className="px-3 py-2.5 font-mono">{s.installed_area_m2.toFixed(2)} m²</td>
                        <td className="px-3 py-2.5 font-mono">{s.housing_count}</td>
                        <td className="px-3 py-2.5 font-mono">
                          {s.spare_positions > 0 ? (
                            <span className="text-amber-700 font-semibold">{s.spare_positions}</span>
                          ) : (
                            "0"
                          )}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-semibold">
                      <td className="px-3 py-2.5" colSpan={4}>
                        Total Installed System Equipment
                      </td>
                      <td className="px-3 py-2.5 font-mono text-teal-700">
                        {designResult.total_membranes} membranes
                      </td>
                      <td className="px-3 py-2.5 font-mono text-sky-700">
                        {designResult.total_installed_area_m2.toFixed(2)} m²
                      </td>
                      <td className="px-3 py-2.5 font-mono">{designResult.total_housings} housings</td>
                      <td className="px-3 py-2.5">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {designResult.loop_sizings.flatMap((s) => s.housing_warnings).map((w, i) => (
                <Alert key={i} variant="warning">
                  <span className="inline-flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> {w}
                  </span>
                </Alert>
              ))}
            </CardBody>
          </Card>
        )}
      </div>

      {/* Membrane Selection Modal (Section 15) */}
      <Modal
        open={selectorForLoop !== null}
        onClose={() => setSelectorForLoop(null)}
        title={`Select Membrane for Loop ${selectorForLoop}`}
        maxWidth="max-w-6xl"
      >
        <MembraneExplorer
          mode="select"
          ashRestricted={Boolean(currentProject.feed_composition?.ash_design_supplied)}
          projectProcess={currentProject.process_type}
          selectedMembraneId={selectorForLoop === 1 ? loop1.membrane_id : loop2.membrane_id}
          onSelectMembrane={(mem) => {
            if (selectorForLoop === 1) {
              setLoop1((p) => ({
                ...p,
                membrane_id: mem.id,
                housing_type:
                  mem.nominal_size === "8038"
                    ? 'Sanitary 8.0" Stainless Vessel (8038)'
                    : 'Sanitary 3.8" Stainless Vessel (3838)',
              }));
            } else if (selectorForLoop === 2) {
              setLoop2((p) => ({
                ...p,
                membrane_id: mem.id,
                housing_type:
                  mem.nominal_size === "8038"
                    ? 'Sanitary 8.0" Stainless Vessel (8038)'
                    : 'Sanitary 3.8" Stainless Vessel (3838)',
              }));
            }
            setSelectorForLoop(null);
          }}
          onContinueToSizing={() => setSelectorForLoop(null)}
        />
      </Modal>
    </AppShell>
  );
}
