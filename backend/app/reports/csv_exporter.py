"""CSV Engineering Export Generator (Section 24)."""

import csv
import io
from typing import Any, Dict


def generate_engineering_csv(project: Dict[str, Any], design: Dict[str, Any]) -> str:
    """Serialize project metadata, calculated balances, loop sizing, and validation checks to CSV."""
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["COW PRO Engineering Design Export", "Version 1.0"])
    writer.writerow(["Project Code", project.get("project_code")])
    writer.writerow(["Project Name", project.get("project_name")])
    writer.writerow(["Process Type", project.get("process_type")])
    writer.writerow(["Milk Type", project.get("milk_type")])
    writer.writerow(["Design Engineer", project.get("design_engineer") or ""])
    writer.writerow(["Project Status", project.get("status")])
    writer.writerow([])

    writer.writerow(["Section", "Parameter", "Value", "Unit", "Notes / Source"])
    comp = design.get("composition", {})
    feed = design.get("feed", {})
    conc = design.get("concentration", {})
    loops = design.get("loops", {})
    validation = design.get("validation", {})

    writer.writerow(["Composition", "Fat Percentage", f"{comp.get('fat_percentage', 0):.4f}", "% w/w", comp.get("value_sources", {}).get("fat_percentage", "")])
    writer.writerow(["Composition", "SNF Percentage", f"{comp.get('snf_percentage', 0):.4f}", "% w/w", comp.get("value_sources", {}).get("snf_percentage", "")])
    writer.writerow(["Composition", "Total Solids Percentage", f"{comp.get('total_solids_percentage', 0):.4f}", "% w/w", comp.get("value_sources", {}).get("total_solids_percentage", "")])
    writer.writerow(["Feed", "Total Feed Flow", f"{feed.get('feed_flow_lh', 0):.4f}", "L/h", feed.get("formula_used", "")])
    writer.writerow(["Feed", "Feed Temperature", f"{feed.get('temperature_c', 0):.2f}", "°C", ""])
    writer.writerow(["Concentration", "Concentration Basis", conc.get("target_basis"), "-", ""])
    writer.writerow(["Concentration", "Initial Concentration", f"{conc.get('initial_percentage', 0):.4f}", "% w/w", ""])
    writer.writerow(["Concentration", "Target Concentration", f"{conc.get('target_percentage', 0):.4f}", "% w/w", ""])
    writer.writerow(["Concentration", "Concentration Factor", f"{conc.get('concentration_factor', 0):.6f}", "-", "Preliminary volumetric ratio"])
    writer.writerow(["Concentration", "Total Permeate Removal", f"{conc.get('total_permeate_removal_lh', 0):.4f}", "L/h", ""])
    writer.writerow(["Concentration", "Final Retentate Flow", f"{conc.get('final_retentate_flow_lh', 0):.4f}", "L/h", ""])
    writer.writerow(["Configuration", "Loop Configuration", loops.get("configuration_label"), "-", loops.get("loop_selection_rule", "")])
    writer.writerow(["Totals", "Total Membranes", design.get("total_membranes", 0), "elements", ""])
    writer.writerow(["Totals", "Total Installed Area", f"{design.get('total_installed_area_m2', 0):.4f}", "m²", ""])
    writer.writerow(["Totals", "Total Housings", design.get("total_housings", 0), "housings", ""])
    writer.writerow([])

    writer.writerow(["Loop", "Membrane Model", "Area/Element (m²)", "Design Flux (LMH)", "Feed Flow (L/h)", "Permeate Flow (L/h)", "Retentate Flow (L/h)", "Membrane Count", "Installed Area (m²)", "Housing Count", "Spare Positions"])
    sizing_map = {s["loop_number"]: s for s in design.get("loop_sizings", [])}
    for loop_num in (1, 2):
        active = loops.get(f"loop{loop_num}_active", False)
        if not active:
            writer.writerow([f"Loop {loop_num}", "Inactive", 0, 0, 0, 0, 0, 0, 0, 0, 0])
            continue
        s = sizing_map.get(loop_num, {})
        writer.writerow([
            f"Loop {loop_num}",
            s.get("membrane_model", ""),
            s.get("membrane_area_m2", ""),
            s.get("design_flux_lmh", ""),
            f"{loops.get(f'loop{loop_num}_feed_flow_lh', 0):.4f}",
            f"{loops.get(f'loop{loop_num}_permeate_flow_lh', 0):.4f}",
            f"{loops.get(f'loop{loop_num}_retentate_flow_lh', 0):.4f}",
            s.get("membrane_count", 0),
            f"{s.get('installed_area_m2', 0):.4f}",
            s.get("housing_count", 0),
            s.get("spare_positions", 0),
        ])

    writer.writerow([])
    writer.writerow(["Validation Overall Status", validation.get("overall_status")])
    writer.writerow(["Category", "Check", "Status", "Message"])
    for chk in validation.get("checks", []):
        writer.writerow([chk["category"], chk["title"], chk["status"], chk["message"]])

    return output.getvalue()
