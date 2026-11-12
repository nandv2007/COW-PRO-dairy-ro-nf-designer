"use client";

import React from "react";

export function MembraneSchematicArt() {
  return (
    <div className="relative h-full w-full flex flex-col justify-between bg-slate-950 text-slate-100 p-8 lg:p-12 overflow-hidden">
      {/* Subtle scientific grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(to right, #334155 1px, transparent 1px), linear-gradient(to bottom, #334155 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-teal-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-sky-500/15 blur-3xl" />

      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-300">
          <span className="h-2 w-2 rounded-full bg-teal-400" />
          Dairy Membrane Process Engineering • RO &amp; NF
        </div>
        <h2 className="mt-5 text-2xl lg:text-3xl font-semibold tracking-tight text-white">
          Precision Concentration &amp; Multi-Loop Sizing
        </h2>
        <p className="mt-2.5 text-sm text-slate-300 max-w-md leading-relaxed">
          Configure feed composition, calculate permeate removal, select single or two-loop
          architectures, size spiral-wound elements, and audit engineering validations.
        </p>
      </div>

      {/* Technical Vector Process Schematic */}
      <div className="relative z-10 my-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur-xs shadow-2xl">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-3">
          <span>PROCESS SCHEMATIC // TWO-LOOP SEQUENTIAL TRAIN</span>
          <span className="text-teal-400">1.6 &lt; CF &lt; 3.0</span>
        </div>

        <svg viewBox="0 0 600 230" className="w-full h-auto" role="img" aria-label="Two-loop membrane process schematic">
          {/* Feed Tank */}
          <rect x="14" y="55" width="76" height="62" rx="8" fill="#0F172A" stroke="#38BDF8" strokeWidth="2" />
          <text x="52" y="83" textAnchor="middle" fill="#E2E8F0" fontSize="11" fontWeight="600">Feed Milk</text>
          <text x="52" y="99" textAnchor="middle" fill="#38BDF8" fontSize="10" fontFamily="monospace">Q_feed</text>

          {/* Feed Pump */}
          <line x1="90" y1="86" x2="128" y2="86" stroke="#38BDF8" strokeWidth="2" />
          <circle cx="146" cy="86" r="18" fill="#0F172A" stroke="#0D9488" strokeWidth="2" />
          <polygon points="141,78 156,86 141,94" fill="#0D9488" />
          <text x="146" y="118" textAnchor="middle" fill="#94A3B8" fontSize="10">Feed Pump</text>

          {/* Loop 1 Module */}
          <line x1="164" y1="86" x2="205" y2="86" stroke="#38BDF8" strokeWidth="2" />
          <rect x="205" y="48" width="130" height="76" rx="10" fill="#134E4A" fillOpacity="0.35" stroke="#14B8A6" strokeWidth="2" />
          <line x1="205" y1="74" x2="335" y2="98" stroke="#14B8A6" strokeWidth="1.5" strokeDasharray="4 3" />
          <text x="270" y="68" textAnchor="middle" fill="#F8FAFC" fontSize="11.5" fontWeight="600">Loop 1 Membrane</text>
          <text x="270" y="113" textAnchor="middle" fill="#5EEAD4" fontSize="10" fontFamily="monospace">2/3 Permeate</text>

          {/* Loop 1 Permeate */}
          <line x1="270" y1="124" x2="270" y2="180" stroke="#14B8A6" strokeWidth="2" />
          <polygon points="265,176 275,176 270,185" fill="#14B8A6" />
          <text x="270" y="201" textAnchor="middle" fill="#5EEAD4" fontSize="10.5" fontFamily="monospace">P1 = 2/3 ΔV</text>

          {/* Loop 1 -> Loop 2 */}
          <line x1="335" y1="86" x2="380" y2="86" stroke="#38BDF8" strokeWidth="2" />
          <polygon points="376,81 376,91 385,86" fill="#38BDF8" />

          {/* Loop 2 Module */}
          <rect x="385" y="48" width="130" height="76" rx="10" fill="#0C4A6E" fillOpacity="0.35" stroke="#38BDF8" strokeWidth="2" />
          <line x1="385" y1="74" x2="515" y2="98" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="4 3" />
          <text x="450" y="68" textAnchor="middle" fill="#F8FAFC" fontSize="11.5" fontWeight="600">Loop 2 Membrane</text>
          <text x="450" y="113" textAnchor="middle" fill="#7DD3FC" fontSize="10" fontFamily="monospace">1/3 Permeate</text>

          {/* Loop 2 Permeate */}
          <line x1="450" y1="124" x2="450" y2="180" stroke="#14B8A6" strokeWidth="2" />
          <polygon points="445,176 455,176 450,185" fill="#14B8A6" />
          <text x="450" y="201" textAnchor="middle" fill="#5EEAD4" fontSize="10.5" fontFamily="monospace">P2 = 1/3 ΔV</text>

          {/* Final Retentate */}
          <line x1="515" y1="86" x2="552" y2="86" stroke="#F8FAFC" strokeWidth="2" />
          <polygon points="548,81 548,91 557,86" fill="#F8FAFC" />
          <text x="562" y="81" textAnchor="start" fill="#F8FAFC" fontSize="10.5" fontWeight="600">Final</text>
          <text x="562" y="95" textAnchor="start" fill="#38BDF8" fontSize="10" fontFamily="monospace">Retentate</text>
        </svg>

        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-800 pt-3 text-xs">
          <div>
            <p className="text-slate-400">Mass Balance</p>
            <p className="font-mono text-slate-200 mt-0.5">Q_f = Q_r + Q_p</p>
          </div>
          <div>
            <p className="text-slate-400">Initial Catalog</p>
            <p className="font-mono text-teal-300 mt-0.5">8 RO / NF Elements</p>
          </div>
          <div>
            <p className="text-slate-400">Validation</p>
            <p className="font-mono text-sky-300 mt-0.5">5-Category Audit</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-between text-xs text-slate-400">
        <span>COW PRO Engineering Platform v1.0</span>
        <span>Python FastAPI + Next.js + PostgreSQL/Supabase</span>
      </div>
    </div>
  );
}
