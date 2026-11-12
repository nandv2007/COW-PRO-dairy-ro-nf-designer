"""Module 1 Stage 1: Milk Composition Calculations & Ash-Based Membrane Rule."""

from typing import Dict
from .types import (
    CompositionInput,
    CompositionResult,
    ProcessType,
    ValueSource,
)


ASH_RULE_EXPLANATION = (
    "COW PRO Version 1 Rule: When ash or mineral properties are explicitly supplied for "
    "ash/mineral separation design, membrane selection is restricted to Nanofiltration (NF) "
    "membranes. This is a COW PRO Version 1 application rule, not a universal limitation of "
    "Reverse Osmosis (RO) technology."
)

NO_ASH_RULE_EXPLANATION = (
    "No ash/mineral separation properties supplied; both Reverse Osmosis (RO) and "
    "Nanofiltration (NF) membranes are eligible according to the selected project process."
)


def calculate_total_solids(fat_percentage: float, snf_percentage: float) -> float:
    """Calculate Total Solids (% w/w) from Fat (% w/w) and SNF (% w/w).

    Formula A: Total Solids Percentage = SNF Percentage + Fat Percentage
    """
    if fat_percentage < 0:
        raise ValueError("Fat percentage must be nonnegative (% w/w).")
    if snf_percentage < 0:
        raise ValueError("SNF percentage must be nonnegative (% w/w).")
    total_solids = fat_percentage + snf_percentage
    if total_solids > 100.0 + 1e-9:
        raise ValueError("Total Solids percentage cannot exceed 100% w/w.")
    return min(total_solids, 100.0) if total_solids > 100.0 else total_solids


def calculate_snf(fat_percentage: float, total_solids_percentage: float) -> float:
    """Calculate SNF (% w/w) from Total Solids (% w/w) and Fat (% w/w).

    Formula B: SNF Percentage = Total Solids Percentage - Fat Percentage
    """
    if fat_percentage < 0:
        raise ValueError("Fat percentage must be nonnegative (% w/w).")
    if total_solids_percentage < 0 or total_solids_percentage > 100.0:
        raise ValueError("Total Solids percentage must be between 0% and 100% w/w.")
    if total_solids_percentage < fat_percentage:
        raise ValueError("Total Solids percentage must be at least equal to Fat percentage.")
    return total_solids_percentage - fat_percentage


def evaluate_composition(data: CompositionInput) -> CompositionResult:
    """Validate milk composition, compute SNF or Total Solids, and apply the Ash->NF rule.

    Preserves full internal precision and never fabricates missing protein, lactose, or ash values.
    """
    if data.fat_percentage < 0 or data.fat_percentage > 100.0:
        raise ValueError("Fat percentage must be between 0% and 100% w/w.")

    sources: Dict[str, str] = {k: v.value for k, v in data.value_sources.items()}
    sources.setdefault("fat_percentage", ValueSource.USER_SUPPLIED.value)

    if data.input_mode == "SNF":
        if data.snf_percentage is None:
            raise ValueError("SNF percentage is required when SNF mode is selected.")
        snf = data.snf_percentage
        total_solids = calculate_total_solids(data.fat_percentage, snf)
        sources["snf_percentage"] = sources.get("snf_percentage", ValueSource.USER_SUPPLIED.value)
        sources["total_solids_percentage"] = ValueSource.CALCULATED.value
    elif data.input_mode == "Total Solids":
        if data.total_solids_percentage is None:
            raise ValueError("Total Solids percentage is required when Total Solids mode is selected.")
        total_solids = data.total_solids_percentage
        snf = calculate_snf(data.fat_percentage, total_solids)
        sources["total_solids_percentage"] = sources.get(
            "total_solids_percentage", ValueSource.USER_SUPPLIED.value
        )
        sources["snf_percentage"] = ValueSource.CALCULATED.value
    else:
        raise ValueError(f"Unsupported input_mode: {data.input_mode}")

    # Validate optional SNF sub-components without inventing defaults
    optional_components = {
        "protein_percentage": data.protein_percentage,
        "lactose_percentage": data.lactose_percentage,
        "ash_percentage": data.ash_percentage,
        "other_solids_percentage": data.other_solids_percentage,
    }
    supplied_snf_sum = 0.0
    any_snf_subcomponent = False
    for name, val in optional_components.items():
        if val is not None:
            if val < 0 or val > 100.0:
                raise ValueError(f"{name} must be between 0% and 100% w/w.")
            supplied_snf_sum += val
            any_snf_subcomponent = True
            sources.setdefault(name, ValueSource.USER_SUPPLIED.value)

    if any_snf_subcomponent and supplied_snf_sum > snf + 1e-6:
        raise ValueError(
            f"Sum of supplied SNF sub-components ({supplied_snf_sum:.4f}%) exceeds SNF ({snf:.4f}%)."
        )

    for mineral_name, conc in data.individual_minerals.items():
        if conc < 0:
            raise ValueError(f"Mineral concentration for '{mineral_name}' must be nonnegative.")

    warnings = []
    if total_solids <= 0:
        warnings.append("Total solids is 0%; concentration factor calculations require positive initial solids.")

    ash_supplied = (
        data.ash_design_supplied
        or data.ash_percentage is not None
        or len(data.individual_minerals) > 0
    )

    if ash_supplied:
        allowed_processes = [ProcessType.NF]
        explanation = ASH_RULE_EXPLANATION
        warnings.append(ASH_RULE_EXPLANATION)
    else:
        allowed_processes = [ProcessType.RO, ProcessType.NF]
        explanation = NO_ASH_RULE_EXPLANATION

    water_percentage = 100.0 - total_solids

    return CompositionResult(
        milk_type=data.milk_type,
        fat_percentage=data.fat_percentage,
        snf_percentage=snf,
        total_solids_percentage=total_solids,
        water_percentage=water_percentage,
        protein_percentage=data.protein_percentage,
        lactose_percentage=data.lactose_percentage,
        ash_percentage=data.ash_percentage,
        other_solids_percentage=data.other_solids_percentage,
        individual_minerals=dict(data.individual_minerals),
        ash_restriction_active=ash_supplied,
        allowed_processes=allowed_processes,
        ash_rule_explanation=explanation,
        composition_basis=data.composition_basis,
        value_sources=sources,
        warnings=warnings,
    )
