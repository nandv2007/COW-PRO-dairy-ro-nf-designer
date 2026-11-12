"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Calculator, Droplets, FlaskConical, Target } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Input, Label, Select } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { api, ApiError } from "@/lib/api";
import { cn, formatFlow } from "@/lib/utils";
import type { MilkType } from "@/types/cowpro";

type Stage = "composition" | "feed" | "final";

export default function FeedAnalysisPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { currentProject, loadProject, setCurrentProject, setSaveStatus } = useProject();

  const [stage, setStage] = useState<Stage>("composition");
  const [milkType, setMilkType] = useState<MilkType>("Custom Milk");
  const [fatPct, setFatPct] = useState<string>("4.0");
  const [inputMode, setInputMode] = useState<"SNF" | "Total Solids">("SNF");
  const [snfPct, setSnfPct] = useState<string>("9.0");
  const [tsPct, setTsPct] = useState<string>("13.0");
  const [proteinPct, setProteinPct] = useState<string>("");
  const [lactosePct, setLactosePct] = useState<string>("");
  const [ashPct, setAshPct] = useState<string>("");
  const [otherSolidsPct, setOtherSolidsPct] = useState<string>("");
  const [ashDesignSupplied, setAshDesignSupplied] = useState<boolean>(false);
  const [calciumMgL, setCalciumMgL] = useState<string>("");
  const [sodiumMgL, setSodiumMgL] = useState<string>("");
  const [potassiumMgL, setPotassiumMgL] = useState<string>("");

  // Stage 2: Feed Conditions
  const [flowMethod, setFlowMethod] = useState<"direct" | "capacity">("direct");
  const [feedFlow, setFeedFlow] = useState<string>("1000");
  const [flowUnit, setFlowUnit] = useState<"L/h" | "m3/h">("L/h");
  const [capacity, setCapacity] = useState<string>("");
  const [capacityUnit, setCapacityUnit] = useState<"L" | "m3" | "kg">("L");
  const [opTime, setOpTime] = useState<string>("");
  const [temperature, setTemperature] = useState<string>("10");
  const [ph, setPh] = useState<string>("");
  const [density, setDensity] = useState<string>("");
  const [viscosity, setViscosity] = useState<string>("");
  const [conductivity, setConductivity] = useState<string>("");

  // Stage 3: Final Concentration
  const [targetBasis, setTargetBasis] = useState<"SNF" | "Total Solids">("SNF");
  const [targetPct, setTargetPct] = useState<string>("18.0");

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    loadProject(params.id)
      .then((p) => {
        setMilkType(p.milk_type);
        if (p.feed_composition) {
          const fc = p.feed_composition;
          setMilkType(fc.milk_type);
          setFatPct(String(fc.fat_percentage));
          setInputMode(fc.input_mode);
          setSnfPct(String(fc.snf_percentage));
          setTsPct(String(fc.total_solids_percentage));
          setProteinPct(fc.protein_percentage !== null ? String(fc.protein_percentage) : "");
          setLactosePct(fc.lactose_percentage !== null ? String(fc.lactose_percentage) : "");
          setAshPct(fc.ash_percentage !== null ? String(fc.ash_percentage) : "");
          setOtherSolidsPct(fc.other_solids_percentage !== null ? String(fc.other_solids_percentage) : "");
          setAshDesignSupplied(fc.ash_design_supplied);
          setCalciumMgL(fc.individual_minerals?.Ca !== undefined ? String(fc.individual_minerals.Ca) : "");
          setSodiumMgL(fc.individual_minerals?.Na !== undefined ? String(fc.individual_minerals.Na) : "");
          setPotassiumMgL(fc.individual_minerals?.K !== undefined ? String(fc.individual_minerals.K) : "");
        }
        if (p.feed_conditions) {
          const cond = p.feed_conditions;
          setFlowMethod(cond.flow_input_method);
          setFeedFlow(String(cond.feed_flow));
          setFlowUnit(cond.feed_flow_unit);
          setCapacity(cond.processing_capacity !== null ? String(cond.processing_capacity) : "");
          setCapacityUnit(cond.capacity_unit || "L");
          setOpTime(cond.operating_time !== null ? String(cond.operating_time) : "");
          setTemperature(String(cond.temperature));
          setPh(cond.ph !== null ? String(cond.ph) : "");
          setDensity(cond.density !== null ? String(cond.density) : "");
          setViscosity(cond.viscosity !== null ? String(cond.viscosity) : "");
          setConductivity(cond.conductivity !== null ? String(cond.conductivity) : "");
        }
        if (p.concentration_design) {
          setTargetBasis(p.concentration_design.target_basis);
          setTargetPct(String(p.concentration_design.target_percentage));
        }
      })
      .catch((err) => setErrorMsg(err instanceof ApiError ? err.message : "Failed to load project."));
  }, [params.id, loadProject]);

  // Derived display numbers (preview only; backend computes authoritative values)
  const fatNum = Number(fatPct) || 0;
  const computedSnf =
    inputMode === "SNF" ? Number(snfPct) || 0 : Math.max(0, (Number(tsPct) || 0) - fatNum);
  const computedTs =
    inputMode === "SNF" ? fatNum + (Number(snfPct) || 0) : Number(tsPct) || 0;

  const hasAshInputs =
    ashDesignSupplied ||
    ashPct.trim() !== "" ||
    calciumMgL.trim() !== "" ||
    sodiumMgL.trim() !== "" ||
    potassiumMgL.trim() !== "";

  const previewFeedLh = (() => {
    if (flowMethod === "direct") {
      const f = Number(feedFlow) || 0;
      return flowUnit === "m3/h" ? f * 1000 : f;
    }
    const c = Number(capacity) || 0;
    const t = Number(opTime) || 0;
    if (c <= 0 || t <= 0) return 0;
    if (capacityUnit === "m3") return (c * 1000) / t;
    if (capacityUnit === "kg") {
      const d = Number(density) || 0;
      return d > 0 ? c / d / t : 0;
    }
    return c / t;
  })();

  const initialBasisVal = targetBasis === "SNF" ? computedSnf : computedTs;
  const targetVal = Number(targetPct) || 0;
  const previewCf = initialBasisVal > 0 && targetVal > 0 ? targetVal / initialBasisVal : 0;
  const previewPermeateLh =
    previewCf >= 1 && previewFeedLh > 0 ? previewFeedLh * (1 - 1 / previewCf) : 0;

  const handleSave = async (navigateNext: boolean) => {
    if (!params.id) return;
    setSaving(true);
    setSaveStatus("Saving...");
    setErrorMsg(null);
    setSavedBanner(null);

    const minerals: Record<string, number> = {};
    if (calciumMgL.trim() !== "") minerals.Ca = Number(calciumMgL);
    if (sodiumMgL.trim() !== "") minerals.Na = Number(sodiumMgL);
    if (potassiumMgL.trim() !== "") minerals.K = Number(potassiumMgL);

    const payload: Record<string, unknown> = {
      milk_type: milkType,
      fat_percentage: Number(fatPct),
      input_mode: inputMode,
      snf_percentage: inputMode === "SNF" ? Number(snfPct) : null,
      total_solids_percentage: inputMode === "Total Solids" ? Number(tsPct) : null,
      protein_percentage: proteinPct.trim() !== "" ? Number(proteinPct) : null,
      lactose_percentage: lactosePct.trim() !== "" ? Number(lactosePct) : null,
      ash_percentage: ashPct.trim() !== "" ? Number(ashPct) : null,
      other_solids_percentage: otherSolidsPct.trim() !== "" ? Number(otherSolidsPct) : null,
      individual_minerals: minerals,
      ash_design_supplied: hasAshInputs,
      flow_input_method: flowMethod,
      feed_flow: flowMethod === "direct" ? Number(feedFlow) : null,
      feed_flow_unit: flowUnit,
      processing_capacity: flowMethod === "capacity" ? Number(capacity) : null,
      capacity_unit: capacityUnit,
      operating_time: opTime.trim() !== "" ? Number(opTime) : null,
      temperature: Number(temperature),
      ph: ph.trim() !== "" ? Number(ph) : null,
      density: density.trim() !== "" ? Number(density) : null,
      viscosity: viscosity.trim() !== "" ? Number(viscosity) : null,
      conductivity: conductivity.trim() !== "" ? Number(conductivity) : null,
      target_basis: targetBasis,
      target_percentage: Number(targetPct),
    };

    try {
      const res = await api.projects.saveFeedAnalysis(params.id, payload);
      setCurrentProject(res.project);
      setSaveStatus("Saved");
      setSavedBanner("Feed analysis saved and concentration / loop requirements updated.");
      if (navigateNext) {
        router.push(`/projects/${params.id}/equipment`);
      }
    } catch (err) {
      setSaveStatus("Error");
      setErrorMsg(err instanceof ApiError ? err.message : "Validation failed for feed inputs.");
    } finally {
      setSaving(false);
    }
  };

  const flowDisplayUnit = user?.preferred_units?.flow || "L/h";

  return (
    <AppShell activeStep="feed">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Module 1 — Feed Analysis</h1>
            <p className="text-sm text-slate-500">
              Define milk composition, feed capacity/conditions, and target concentration across three stages.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
              Save Feed Analysis
            </Button>
            <Button variant="teal" onClick={() => handleSave(true)} disabled={saving}>
              Continue to Equipment Design <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 3-Stage Sub-navigation */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-xl bg-white border border-slate-200 p-1.5">
          {[
            { id: "composition", label: "1. Milk Composition", icon: FlaskConical },
            { id: "feed", label: "2. Feed Conditions", icon: Droplets },
            { id: "final", label: "3. Final Concentration", icon: Target },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStage(tab.id as Stage)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-xs sm:text-sm font-semibold transition-colors cursor-pointer",
                  stage === tab.id
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {savedBanner && <Alert variant="success">{savedBanner}</Alert>}
        {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

        {hasAshInputs && (
          <Alert variant="warning" title="COW PRO v1 Ash / Mineral Separation Rule Active">
            Ash or mineral properties are supplied. In COW PRO Version 1, membrane selection is
            restricted to <strong>Nanofiltration (NF)</strong> membranes. This is a COW PRO v1
            application rule, not a universal limitation of RO technology.
            {currentProject?.process_type === "RO" && (
              <span className="block mt-1 font-semibold">
                Action Required: Your project process is currently RO. Switch project process to NF
                in Project Setup or remove ash separation properties.
              </span>
            )}
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Active Stage Form */}
          <div className="lg:col-span-8 space-y-5">
            {stage === "composition" && (
              <Card>
                <CardHeader
                  title="Stage 1: Milk Composition (% w/w Mass Basis)"
                  subtitle="SNF is selected by default. Missing protein, lactose, or ash values are never fabricated."
                />
                <CardBody className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label required>Milk Type</Label>
                      <Select
                        value={milkType}
                        onChange={(e) => {
                          setMilkType(e.target.value as MilkType);
                          setSaveStatus("Unsaved Changes");
                        }}
                      >
                        <option value="Skim Milk">Skim Milk</option>
                        <option value="Pasteurized Whole Cow Milk">Pasteurized Whole Cow Milk</option>
                        <option value="Buffalo Milk">Buffalo Milk</option>
                        <option value="Custom Milk">Custom Milk</option>
                      </Select>
                    </div>
                    <div>
                      <Label required>Fat Percentage (% w/w)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={fatPct}
                        onChange={(e) => {
                          setFatPct(e.target.value);
                          setSaveStatus("Unsaved Changes");
                        }}
                      />
                    </div>
                  </div>

                  {/* Radio buttons: SNF vs Total Solids */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <Label>Primary Solids Input Selection</Label>
                    <div className="flex flex-wrap gap-6">
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
                        <input
                          type="radio"
                          name="solids_mode"
                          checked={inputMode === "SNF"}
                          onChange={() => setInputMode("SNF")}
                          className="text-teal-600 focus:ring-teal-600"
                        />
                        Enter SNF % (Calculate Total Solids = SNF + Fat)
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
                        <input
                          type="radio"
                          name="solids_mode"
                          checked={inputMode === "Total Solids"}
                          onChange={() => setInputMode("Total Solids")}
                          className="text-teal-600 focus:ring-teal-600"
                        />
                        Enter Total Solids % (Calculate SNF = Total Solids − Fat)
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div>
                        <Label required={inputMode === "SNF"}>
                          SNF Percentage (% w/w){" "}
                          {inputMode === "Total Solids" && "(Calculated)"}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={inputMode === "SNF" ? snfPct : computedSnf.toFixed(3)}
                          disabled={inputMode !== "SNF"}
                          onChange={(e) => setSnfPct(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label required={inputMode === "Total Solids"}>
                          Total Solids Percentage (% w/w){" "}
                          {inputMode === "SNF" && "(Calculated)"}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={inputMode === "Total Solids" ? tsPct : computedTs.toFixed(3)}
                          disabled={inputMode !== "Total Solids"}
                          onChange={(e) => setTsPct(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Optional Composition Fields */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Optional Measured Components (Leave Blank if Unmeasured)
                      </span>
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ashDesignSupplied}
                          onChange={(e) => setAshDesignSupplied(e.target.checked)}
                          className="rounded border-slate-300 text-teal-600"
                        />
                        Ash / mineral separation design
                      </label>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <Label>Protein (% w/w)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Not supplied"
                          value={proteinPct}
                          onChange={(e) => setProteinPct(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Lactose (% w/w)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Not supplied"
                          value={lactosePct}
                          onChange={(e) => setLactosePct(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Ash (% w/w)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Triggers NF rule"
                          value={ashPct}
                          onChange={(e) => setAshPct(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Other Solids (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Not supplied"
                          value={otherSolidsPct}
                          onChange={(e) => setOtherSolidsPct(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div>
                        <Label>Calcium Ca (mg/L)</Label>
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          placeholder="Optional"
                          value={calciumMgL}
                          onChange={(e) => setCalciumMgL(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Sodium Na (mg/L)</Label>
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          placeholder="Optional"
                          value={sodiumMgL}
                          onChange={(e) => setSodiumMgL(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Potassium K (mg/L)</Label>
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          placeholder="Optional"
                          value={potassiumMgL}
                          onChange={(e) => setPotassiumMgL(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button type="button" variant="primary" onClick={() => setStage("feed")}>
                      Next: Feed Conditions <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardBody>
              </Card>
            )}

            {stage === "feed" && (
              <Card>
                <CardHeader
                  title="Stage 2: Feed Flow & Operating Conditions"
                  subtitle="Define flow directly or via batch processing capacity / operating time"
                />
                <CardBody className="space-y-5">
                  <div className="flex flex-wrap gap-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="flow_method"
                        checked={flowMethod === "direct"}
                        onChange={() => setFlowMethod("direct")}
                      />
                      Method A: Direct Feed Flow
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="flow_method"
                        checked={flowMethod === "capacity"}
                        onChange={() => setFlowMethod("capacity")}
                      />
                      Method B: Processing Capacity / Operating Time
                    </label>
                  </div>

                  {flowMethod === "direct" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2">
                        <Label required>Feed Flow Rate</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={feedFlow}
                          onChange={(e) => setFeedFlow(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label required>Flow Unit</Label>
                        <Select
                          value={flowUnit}
                          onChange={(e) => setFlowUnit(e.target.value as "L/h" | "m3/h")}
                        >
                          <option value="L/h">L/h</option>
                          <option value="m3/h">m³/h</option>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <Label required>Total Processing Capacity</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={capacity}
                          onChange={(e) => setCapacity(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label required>Capacity Unit</Label>
                        <Select
                          value={capacityUnit}
                          onChange={(e) => setCapacityUnit(e.target.value as "L" | "m3" | "kg")}
                        >
                          <option value="L">Liters (L)</option>
                          <option value="m3">Cubic meters (m³)</option>
                          <option value="kg">Kilograms (kg) — requires density</option>
                        </Select>
                      </div>
                      <div>
                        <Label required>Operating Time (h)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0.01"
                          value={opTime}
                          onChange={(e) => setOpTime(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                    <div>
                      <Label required>Feed Temperature (°C)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={temperature}
                        onChange={(e) => setTemperature(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label required={flowMethod === "capacity" && capacityUnit === "kg"}>
                        Density (kg/L)
                      </Label>
                      <Input
                        type="number"
                        step="0.001"
                        placeholder={capacityUnit === "kg" ? "Required for kg" : "Optional (e.g. 1.03)"}
                        value={density}
                        onChange={(e) => setDensity(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>pH (Optional)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="14"
                        placeholder="Optional"
                        value={ph}
                        onChange={(e) => setPh(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Viscosity (mPa·s / cP)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Optional"
                        value={viscosity}
                        onChange={(e) => setViscosity(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Conductivity (mS/cm)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Optional"
                        value={conductivity}
                        onChange={(e) => setConductivity(e.target.value)}
                      />
                    </div>
                    {flowMethod === "direct" && (
                      <div>
                        <Label>Batch Operating Time (h)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="Optional (for volume)"
                          value={opTime}
                          onChange={(e) => setOpTime(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between pt-2">
                    <Button type="button" variant="outline" onClick={() => setStage("composition")}>
                      ← Back: Composition
                    </Button>
                    <Button type="button" variant="primary" onClick={() => setStage("final")}>
                      Next: Final Concentration <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardBody>
              </Card>
            )}

            {stage === "final" && (
              <Card>
                <CardHeader
                  title="Stage 3: Target Final Concentration"
                  subtitle="Calculate preliminary Concentration Factor and permeate removal requirements"
                />
                <CardBody className="space-y-5">
                  <Alert variant="warning" title="Engineering Distinction — Preliminary Volumetric Assumption">
                    The ratio of target to initial solids concentration provides a preliminary
                    concentration factor. Actual volumetric concentration factor differs when feed and
                    retentate densities change, solids/minerals pass into permeate (especially in
                    NF), or components are retained differently.
                  </Alert>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label required>Concentration Basis</Label>
                      <Select
                        value={targetBasis}
                        onChange={(e) => setTargetBasis(e.target.value as "SNF" | "Total Solids")}
                      >
                        <option value="SNF">Final SNF Percentage</option>
                        <option value="Total Solids">Final Total Solids Percentage</option>
                      </Select>
                    </div>
                    <div>
                      <Label>Initial {targetBasis} (%)</Label>
                      <Input value={initialBasisVal.toFixed(3)} disabled />
                    </div>
                    <div>
                      <Label required>Target Final {targetBasis} (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max="100"
                        value={targetPct}
                        onChange={(e) => setTargetPct(e.target.value)}
                      />
                    </div>
                  </div>

                  {previewCf > 0 && previewCf < 1 && (
                    <Alert variant="error">
                      Target concentration ({targetVal}%) is lower than initial {targetBasis} (
                      {initialBasisVal.toFixed(2)}%). Concentration Factor must be &gt;= 1.0.
                    </Alert>
                  )}
                  {previewCf >= 3 && (
                    <Alert variant="warning">
                      Concentration Factor ({previewCf.toFixed(2)}) is &gt;= 3.0, outside the defined
                      COW PRO Version 1 automatic loop design range (1 &lt; CF &lt; 3).
                    </Alert>
                  )}

                  <div className="flex justify-between pt-2 border-t border-slate-100">
                    <Button type="button" variant="outline" onClick={() => setStage("feed")}>
                      ← Back: Feed Conditions
                    </Button>
                    <Button type="button" variant="teal" onClick={() => handleSave(true)} disabled={saving}>
                      <Calculator className="w-4 h-4" />
                      {saving ? "Calculating..." : "Calculate & Continue to Equipment Design"}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardBody>
              </Card>
            )}
          </div>

          {/* Right: Live Module 1 Output Summary */}
          <Card className="lg:col-span-4 h-fit">
            <CardHeader
              title="Module 1 Output Summary"
              subtitle="Live design basis passed to Module 2"
            />
            <CardBody className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Milk Type</span>
                <span className="font-semibold text-slate-900">{milkType}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Membrane Process</span>
                <Badge className="bg-slate-100 text-slate-800 border-slate-200">
                  {currentProject?.process_type || "—"}
                </Badge>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Feed Flow</span>
                <span className="font-mono font-semibold text-slate-900">
                  {formatFlow(previewFeedLh, flowDisplayUnit)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Initial Fat / SNF / TS</span>
                <span className="font-mono font-semibold text-slate-900">
                  {fatNum.toFixed(2)}% / {computedSnf.toFixed(2)}% / {computedTs.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Target {targetBasis}</span>
                <span className="font-mono font-semibold text-slate-900">{targetVal.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Concentration Factor</span>
                <span className="font-mono font-bold text-teal-700 text-sm">
                  {previewCf > 0 ? previewCf.toFixed(3) : "—"}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Total Permeate Removal</span>
                <span className="font-mono font-semibold text-sky-700">
                  {formatFlow(previewPermeateLh, flowDisplayUnit)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Auto Loop Selection</span>
                <span className="font-semibold text-slate-900">
                  {previewCf >= 3
                    ? "Out of Auto Range (>= 3)"
                    : previewCf > 1.6
                    ? "Two Loops (2/3 & 1/3)"
                    : previewCf >= 1
                    ? "Single Loop"
                    : "Invalid (< 1)"}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Feed Temperature</span>
                <span className="font-mono font-semibold text-slate-900">{temperature} °C</span>
              </div>

              <Button
                variant="teal"
                className="w-full mt-2"
                onClick={() => handleSave(true)}
                disabled={saving}
              >
                Continue to Equipment Design <ArrowRight className="w-4 h-4" />
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
