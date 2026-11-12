"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Database,
  ExternalLink,
  FileSpreadsheet,
  GitCompare,
  Layers,
  ShieldAlert,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Input, Label, Modal, Select } from "@/components/ui";
import type { Membrane, VerificationStatus } from "@/types/cowpro";

export function MembraneExplorer({
  mode = "browse",
  ashRestricted = false,
  projectProcess,
  selectedMembraneId,
  onSelectMembrane,
  onContinueToSizing,
}: {
  mode?: "browse" | "select";
  ashRestricted?: boolean;
  projectProcess?: "RO" | "NF";
  selectedMembraneId?: number | null;
  onSelectMembrane?: (membrane: Membrane) => void;
  onContinueToSizing?: () => void;
}) {
  const [membranes, setMembranes] = useState<Membrane[]>([]);
  const [loading, setLoading] = useState(true);
  const [processFilter, setProcessFilter] = useState<string>(
    ashRestricted ? "NF" : projectProcess || "ALL"
  );
  const [sizeFilter, setSizeFilter] = useState<string>("ALL");
  const [areaFilter, setAreaFilter] = useState<string>("ALL");
  const [modelQuery, setModelQuery] = useState<string>("");
  const [ashToggle, setAshToggle] = useState<boolean>(ashRestricted);
  const [restrictionNote, setRestrictionNote] = useState<string | null>(null);
  const [activeMembrane, setActiveMembrane] = useState<Membrane | null>(null);
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareItems, setCompareItems] = useState<Membrane[]>([]);
  const [datasheetOpen, setDatasheetOpen] = useState(false);
  const [editManufacturer, setEditManufacturer] = useState("");
  const [editFullModel, setEditFullModel] = useState("");
  const [editMaxPressure, setEditMaxPressure] = useState("");
  const [editMaxTemp, setEditMaxTemp] = useState("");
  const [editPhMin, setEditPhMin] = useState("");
  const [editPhMax, setEditPhMax] = useState("");
  const [editMaxDp, setEditMaxDp] = useState("");
  const [editMaxFlow, setEditMaxFlow] = useState("");
  const [editSaltRej, setEditSaltRej] = useState("");
  const [editMinRej, setEditMinRej] = useState("");
  const [editStatus, setEditStatus] = useState<VerificationStatus>("User Supplied");
  const [editNotes, setEditNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const effectiveAsh = ashRestricted || ashToggle;
  const effectiveProcess = effectiveAsh ? "NF" : processFilter;

  const fetchMembranes = useCallback(async () => {
    try {
      const areaBounds =
        areaFilter === "SMALL"
          ? { max_area: 10 }
          : areaFilter === "LARGE"
          ? { min_area: 20 }
          : {};
      const res = await api.membranes.list({
        process_type: effectiveProcess === "ALL" ? undefined : effectiveProcess,
        nominal_size: sizeFilter === "ALL" ? undefined : sizeFilter,
        model_query: modelQuery || undefined,
        ash_supplied: effectiveAsh,
        ...areaBounds,
      });
      setMembranes(res.membranes);
      setRestrictionNote(res.restriction_note);

      setActiveMembrane((prev) => {
        if (selectedMembraneId) {
          const matched = res.membranes.find((m) => m.id === selectedMembraneId);
          if (matched) return matched;
        }
        if (prev) {
          const same = res.membranes.find((m) => m.id === prev.id);
          if (same) return same;
        }
        // Section 14 default demonstration membrane: ID 8 (3838 TS40, 4.9 m2)
        return res.membranes.find((m) => m.id === 8) || res.membranes[0] || null;
      });
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to load membrane catalog.");
    } finally {
      setLoading(false);
    }
  }, [effectiveProcess, sizeFilter, areaFilter, modelQuery, effectiveAsh, selectedMembraneId]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!active) return;
      await fetchMembranes();
    };
    void run();
    return () => {
      active = false;
    };
  }, [fetchMembranes]);

  const toggleCompare = (id: number) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const openCompare = async () => {
    const idsToFetch = compareIds.length >= 2 ? compareIds : membranes.slice(0, 3).map((m) => m.id);
    if (idsToFetch.length < 2) return;
    const res = await api.membranes.compare(idsToFetch);
    setCompareItems(res.membranes);
    setCompareOpen(true);
  };

  const openDatasheetModal = (m: Membrane) => {
    setEditManufacturer(m.manufacturer);
    setEditFullModel(m.full_model_number || "");
    setEditMaxPressure(m.max_pressure !== null ? String(m.max_pressure) : "");
    setEditMaxTemp(m.max_temperature !== null ? String(m.max_temperature) : "");
    setEditPhMin(m.operating_ph_min !== null ? String(m.operating_ph_min) : "");
    setEditPhMax(m.operating_ph_max !== null ? String(m.operating_ph_max) : "");
    setEditMaxDp(m.max_pressure_drop !== null ? String(m.max_pressure_drop) : "");
    setEditMaxFlow(m.max_feed_flow !== null ? String(m.max_feed_flow) : "");
    setEditSaltRej(m.salt_rejection || "");
    setEditMinRej(m.mineral_rejection || "");
    setEditStatus(m.verification_status);
    setEditNotes(m.notes || "");
    setDatasheetOpen(true);
  };

  const handleSaveDatasheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMembrane) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const payload: Record<string, unknown> = {
        manufacturer: editManufacturer,
        full_model_number: editFullModel || null,
        verification_status: editStatus,
        notes: editNotes || null,
        max_pressure: editMaxPressure ? Number(editMaxPressure) : null,
        max_temperature: editMaxTemp ? Number(editMaxTemp) : null,
        operating_ph_min: editPhMin ? Number(editPhMin) : null,
        operating_ph_max: editPhMax ? Number(editPhMax) : null,
        max_pressure_drop: editMaxDp ? Number(editMaxDp) : null,
        max_feed_flow: editMaxFlow ? Number(editMaxFlow) : null,
        salt_rejection: editSaltRej || null,
        mineral_rejection: editMinRej || null,
        properties: [
          { property_name: "Maximum Operating Pressure", property_value: editMaxPressure || null, property_unit: "bar", data_source: editStatus, verification_status: editMaxPressure ? editStatus : "Unknown" },
          { property_name: "Maximum Operating Temperature", property_value: editMaxTemp || null, property_unit: "°C", data_source: editStatus, verification_status: editMaxTemp ? editStatus : "Unknown" },
          { property_name: "Operating pH Range", property_value: editPhMin && editPhMax ? `${editPhMin}–${editPhMax}` : null, property_unit: "pH", data_source: editStatus, verification_status: editPhMin && editPhMax ? editStatus : "Unknown" },
          { property_name: "Maximum Pressure Drop", property_value: editMaxDp || null, property_unit: "bar", data_source: editStatus, verification_status: editMaxDp ? editStatus : "Unknown" },
          { property_name: "Maximum Feed Flow", property_value: editMaxFlow || null, property_unit: "m³/h", data_source: editStatus, verification_status: editMaxFlow ? editStatus : "Unknown" },
          { property_name: "Salt Rejection", property_value: editSaltRej || null, property_unit: "%", data_source: editStatus, verification_status: editSaltRej ? editStatus : "Unknown" },
          { property_name: "Mineral Rejection", property_value: editMinRej || null, property_unit: "%", data_source: editStatus, verification_status: editMinRej ? editStatus : "Unknown" },
        ],
      };
      const res = await api.membranes.update(activeMembrane.id, payload);
      setActiveMembrane(res.membrane);
      setSuccessMsg(`Updated membrane #${res.membrane.id} (${res.membrane.model}) datasheet record.`);
      setDatasheetOpen(false);
      await fetchMembranes();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to save datasheet properties.");
    }
  };

  return (
    <div className="space-y-4">
      {restrictionNote && (
        <Alert variant="warning" title="COW PRO v1 Ash / Mineral Separation Rule Active">
          {restrictionNote}
        </Alert>
      )}
      {errorMsg && <Alert variant="error">{errorMsg}</Alert>}
      {successMsg && <Alert variant="success">{successMsg}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Panel: Filters */}
        <Card className="lg:col-span-3 h-fit">
          <CardHeader title="Filters" subtitle="8 Preliminary Catalog Elements" />
          <CardBody className="space-y-4">
            <div>
              <Label>Membrane Process</Label>
              <Select
                value={ashToggle ? "NF" : processFilter}
                disabled={ashToggle}
                onChange={(e) => setProcessFilter(e.target.value)}
              >
                <option value="ALL">All Processes (RO + NF)</option>
                <option value="NF">Nanofiltration (NF)</option>
                <option value="RO">Reverse Osmosis (RO)</option>
              </Select>
              {ashToggle && (
                <p className="text-[11px] text-amber-700 mt-1">
                  Locked to NF while ash/mineral properties are supplied.
                </p>
              )}
            </div>

            <div>
              <Label>Model Search</Label>
              <Input
                placeholder="e.g. TS40, AEM2"
                value={modelQuery}
                onChange={(e) => setModelQuery(e.target.value)}
              />
            </div>

            <div>
              <Label>Nominal Size</Label>
              <Select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)}>
                <option value="ALL">All Sizes</option>
                <option value="8038">8038 (8.0&quot; × 38&quot;)</option>
                <option value="3838">3838 (3.8&quot; × 38&quot;)</option>
              </Select>
            </div>

            <div>
              <Label>Effective Area</Label>
              <Select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
                <option value="ALL">All Areas (4.9–33 m²)</option>
                <option value="SMALL">3838 Scale (4.9 – 6.5 m²)</option>
                <option value="LARGE">8038 Scale (26.9 – 33 m²)</option>
              </Select>
            </div>

            {mode === "browse" && (
              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ashToggle}
                    onChange={(e) => setAshToggle(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-teal-600"
                  />
                  <span>
                    Simulate Ash/Mineral Design Rule (Restricts catalog to NF only)
                  </span>
                </label>
              </div>
            )}

            <Button variant="outline" size="sm" className="w-full" onClick={openCompare}>
              <GitCompare className="w-3.5 h-3.5" />
              Compare ({compareIds.length >= 2 ? compareIds.length : "Top 3"})
            </Button>
          </CardBody>
        </Card>

        {/* Main Panel: Membrane Cards */}
        <div className="lg:col-span-5 space-y-3">
          {loading ? (
            <Card>
              <CardBody className="text-xs text-slate-500 py-8 text-center">
                Loading membrane database...
              </CardBody>
            </Card>
          ) : membranes.length === 0 ? (
            <Card>
              <CardBody className="text-xs text-slate-500 py-8 text-center">
                No membranes match your current filters.
              </CardBody>
            </Card>
          ) : (
            membranes.map((m) => {
              const isSelected = selectedMembraneId === m.id;
              const isActive = activeMembrane?.id === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => setActiveMembrane(m)}
                  className={cn(
                    "rounded-xl border bg-white p-4 cursor-pointer transition-all",
                    isActive
                      ? "border-teal-600 ring-2 ring-teal-600/20 shadow-sm"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-bold text-slate-400">
                          ID #{m.id}
                        </span>
                        <Badge
                          className={
                            m.process_type === "NF"
                              ? "bg-teal-50 text-teal-700 border-teal-200"
                              : "bg-sky-50 text-sky-700 border-sky-200"
                          }
                        >
                          {m.process_type}
                        </Badge>
                        {isSelected && (
                          <Badge className="bg-slate-900 text-white border-slate-900">
                            <CheckCircle2 className="w-3 h-3" /> Selected
                          </Badge>
                        )}
                      </div>
                      <h4 className="text-base font-bold text-slate-900 mt-1">{m.model}</h4>
                      <p className="text-xs text-slate-500">{m.manufacturer}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-slate-900 tabular-nums">
                        {m.membrane_area} m²
                      </div>
                      <div className="text-[11px] text-slate-500">Size {m.nominal_size}</div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <Badge
                      className={
                        m.verification_status === "Manufacturer Verified"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-800 border-amber-200"
                      }
                    >
                      {m.verification_status}
                    </Badge>
                    <label
                      className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={compareIds.includes(m.id)}
                        onChange={() => toggleCompare(m.id)}
                        className="rounded border-slate-300 text-teal-600"
                      />
                      Compare
                    </label>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Panel: Selected Membrane Properties */}
        <Card className="lg:col-span-4 h-fit lg:sticky lg:top-24">
          <CardHeader
            title={activeMembrane ? `${activeMembrane.model} (ID #${activeMembrane.id})` : "Membrane Properties"}
            subtitle={activeMembrane?.full_model_number || "Select a membrane card to inspect properties"}
          />
          <CardBody className="space-y-4">
            {activeMembrane ? (
              <>
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Verification Audit</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed">
                      {activeMembrane.notes || "Confirm specifications against manufacturer datasheet."}
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 border rounded-lg border-slate-200 overflow-hidden text-xs">
                  {activeMembrane.properties.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-3 py-2 bg-white">
                      <div>
                        <span className="font-medium text-slate-800 block">{p.property_name}</span>
                        <span className="text-[10px] text-slate-400">
                          {p.verification_status}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "font-mono font-semibold",
                          p.property_value ? "text-slate-900" : "text-slate-400 italic"
                        )}
                      >
                        {p.property_value ? `${p.property_value} ${p.property_unit || ""}` : "Unknown"}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  {onSelectMembrane && (
                    <Button
                      variant="teal"
                      onClick={() => onSelectMembrane(activeMembrane)}
                    >
                      <Layers className="w-4 h-4" /> Select Membrane for Design
                    </Button>
                  )}
                  {onContinueToSizing && (
                    <Button variant="primary" onClick={onContinueToSizing}>
                      Continue to Sizing →
                    </Button>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDatasheetModal(activeMembrane)}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Datasheet / Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={openCompare}>
                      <GitCompare className="w-3.5 h-3.5" /> Compare
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-500 text-center py-6">
                <Database className="w-6 h-6 mx-auto text-slate-400 mb-2" />
                Select a membrane element from the center panel.
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Side-by-side Comparison Modal */}
      <Modal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="Side-by-Side Membrane Comparison"
        maxWidth="max-w-4xl"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="p-2.5 font-semibold text-slate-600">Specification</th>
                {compareItems.map((m) => (
                  <th key={m.id} className="p-2.5 font-bold text-slate-900">
                    #{m.id} {m.model} ({m.process_type})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="p-2.5 font-medium text-slate-600">Effective Area</td>
                {compareItems.map((m) => (
                  <td key={m.id} className="p-2.5 font-mono font-semibold">{m.membrane_area} m²</td>
                ))}
              </tr>
              <tr>
                <td className="p-2.5 font-medium text-slate-600">Nominal Size</td>
                {compareItems.map((m) => (
                  <td key={m.id} className="p-2.5">{m.nominal_size}</td>
                ))}
              </tr>
              <tr>
                <td className="p-2.5 font-medium text-slate-600">Verification Status</td>
                {compareItems.map((m) => (
                  <td key={m.id} className="p-2.5">{m.verification_status}</td>
                ))}
              </tr>
              <tr>
                <td className="p-2.5 font-medium text-slate-600">Max Operating Pressure</td>
                {compareItems.map((m) => (
                  <td key={m.id} className="p-2.5 font-mono">
                    {m.max_pressure !== null ? `${m.max_pressure} bar` : "Unknown"}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-2.5 font-medium text-slate-600">Max Operating Temp</td>
                {compareItems.map((m) => (
                  <td key={m.id} className="p-2.5 font-mono">
                    {m.max_temperature !== null ? `${m.max_temperature} °C` : "Unknown"}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-2.5 font-medium text-slate-600">Operating pH Range</td>
                {compareItems.map((m) => (
                  <td key={m.id} className="p-2.5 font-mono">
                    {m.operating_ph_min !== null && m.operating_ph_max !== null
                      ? `${m.operating_ph_min}–${m.operating_ph_max}`
                      : "Unknown"}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-2.5 font-medium text-slate-600">Salt / Mineral Rejection</td>
                {compareItems.map((m) => (
                  <td key={m.id} className="p-2.5 font-mono">
                    {m.salt_rejection || m.mineral_rejection || "Unknown"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Datasheet & Property Verification Edit Modal */}
      <Modal
        open={datasheetOpen}
        onClose={() => setDatasheetOpen(false)}
        title={`Datasheet & Verified Properties — #${activeMembrane?.id} ${activeMembrane?.model}`}
      >
        <form onSubmit={handleSaveDatasheet} className="space-y-4">
          <Alert variant="info">
            Leave unverified limits blank (`Unknown`). COW PRO never invents missing manufacturer parameters.
          </Alert>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Manufacturer</Label>
              <Input value={editManufacturer} onChange={(e) => setEditManufacturer(e.target.value)} />
            </div>
            <div>
              <Label>Full Model Designation</Label>
              <Input value={editFullModel} onChange={(e) => setEditFullModel(e.target.value)} />
            </div>
            <div>
              <Label>Verification Status</Label>
              <Select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as VerificationStatus)}
              >
                <option value="User Supplied">User Supplied</option>
                <option value="Manufacturer Verified">Manufacturer Verified</option>
                <option value="Experimentally Measured">Experimentally Measured</option>
                <option value="Estimated">Estimated</option>
                <option value="Unknown">Unknown</option>
              </Select>
            </div>
            <div>
              <Label>Max Operating Pressure (bar)</Label>
              <Input type="number" step="0.1" value={editMaxPressure} onChange={(e) => setEditMaxPressure(e.target.value)} placeholder="Unknown" />
            </div>
            <div>
              <Label>Max Operating Temp (°C)</Label>
              <Input type="number" step="0.1" value={editMaxTemp} onChange={(e) => setEditMaxTemp(e.target.value)} placeholder="Unknown" />
            </div>
            <div>
              <Label>Max Pressure Drop (bar)</Label>
              <Input type="number" step="0.1" value={editMaxDp} onChange={(e) => setEditMaxDp(e.target.value)} placeholder="Unknown" />
            </div>
            <div>
              <Label>Operating pH Min</Label>
              <Input type="number" step="0.1" value={editPhMin} onChange={(e) => setEditPhMin(e.target.value)} placeholder="Unknown" />
            </div>
            <div>
              <Label>Operating pH Max</Label>
              <Input type="number" step="0.1" value={editPhMax} onChange={(e) => setEditPhMax(e.target.value)} placeholder="Unknown" />
            </div>
            <div>
              <Label>Max Feed Flow (L/h)</Label>
              <Input type="number" step="1" value={editMaxFlow} onChange={(e) => setEditMaxFlow(e.target.value)} placeholder="Unknown" />
            </div>
            <div>
              <Label>Salt Rejection (%)</Label>
              <Input value={editSaltRej} onChange={(e) => setEditSaltRej(e.target.value)} placeholder="Unknown" />
            </div>
            <div>
              <Label>Mineral Rejection (%)</Label>
              <Input value={editMinRej} onChange={(e) => setEditMinRej(e.target.value)} placeholder="Unknown" />
            </div>
          </div>
          <div>
            <Label>Datasheet Reference Notes</Label>
            <textarea
              rows={2}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDatasheetOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="teal">
              <ExternalLink className="w-3.5 h-3.5" /> Save Verification Record
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
