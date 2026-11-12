"use client";

import React, { useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { formatFlow, formatPressure } from "@/lib/utils";
import type { FullDesignOutput, PreferredUnits } from "@/types/cowpro";

interface LoopNodeData extends Record<string, unknown> {
  loopNumber: 1 | 2;
  membraneCount: number;
  membraneModel: string;
  membraneArea: number;
  installedArea: number;
  designFlux: number;
  feedFlowText: string;
  permeateFlowText: string;
  retentateFlowText: string;
  pressureText: string;
  recircText: string | null;
  onInspect: (loopNum: 1 | 2) => void;
}

function FeedTankNode({ data }: NodeProps<Node<{ label: string; flow: string; temp: string }>>) {
  return (
    <div className="rounded-xl border-2 border-sky-500 bg-sky-50 px-4 py-3 shadow-sm min-w-[140px] text-center">
      <div className="text-xs font-bold uppercase tracking-wide text-sky-900">{data.label}</div>
      <div className="text-sm font-mono font-bold text-slate-900 mt-1">{data.flow}</div>
      <div className="text-[11px] text-sky-700 mt-0.5">{data.temp}</div>
      <Handle type="source" position={Position.Right} className="!bg-sky-600" />
    </div>
  );
}

function PumpNode({ data }: NodeProps<Node<{ label: string; subtitle: string }>>) {
  return (
    <div className="rounded-full border-2 border-slate-700 bg-white px-4 py-2.5 shadow-sm text-center min-w-[115px]">
      <Handle type="target" position={Position.Left} className="!bg-slate-700" />
      <div className="text-xs font-bold text-slate-900">{data.label}</div>
      <div className="text-[10px] text-slate-500">{data.subtitle}</div>
      <Handle type="source" position={Position.Right} className="!bg-slate-700" />
    </div>
  );
}

function MembraneLoopNode({ data }: NodeProps<Node<LoopNodeData>>) {
  return (
    <div
      onClick={() => data.onInspect(data.loopNumber)}
      className="rounded-xl border-2 border-teal-600 bg-white px-4 py-3 shadow-md min-w-[225px] cursor-pointer hover:ring-4 hover:ring-teal-500/20 transition-all"
    >
      <Handle type="target" position={Position.Left} id="feed" className="!bg-sky-600" />
      <Handle type="target" position={Position.Top} id="recirc-in" className="!bg-indigo-600" />
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
        <span className="text-xs font-bold uppercase tracking-wide text-teal-800">
          Loop {data.loopNumber} System
        </span>
        <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-mono font-bold text-teal-700">
          {data.membraneCount}× {data.membraneModel}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <span className="text-slate-500">Area / Elem:</span>
        <span className="font-mono font-semibold text-right">{data.membraneArea} m²</span>
        <span className="text-slate-500">Installed:</span>
        <span className="font-mono font-semibold text-right">{data.installedArea.toFixed(1)} m²</span>
        <span className="text-slate-500">Design Flux:</span>
        <span className="font-mono font-semibold text-right">{data.designFlux} LMH</span>
        <span className="text-slate-500">Op. Pressure:</span>
        <span className="font-mono font-semibold text-right">{data.pressureText}</span>
        {data.recircText && (
          <>
            <span className="text-indigo-600">Recirculation:</span>
            <span className="font-mono font-semibold text-indigo-700 text-right">{data.recircText}</span>
          </>
        )}
      </div>
      <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-teal-700 font-medium text-center">
        Click module to inspect engineering details
      </div>
      <Handle type="source" position={Position.Right} id="retentate" className="!bg-slate-800" />
      <Handle type="source" position={Position.Bottom} id="permeate" className="!bg-teal-600" />
    </div>
  );
}

function TerminalNode({ data }: NodeProps<Node<{ label: string; flow: string; tone: "teal" | "navy" }>>) {
  const isTeal = data.tone === "teal";
  return (
    <div
      className={
        isTeal
          ? "rounded-xl border border-teal-300 bg-teal-50 px-3.5 py-2.5 text-center shadow-xs min-w-[140px]"
          : "rounded-xl border-2 border-slate-900 bg-slate-900 text-white px-4 py-3 text-center shadow-sm min-w-[150px]"
      }
    >
      <Handle type="target" position={Position.Top} id="top" className="!bg-teal-600" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-slate-900" />
      <div className={isTeal ? "text-[11px] font-bold text-teal-900" : "text-xs font-bold text-white"}>
        {data.label}
      </div>
      <div className={isTeal ? "text-xs font-mono font-bold text-teal-700 mt-0.5" : "text-sm font-mono font-bold text-teal-300 mt-1"}>
        {data.flow}
      </div>
    </div>
  );
}

const nodeTypes = {
  feedTank: FeedTankNode,
  pump: PumpNode,
  membraneLoop: MembraneLoopNode,
  terminal: TerminalNode,
};

export function ProcessFlowDiagram({
  design,
  units,
  onSelectLoop,
}: {
  design: FullDesignOutput;
  units: PreferredUnits;
  onSelectLoop: (loopNumber: 1 | 2) => void;
}) {
  const { nodes, edges } = useMemo(() => {
    const flowUnit = units.flow || "L/h";
    const pressUnit = units.pressure || "bar";
    const sizingMap = new Map(design.loop_sizings.map((s) => [s.loop_number, s]));
    const hydMap = new Map(design.hydraulic_loops.map((h) => [h.loop_number, h]));
    const s1 = sizingMap.get(1);
    const s2 = sizingMap.get(2);
    const h1 = hydMap.get(1);
    const h2 = hydMap.get(2);
    const twoLoops = design.loops.loop2_active;

    const builtNodes: Node[] = [
      {
        id: "feed-tank",
        type: "feedTank",
        position: { x: 20, y: 120 },
        data: {
          label: "Feed Tank",
          flow: formatFlow(design.feed.feed_flow_lh, flowUnit),
          temp: `${design.feed.temperature_c.toFixed(1)} °C · ${design.composition.total_solids_percentage.toFixed(1)}% TS`,
        },
      },
      {
        id: "feed-pump",
        type: "pump",
        position: { x: 210, y: 128 },
        data: {
          label: "Feed Pump",
          subtitle: design.feed_pump?.evaluated && design.feed_pump.shaft_power_kw
            ? `${design.feed_pump.shaft_power_kw.toFixed(2)} kW shaft`
            : "Net feed supply",
        },
      },
      {
        id: "loop-1",
        type: "membraneLoop",
        position: { x: 380, y: 80 },
        data: {
          loopNumber: 1,
          membraneCount: s1?.membrane_count ?? 0,
          membraneModel: s1?.membrane_model ?? "Unassigned",
          membraneArea: s1?.membrane_area_m2 ?? 0,
          installedArea: s1?.installed_area_m2 ?? 0,
          designFlux: s1?.design_flux_lmh ?? 0,
          feedFlowText: formatFlow(design.loops.loop1_feed_flow_lh, flowUnit),
          permeateFlowText: formatFlow(design.loops.loop1_permeate_flow_lh, flowUnit),
          retentateFlowText: formatFlow(design.loops.loop1_retentate_flow_lh, flowUnit),
          pressureText: h1?.inlet_pressure_bar !== null && h1?.inlet_pressure_bar !== undefined
            ? formatPressure(h1.inlet_pressure_bar, pressUnit)
            : "Pending",
          recircText: h1?.recirculation_flow_lh !== null && h1?.recirculation_flow_lh !== undefined
            ? formatFlow(h1.recirculation_flow_lh, flowUnit, 0)
            : null,
          onInspect: onSelectLoop,
        },
      },
      {
        id: "perm-1",
        type: "terminal",
        position: { x: 422, y: 310 },
        data: {
          label: "Loop 1 Permeate",
          flow: formatFlow(design.loops.loop1_permeate_flow_lh, flowUnit),
          tone: "teal",
        },
      },
    ];

    const builtEdges: Edge[] = [
      {
        id: "e-tank-pump",
        source: "feed-tank",
        target: "feed-pump",
        label: formatFlow(design.feed.feed_flow_lh, flowUnit, 0),
        markerEnd: { type: MarkerType.ArrowClosed, color: "#0284c7" },
        style: { stroke: "#0284c7", strokeWidth: 2 },
      },
      {
        id: "e-pump-l1",
        source: "feed-pump",
        target: "loop-1",
        targetHandle: "feed",
        label: formatFlow(design.loops.loop1_feed_flow_lh, flowUnit, 0),
        markerEnd: { type: MarkerType.ArrowClosed, color: "#0284c7" },
        style: { stroke: "#0284c7", strokeWidth: 2 },
      },
      {
        id: "e-l1-perm1",
        source: "loop-1",
        sourceHandle: "permeate",
        target: "perm-1",
        targetHandle: "top",
        label: formatFlow(design.loops.loop1_permeate_flow_lh, flowUnit),
        markerEnd: { type: MarkerType.ArrowClosed, color: "#0d9488" },
        style: { stroke: "#0d9488", strokeWidth: 2 },
      },
    ];

    if (h1?.recirculation_flow_lh && h1.recirculation_flow_lh > 0) {
      builtNodes.push({
        id: "recirc-1",
        type: "pump",
        position: { x: 435, y: -15 },
        data: {
          label: "Loop 1 Recirc.",
          subtitle: formatFlow(h1.recirculation_flow_lh, flowUnit, 0),
        },
      });
      builtEdges.push({
        id: "e-recirc-1",
        source: "recirc-1",
        target: "loop-1",
        targetHandle: "recirc-in",
        animated: true,
        label: "Internal crossflow",
        style: { stroke: "#4f46e5", strokeWidth: 1.8, strokeDasharray: "5 3" },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#4f46e5" },
      });
    }

    if (twoLoops) {
      builtNodes.push(
        {
          id: "loop-2",
          type: "membraneLoop",
          position: { x: 700, y: 80 },
          data: {
            loopNumber: 2,
            membraneCount: s2?.membrane_count ?? 0,
            membraneModel: s2?.membrane_model ?? "Unassigned",
            membraneArea: s2?.membrane_area_m2 ?? 0,
            installedArea: s2?.installed_area_m2 ?? 0,
            designFlux: s2?.design_flux_lmh ?? 0,
            feedFlowText: formatFlow(design.loops.loop2_feed_flow_lh, flowUnit),
            permeateFlowText: formatFlow(design.loops.loop2_permeate_flow_lh, flowUnit),
            retentateFlowText: formatFlow(design.loops.loop2_retentate_flow_lh, flowUnit),
            pressureText: h2?.inlet_pressure_bar !== null && h2?.inlet_pressure_bar !== undefined
              ? formatPressure(h2.inlet_pressure_bar, pressUnit)
              : "Pending",
            recircText: h2?.recirculation_flow_lh !== null && h2?.recirculation_flow_lh !== undefined
              ? formatFlow(h2.recirculation_flow_lh, flowUnit, 0)
              : null,
            onInspect: onSelectLoop,
          },
        },
        {
          id: "perm-2",
          type: "terminal",
          position: { x: 742, y: 310 },
          data: {
            label: "Loop 2 Permeate",
            flow: formatFlow(design.loops.loop2_permeate_flow_lh, flowUnit),
            tone: "teal",
          },
        },
        {
          id: "final-retentate",
          type: "terminal",
          position: { x: 1005, y: 120 },
          data: {
            label: "Final Retentate",
            flow: formatFlow(design.loops.final_retentate_flow_lh, flowUnit),
            tone: "navy",
          },
        }
      );

      builtEdges.push(
        {
          id: "e-l1-l2",
          source: "loop-1",
          sourceHandle: "retentate",
          target: "loop-2",
          targetHandle: "feed",
          label: formatFlow(design.loops.loop2_feed_flow_lh, flowUnit),
          markerEnd: { type: MarkerType.ArrowClosed, color: "#0f172a" },
          style: { stroke: "#0f172a", strokeWidth: 2 },
        },
        {
          id: "e-l2-perm2",
          source: "loop-2",
          sourceHandle: "permeate",
          target: "perm-2",
          targetHandle: "top",
          label: formatFlow(design.loops.loop2_permeate_flow_lh, flowUnit),
          markerEnd: { type: MarkerType.ArrowClosed, color: "#0d9488" },
          style: { stroke: "#0d9488", strokeWidth: 2 },
        },
        {
          id: "e-l2-ret",
          source: "loop-2",
          sourceHandle: "retentate",
          target: "final-retentate",
          targetHandle: "left",
          label: formatFlow(design.loops.final_retentate_flow_lh, flowUnit),
          markerEnd: { type: MarkerType.ArrowClosed, color: "#0f172a" },
          style: { stroke: "#0f172a", strokeWidth: 2.2 },
        }
      );

      if (h2?.recirculation_flow_lh && h2.recirculation_flow_lh > 0) {
        builtNodes.push({
          id: "recirc-2",
          type: "pump",
          position: { x: 755, y: -15 },
          data: {
            label: "Loop 2 Recirc.",
            subtitle: formatFlow(h2.recirculation_flow_lh, flowUnit, 0),
          },
        });
        builtEdges.push({
          id: "e-recirc-2",
          source: "recirc-2",
          target: "loop-2",
          targetHandle: "recirc-in",
          animated: true,
          label: "Internal crossflow",
          style: { stroke: "#4f46e5", strokeWidth: 1.8, strokeDasharray: "5 3" },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#4f46e5" },
        });
      }
    } else {
      builtNodes.push({
        id: "final-retentate",
        type: "terminal",
        position: { x: 700, y: 120 },
        data: {
          label: "Final Retentate",
          flow: formatFlow(design.loops.final_retentate_flow_lh, flowUnit),
          tone: "navy",
        },
      });
      builtEdges.push({
        id: "e-l1-ret",
        source: "loop-1",
        sourceHandle: "retentate",
        target: "final-retentate",
        targetHandle: "left",
        label: formatFlow(design.loops.final_retentate_flow_lh, flowUnit),
        markerEnd: { type: MarkerType.ArrowClosed, color: "#0f172a" },
        style: { stroke: "#0f172a", strokeWidth: 2.2 },
      });
    }

    return { nodes: builtNodes, edges: builtEdges };
  }, [design, units, onSelectLoop]);

  return (
    <div className="h-[320px] sm:h-[400px] lg:h-[460px] w-full rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.22 }}
      >
        <Background color="#cbd5e1" gap={20} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
