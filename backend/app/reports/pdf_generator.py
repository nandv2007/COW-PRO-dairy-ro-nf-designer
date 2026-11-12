"""Server-side 12-Section Engineering PDF Report Generator (Section 24)."""

import datetime as dt
import io
from pathlib import Path
from typing import Any, Dict, List

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from reportlab.graphics.shapes import Drawing, Line, Polygon, Rect, String
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


NAVY = colors.HexColor("#0F172A")
SLATE = colors.HexColor("#334155")
TEAL = colors.HexColor("#0D9488")
BLUE = colors.HexColor("#0284C7")
LIGHT_BG = colors.HexColor("#F8FAFC")
BORDER = colors.HexColor("#CBD5E1")
AMBER_BG = colors.HexColor("#FEF3C7")
AMBER_TXT = colors.HexColor("#92400E")


def _make_pfd_drawing(design: Dict[str, Any], process_type: str) -> Drawing:
    """Create a clean vector Process Flow Diagram (Section 8 of PDF Report)."""
    d = Drawing(480, 175)
    loops = design.get("loops", {})
    sizings = {s["loop_number"]: s for s in design.get("loop_sizings", [])}
    two_loops = bool(loops.get("loop2_active"))

    # Background frame
    d.add(Rect(0, 0, 480, 175, fillColor=colors.HexColor("#F8FAFC"), strokeColor=BORDER, strokeWidth=0.8, rx=6, ry=6))
    d.add(String(12, 160, f"Preliminary Sequential Process Flow ({process_type}) — Net Flow Schematic", fontName="Helvetica-Bold", fontSize=8.5, fillColor=NAVY))

    def draw_box(x: float, y: float, w: float, h: float, title: str, subtitle: str, fill=colors.white, stroke=NAVY):
        d.add(Rect(x, y, w, h, fillColor=fill, strokeColor=stroke, strokeWidth=1.1, rx=4, ry=4))
        d.add(String(x + w / 2, y + h - 14, title, textAnchor="middle", fontName="Helvetica-Bold", fontSize=7.5, fillColor=NAVY))
        d.add(String(x + w / 2, y + 8, subtitle, textAnchor="middle", fontName="Helvetica", fontSize=6.8, fillColor=SLATE))

    def draw_arrow(x1: float, y1: float, x2: float, y2: float, color=BLUE):
        d.add(Line(x1, y1, x2, y2, strokeColor=color, strokeWidth=1.3))
        if abs(x2 - x1) >= abs(y2 - y1):
            sign = 1 if x2 > x1 else -1
            d.add(Polygon([x2, y2, x2 - 5 * sign, y2 + 3, x2 - 5 * sign, y2 - 3], fillColor=color, strokeColor=color))
        else:
            sign = 1 if y2 > y1 else -1
            d.add(Polygon([x2, y2, x2 - 3, y2 - 5 * sign, x2 + 3, y2 - 5 * sign], fillColor=color, strokeColor=color))

    feed_flow = loops.get("loop1_feed_flow_lh", 0.0)
    final_ret = loops.get("final_retentate_flow_lh", 0.0)

    draw_box(14, 78, 74, 42, "Feed Tank", f"{feed_flow:.1f} L/h", fill=colors.HexColor("#EFF6FF"), stroke=BLUE)
    draw_arrow(88, 99, 108, 99)
    draw_box(108, 82, 64, 34, "Feed Pump", "Net Feed", fill=colors.white, stroke=SLATE)
    draw_arrow(172, 99, 196, 99)

    s1 = sizings.get(1, {})
    l1_label = f"{s1.get('membrane_count', 0)}x {s1.get('membrane_model', 'Membrane')}"
    l1_sub = f"{s1.get('installed_area_m2', 0):.1f} m2 | {s1.get('design_flux_lmh', 0):.1f} LMH"
    draw_box(196, 72, 102, 54, "Loop 1 System", l1_label, fill=colors.HexColor("#F0FDFA"), stroke=TEAL)
    d.add(String(247, 79, l1_sub, textAnchor="middle", fontName="Helvetica", fontSize=6.2, fillColor=TEAL))

    # Loop 1 Permeate
    l1_perm = loops.get("loop1_permeate_flow_lh", 0.0)
    draw_arrow(247, 72, 247, 36, color=TEAL)
    d.add(String(247, 25, f"Loop 1 Permeate: {l1_perm:.2f} L/h", textAnchor="middle", fontName="Helvetica-Bold", fontSize=6.8, fillColor=TEAL))

    if two_loops:
        l1_ret = loops.get("loop1_retentate_flow_lh", 0.0)
        draw_arrow(298, 99, 326, 99)
        d.add(String(312, 105, f"{l1_ret:.1f}", textAnchor="middle", fontName="Helvetica", fontSize=6.2, fillColor=SLATE))

        s2 = sizings.get(2, {})
        l2_label = f"{s2.get('membrane_count', 0)}x {s2.get('membrane_model', 'Membrane')}"
        l2_sub = f"{s2.get('installed_area_m2', 0):.1f} m2 | {s2.get('design_flux_lmh', 0):.1f} LMH"
        draw_box(326, 72, 98, 54, "Loop 2 System", l2_label, fill=colors.HexColor("#F0FDFA"), stroke=TEAL)
        d.add(String(375, 79, l2_sub, textAnchor="middle", fontName="Helvetica", fontSize=6.2, fillColor=TEAL))

        l2_perm = loops.get("loop2_permeate_flow_lh", 0.0)
        draw_arrow(375, 72, 375, 36, color=TEAL)
        d.add(String(375, 25, f"Loop 2 Permeate: {l2_perm:.2f} L/h", textAnchor="middle", fontName="Helvetica-Bold", fontSize=6.8, fillColor=TEAL))

        draw_arrow(424, 99, 444, 99)
        d.add(String(458, 105, "Final", textAnchor="middle", fontName="Helvetica-Bold", fontSize=6.8, fillColor=NAVY))
        d.add(String(458, 95, "Retentate", textAnchor="middle", fontName="Helvetica-Bold", fontSize=6.8, fillColor=NAVY))
        d.add(String(458, 84, f"{final_ret:.1f} L/h", textAnchor="middle", fontName="Helvetica", fontSize=6.5, fillColor=SLATE))
    else:
        draw_arrow(298, 99, 344, 99)
        draw_box(344, 78, 96, 42, "Final Retentate", f"{final_ret:.2f} L/h", fill=colors.HexColor("#EFF6FF"), stroke=NAVY)

    d.add(String(12, 8, "Note: Sequential preliminary schematic; internal loop recirculation and plant piping require detailed hydraulic validation.", fontName="Helvetica-Oblique", fontSize=6.3, fillColor=SLATE))
    return d


def _make_charts_image(design: Dict[str, Any]) -> io.BytesIO:
    """Render calculated engineering charts via Matplotlib for Section 9."""
    fig, axes = plt.subplots(1, 2, figsize=(8.2, 3.1), dpi=180)
    fig.patch.set_facecolor("white")

    feed_flow = design.get("feed", {}).get("feed_flow_lh", 0.0)
    conc = design.get("concentration", {})
    perm_flow = conc.get("total_permeate_removal_lh", 0.0)
    ret_flow = conc.get("final_retentate_flow_lh", 0.0)

    # Chart 1: Overall Mass Flow Balance
    ax1 = axes[0]
    bars = ax1.bar(
        ["Feed Flow", "Permeate\nRemoval", "Final\nRetentate"],
        [feed_flow, perm_flow, ret_flow],
        color=["#0F172A", "#0D9488", "#0284C7"],
        width=0.55,
    )
    ax1.set_title("System Flow Balance (L/h)", fontsize=9.5, fontweight="bold", color="#0F172A")
    ax1.set_ylabel("Flow Rate (L/h)", fontsize=8)
    ax1.grid(axis="y", linestyle="--", alpha=0.4)
    ax1.set_axisbelow(True)
    for bar in bars:
        h = bar.get_height()
        ax1.text(bar.get_x() + bar.get_width() / 2, h + max(feed_flow * 0.02, 1), f"{h:.1f}", ha="center", va="bottom", fontsize=7.5)
    ax1.set_ylim(0, max(feed_flow * 1.18, 10))

    # Chart 2: Loop Permeate & Installed Area
    ax2 = axes[1]
    loops = design.get("loops", {})
    sizings = {s["loop_number"]: s for s in design.get("loop_sizings", [])}
    l1_p = loops.get("loop1_permeate_flow_lh", 0.0)
    l2_p = loops.get("loop2_permeate_flow_lh", 0.0)
    l1_a = sizings.get(1, {}).get("installed_area_m2", 0.0)
    l2_a = sizings.get(2, {}).get("installed_area_m2", 0.0)

    x = [0, 1]
    w = 0.34
    b1 = ax2.bar([i - w / 2 for i in x], [l1_p, l2_p], width=w, color="#0D9488", label="Permeate (L/h)")
    ax2_t = ax2.twinx()
    b2 = ax2_t.bar([i + w / 2 for i in x], [l1_a, l2_a], width=w, color="#0284C7", label="Installed Area (m²)")
    ax2.set_xticks(x)
    ax2.set_xticklabels(["Loop 1", "Loop 2"])
    ax2.set_title("Loop Permeate & Installed Area", fontsize=9.5, fontweight="bold", color="#0F172A")
    ax2.set_ylabel("Permeate (L/h)", fontsize=8, color="#0D9488")
    ax2_t.set_ylabel("Area (m²)", fontsize=8, color="#0284C7")
    ax2.grid(axis="y", linestyle="--", alpha=0.4)
    ax2.set_axisbelow(True)
    for bar in b1:
        h = bar.get_height()
        ax2.text(bar.get_x() + bar.get_width() / 2, h + max(l1_p, l2_p, 1) * 0.02, f"{h:.1f}", ha="center", va="bottom", fontsize=7)
    for bar in b2:
        h = bar.get_height()
        ax2_t.text(bar.get_x() + bar.get_width() / 2, h + max(l1_a, l2_a, 1) * 0.02, f"{h:.1f}", ha="center", va="bottom", fontsize=7)
    ax2.set_ylim(0, max(l1_p, l2_p, 1) * 1.2)
    ax2_t.set_ylim(0, max(l1_a, l2_a, 1) * 1.2)

    plt.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=180)
    plt.close(fig)
    buf.seek(0)
    return buf


def _styled_table(data: List[List[str]], col_widths: List[float] | None = None) -> Table:
    tbl = Table(data, colWidths=col_widths, repeatRows=1)
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 8.5),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 1), (-1, -1), 8.2),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
                ("GRID", (0, 0), (-1, -1), 0.45, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return tbl


def generate_engineering_pdf(
    output_path: Path,
    project: Dict[str, Any],
    design: Dict[str, Any],
    membranes_used: Dict[int, Dict[str, Any]],
) -> Path:
    """Build the full 12-section COW PRO engineering report PDF."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"COW PRO Engineering Report — {project.get('project_name')}",
        author=project.get("design_engineer") or "COW PRO",
    )

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("CowH1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=14, textColor=NAVY, spaceBefore=10, spaceAfter=6)
    h2 = ParagraphStyle("CowH2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=11, textColor=TEAL, spaceBefore=8, spaceAfter=4)
    body = ParagraphStyle("CowBody", parent=styles["Normal"], fontName="Helvetica", fontSize=9.2, leading=13, textColor=SLATE, spaceAfter=4)
    small = ParagraphStyle("CowSmall", parent=styles["Normal"], fontName="Helvetica", fontSize=8, leading=11, textColor=SLATE)
    cover_title = ParagraphStyle("CoverTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=24, textColor=NAVY, alignment=0, spaceAfter=8)

    story: List[Any] = []
    now_str = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    validation = design.get("validation", {})
    comp = design.get("composition", {})
    feed = design.get("feed", {})
    conc = design.get("concentration", {})
    loops = design.get("loops", {})
    sizings = design.get("loop_sizings", [])
    hyd_loops = design.get("hydraulic_loops", [])
    feed_pump = design.get("feed_pump", {})

    # COVER PAGE
    story.append(Spacer(1, 18 * mm))
    story.append(
        Table(
            [["COW PRO", "Dairy Membrane Processing Design & Simulation Platform • v1.0"]],
            colWidths=[32 * mm, 140 * mm],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (0, 0), NAVY),
                    ("TEXTCOLOR", (0, 0), (0, 0), colors.white),
                    ("FONTNAME", (0, 0), (0, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (0, 0), 12),
                    ("ALIGN", (0, 0), (0, 0), "CENTER"),
                    ("BACKGROUND", (1, 0), (1, 0), LIGHT_BG),
                    ("TEXTCOLOR", (1, 0), (1, 0), TEAL),
                    ("FONTNAME", (1, 0), (1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (1, 0), (1, 0), 9.5),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            ),
        )
    )
    story.append(Spacer(1, 16 * mm))
    story.append(Paragraph("PRELIMINARY MEMBRANE PROCESS ENGINEERING REPORT", ParagraphStyle("Eyebrow", fontName="Helvetica-Bold", fontSize=9.5, textColor=BLUE, spaceAfter=6)))
    story.append(Paragraph(project.get("project_name", "Untitled Project"), cover_title))
    story.append(Paragraph(project.get("description") or "Dairy Reverse Osmosis / Nanofiltration Concentration Design", body))
    story.append(Spacer(1, 12 * mm))

    cover_meta = [
        ["Project Identifier", str(project.get("project_code", project.get("id")))],
        ["Membrane Process", f"{project.get('process_type')} ({'Nanofiltration' if project.get('process_type') == 'NF' else 'Reverse Osmosis'})"],
        ["Milk Type", str(project.get("milk_type"))],
        ["Customer / Organization", str(project.get("customer_organization") or "Not Specified")],
        ["Project Location", str(project.get("project_location") or "Not Specified")],
        ["Design Engineer", str(project.get("design_engineer") or "Not Specified")],
        ["Project Status", str(project.get("status"))],
        ["Validation Outcome", str(validation.get("overall_status", "Not Evaluated"))],
        ["Report Generated", now_str],
        ["COW PRO Engine Version", "1.0 (Preliminary Sizing Mode)"],
    ]
    story.append(_styled_table([["Project Metadata", "Value"]] + cover_meta, col_widths=[55 * mm, 117 * mm]))
    story.append(Spacer(1, 14 * mm))

    if not validation.get("can_mark_validated"):
        notice = Table(
            [[Paragraph(
                "<b>ENGINEERING VALIDATION NOTICE:</b> This design contains preliminary mathematical calculations, "
                "unverified datasheet properties, or unevaluated hydraulic checks. Do not treat as a fully validated plant design until Section 10 items are resolved.",
                ParagraphStyle("Warn", fontName="Helvetica", fontSize=8.5, leading=12, textColor=AMBER_TXT),
            )]],
            colWidths=[172 * mm],
            style=TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), AMBER_BG),
                ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#F59E0B")),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]),
        )
        story.append(notice)
    story.append(PageBreak())

    # SECTION 1 — Project Overview
    story.append(Paragraph("Section 1 — Project Overview", h1))
    story.append(Paragraph(f"<b>Project Name:</b> {project.get('project_name')} ({project.get('project_code')})", body))
    story.append(Paragraph(f"<b>Process Selection:</b> {project.get('process_type')} | <b>Milk Type:</b> {project.get('milk_type')}", body))
    story.append(Paragraph(f"<b>Design Basis:</b> Preliminary dairy membrane concentration sizing under COW PRO Version 1 methodology ({conc.get('target_basis', 'SNF')} basis).", body))
    if project.get("description"):
        story.append(Paragraph(f"<b>Scope / Description:</b> {project.get('description')}", body))

    # SECTION 2 — Feed Analysis
    story.append(Paragraph("Section 2 — Feed Analysis", h1))
    comp_rows = [
        ["Parameter", "Value", "Unit / Basis", "Source / Notes"],
        ["Fat Percentage", f"{comp.get('fat_percentage', 0):.3f}", "% w/w", comp.get("value_sources", {}).get("fat_percentage", "user_supplied")],
        ["SNF Percentage", f"{comp.get('snf_percentage', 0):.3f}", "% w/w", comp.get("value_sources", {}).get("snf_percentage", "-")],
        ["Total Solids", f"{comp.get('total_solids_percentage', 0):.3f}", "% w/w", comp.get("value_sources", {}).get("total_solids_percentage", "-")],
        ["Protein", f"{comp['protein_percentage']:.3f}" if comp.get("protein_percentage") is not None else "Not Supplied", "% w/w", "Not fabricated if omitted"],
        ["Lactose", f"{comp['lactose_percentage']:.3f}" if comp.get("lactose_percentage") is not None else "Not Supplied", "% w/w", "Not fabricated if omitted"],
        ["Ash", f"{comp['ash_percentage']:.3f}" if comp.get("ash_percentage") is not None else "Not Supplied", "% w/w", "Ash->NF Rule Active" if comp.get("ash_restriction_active") else "Not supplied"],
        ["Feed Flow Rate", f"{feed.get('feed_flow_lh', 0):.2f} ({feed.get('feed_flow_m3h', 0):.4f} m³/h)", "L/h", feed.get("formula_used", "-")],
        ["Feed Temperature", f"{feed.get('temperature_c', 0):.1f}", "°C", "User supplied"],
        ["Feed pH / Density", f"{feed['ph']:.2f}" if feed.get("ph") is not None else "Not Supplied", f"Density: {feed['density_kg_per_l']:.3f} kg/L" if feed.get("density_kg_per_l") else "Density Not Supplied", "Optional physical properties"],
    ]
    story.append(_styled_table(comp_rows, col_widths=[40 * mm, 45 * mm, 35 * mm, 52 * mm]))

    # SECTION 3 — Concentration Design
    story.append(Paragraph("Section 3 — Concentration Design", h1))
    conc_rows = [
        ["Parameter", "Calculated Value", "Units", "Basis / Notes"],
        ["Concentration Basis", str(conc.get("target_basis")), "-", "Selected target basis"],
        ["Initial Concentration", f"{conc.get('initial_percentage', 0):.3f}", "% w/w", f"Initial {conc.get('target_basis')}"],
        ["Target Concentration", f"{conc.get('target_percentage', 0):.3f}", "% w/w", f"Target {conc.get('target_basis')}"],
        ["Concentration Factor (CF)", f"{conc.get('concentration_factor', 0):.4f}", "dimensionless", "Target / Initial (Preliminary volumetric assumption)"],
        ["Total Permeate Removal", f"{conc.get('total_permeate_removal_lh', 0):.2f}", "L/h", "Feed Flow × (1 − 1 / CF)"],
        ["Final Retentate Flow", f"{conc.get('final_retentate_flow_lh', 0):.2f}", "L/h", "Feed Flow − Total Permeate Removal"],
    ]
    if conc.get("total_permeate_volume_l") is not None:
        conc_rows.append(["Total Permeate Volume", f"{conc['total_permeate_volume_l']:.2f}", "L", f"Over {feed.get('operating_time_hours')} h"])
    story.append(_styled_table(conc_rows, col_widths=[45 * mm, 35 * mm, 28 * mm, 64 * mm]))

    # SECTION 4 — Loop Configuration
    story.append(Paragraph("Section 4 — Loop Configuration & Flow Balances", h1))
    story.append(Paragraph(f"<b>Configuration:</b> {loops.get('configuration_label')} — {loops.get('loop_selection_rule')}", body))
    loop_bal_rows = [
        ["Stream / Loop", "Active", "Feed Flow (L/h)", "Permeate Removal (L/h)", "Retentate Flow (L/h)"],
        ["Loop 1", "Yes" if loops.get("loop1_active") else "No", f"{loops.get('loop1_feed_flow_lh', 0):.2f}", f"{loops.get('loop1_permeate_flow_lh', 0):.2f}", f"{loops.get('loop1_retentate_flow_lh', 0):.2f}"],
        ["Loop 2", "Yes" if loops.get("loop2_active") else "Inactive", f"{loops.get('loop2_feed_flow_lh', 0):.2f}", f"{loops.get('loop2_permeate_flow_lh', 0):.2f}", f"{loops.get('loop2_retentate_flow_lh', 0):.2f}"],
    ]
    story.append(_styled_table(loop_bal_rows, col_widths=[36 * mm, 24 * mm, 36 * mm, 40 * mm, 36 * mm]))

    # SECTION 5 — Membrane Selection
    story.append(Paragraph("Section 5 — Membrane Selection", h1))
    mem_rows = [["ID", "Manufacturer", "Model", "Process", "Area (m²)", "Verification Status", "Notes"]]
    for mid, m in membranes_used.items():
        mem_rows.append([
            str(mid),
            str(m.get("manufacturer", "-")),
            str(m.get("full_model_number") or m.get("model")),
            str(m.get("process_type")),
            f"{float(m.get('membrane_area', 0)):.1f}",
            str(m.get("verification_status", "Unknown")),
            str(m.get("notes") or "-"),
        ])
    story.append(_styled_table(mem_rows, col_widths=[10 * mm, 32 * mm, 30 * mm, 14 * mm, 16 * mm, 26 * mm, 44 * mm]))

    # SECTION 6 — Membrane Sizing
    story.append(Paragraph("Section 6 — Membrane Sizing", h1))
    sz_rows = [["Loop", "Membrane Model", "Area/Elem (m²)", "Design Flux (LMH)", "Flux Source", "Exact Count", "Membranes Req.", "Installed Area (m²)"]]
    for s in sizings:
        sz_rows.append([
            f"Loop {s['loop_number']}",
            s["membrane_model"],
            f"{s['membrane_area_m2']:.1f}",
            f"{s['design_flux_lmh']:.2f}",
            s["flux_source"],
            f"{s['exact_membranes_required']:.3f}",
            str(s["membrane_count"]),
            f"{s['installed_area_m2']:.2f}",
        ])
    sz_rows.append([
        "Total", "-", "-", "-", "-", "-",
        str(design.get("total_membranes", 0)),
        f"{design.get('total_installed_area_m2', 0):.2f}",
    ])
    story.append(_styled_table(sz_rows, col_widths=[14 * mm, 28 * mm, 20 * mm, 24 * mm, 24 * mm, 18 * mm, 20 * mm, 24 * mm]))

    # SECTION 7 — Equipment Arrangement & Hydraulics
    story.append(Paragraph("Section 7 — Equipment Arrangement & Hydraulics", h1))
    eq_rows = [["Loop", "Housings", "Elem/Housing", "Spare Pos.", "Recirc. Flow (L/h)", "ΔP (bar)", "TMP (bar)", "Pump Shaft (kW)"]]
    hyd_map = {h["loop_number"]: h for h in hyd_loops}
    for s in sizings:
        h = hyd_map.get(s["loop_number"], {})
        eq_rows.append([
            f"Loop {s['loop_number']}",
            str(s["housing_count"]),
            str(s["elements_per_housing"]),
            str(s["spare_positions"]),
            f"{h['recirculation_flow_lh']:.1f}" if h.get("recirculation_flow_lh") is not None else "Not Supplied",
            f"{h['pressure_drop_bar']:.2f}" if h.get("pressure_drop_bar") is not None else "Not Eval.",
            f"{h['transmembrane_pressure_bar']:.2f}" if h.get("transmembrane_pressure_bar") is not None else "Not Eval.",
            f"{h['recirculation_shaft_power_kw']:.3f}" if h.get("recirculation_shaft_power_kw") is not None else "Not Eval.",
        ])
    story.append(_styled_table(eq_rows, col_widths=[14 * mm, 18 * mm, 22 * mm, 18 * mm, 28 * mm, 22 * mm, 22 * mm, 28 * mm]))
    fp_text = (
        f"Feed Pump Shaft Power: {feed_pump['shaft_power_kw']:.3f} kW (Hydraulic: {feed_pump['hydraulic_power_kw']:.3f} kW)."
        if feed_pump.get("evaluated")
        else "Feed Pump Sizing: Not evaluated (supply differential pressure & pump efficiency)."
    )
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(fp_text, body))

    # SECTION 8 — Process Flow Diagram
    story.append(Paragraph("Section 8 — Process Flow Diagram", h1))
    story.append(_make_pfd_drawing(design, project.get("process_type", "NF")))

    # SECTION 9 — Results & Charts
    story.append(Paragraph("Section 9 — Summary Results & Performance Charts", h1))
    chart_buf = _make_charts_image(design)
    story.append(Image(chart_buf, width=172 * mm, height=65 * mm))

    # SECTION 10 — Validation
    story.append(Paragraph("Section 10 — Engineering Validation & Unverified Properties", h1))
    story.append(Paragraph(
        f"<b>Overall Validation Status:</b> {validation.get('overall_status')} "
        f"(Passed: {validation.get('passed_count', 0)}, Warnings: {validation.get('warning_count', 0)}, "
        f"Failed: {validation.get('failed_count', 0)}, Not Evaluated: {validation.get('not_evaluated_count', 0)})",
        body,
    ))
    val_rows = [["Category", "Check", "Status", "Finding"]]
    for chk in validation.get("checks", []):
        val_rows.append([chk["category"], chk["title"], chk["status"], chk["message"]])
    story.append(_styled_table(val_rows, col_widths=[34 * mm, 40 * mm, 24 * mm, 74 * mm]))

    # SECTION 11 — Calculation Methodology
    story.append(Paragraph("Section 11 — Calculation Methodology & Formulas", h1))
    formulas = [
        "1. Total Solids (%) = Fat (%) + SNF (%)  |  SNF (%) = Total Solids (%) − Fat (%)",
        "2. Feed Flow (L/h) = Direct Flow OR Processing Capacity (L) / Operating Time (h)",
        "3. Concentration Factor (CF) = Target Concentration (%) / Initial Concentration (%)",
        "4. Total Permeate Removal (L/h) = Feed Flow × (1 − 1 / CF)",
        "5. Loop Selection: 1 <= CF <= 1.6 -> Single Loop (100% Loop 1); 1.6 < CF < 3 -> Two Loops (2/3 Loop 1, 1/3 Loop 2)",
        "6. Membranes Required = RoundUp[ Permeate Flow / (Membrane Area × Design Flux) ]",
        "7. Installed Area (m²) = Membrane Count × Membrane Area  |  Housings = RoundUp[ Membranes / Elements per Housing ]",
        "8. Hydraulic Power (W) = Q (m³/s) × ΔP (Pa)  |  Shaft Power (W) = Hydraulic Power / Pump Efficiency",
    ]
    for f_line in formulas:
        story.append(Paragraph(f_line, small))

    # SECTION 12 — Conclusion
    story.append(Paragraph("Section 12 — Conclusion & Next Engineering Actions", h1))
    story.append(Paragraph(
        f"This COW PRO preliminary design sizes a {loops.get('configuration_label', 'membrane')} {project.get('process_type')} system "
        f"for {feed.get('feed_flow_lh', 0):.1f} L/h at CF = {conc.get('concentration_factor', 0):.3f}, requiring "
        f"{design.get('total_membranes', 0)} membrane element(s) ({design.get('total_installed_area_m2', 0):.2f} m² installed area) "
        f"to remove {conc.get('total_permeate_removal_lh', 0):.2f} L/h permeate and yield {conc.get('final_retentate_flow_lh', 0):.2f} L/h retentate.",
        body,
    ))
    story.append(Paragraph(
        "<b>Required before Plant Construction / Final Validation:</b> Confirm manufacturer datasheet limits (model suffix, "
        "effective area, max pressure, max temperature, pH, salt/mineral rejection), establish loop recirculation crossflow rates, "
        "verify housing pressure drop, and perform Level 2 osmotic & concentration-polarization simulation.",
        body,
    ))

    doc.build(story)
    return output_path
