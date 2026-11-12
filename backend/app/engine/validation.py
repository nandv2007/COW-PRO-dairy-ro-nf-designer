"""Module 2: Five-Category Engineering Validation Engine (Section 23)."""

from typing import Any, Dict, List, Optional
from .types import (
    CompositionResult,
    ConcentrationResult,
    FeedFlowResult,
    FeedPumpResult,
    HydraulicLoopResult,
    LoopAllocationResult,
    LoopSizingResult,
    ProcessType,
    ValidationCategory,
    ValidationCheck,
    ValidationCheckStatus,
    ValidationSummary,
    VerificationStatus,
)


def run_engineering_validation(
    process_type: ProcessType,
    composition: Optional[CompositionResult],
    feed: Optional[FeedFlowResult],
    concentration: Optional[ConcentrationResult],
    loops: Optional[LoopAllocationResult],
    loop_sizings: List[LoopSizingResult],
    membrane_records: Dict[int, Dict[str, Any]],
    hydraulic_loops: List[HydraulicLoopResult],
    feed_pump: Optional[FeedPumpResult],
    simulation_level: str = "Level 1",
) -> ValidationSummary:
    """Execute all 5 COW PRO engineering validation categories.

    Critical rule (Section 5 & Section 27):
        A project must NEVER be marked Validated simply because preliminary math succeeded.
        Unverified manufacturer membrane data, missing hydraulic inputs, or unresolved
        warnings prevent 'Validated' status.
    """
    checks: List[ValidationCheck] = []
    unverified_properties: List[str] = []
    limitations: List[str] = [
        "Preliminary sizing treats target/initial solids ratio as volumetric concentration factor.",
        "Loop selection (1 <= CF <= 1.6 single loop; 1.6 < CF < 3 two loops with 2/3 & 1/3 split) is a COW PRO v1 heuristic.",
    ]

    # 1. Composition Validation
    if composition is None:
        checks.append(
            ValidationCheck(
                id="comp-completeness",
                category=ValidationCategory.COMPOSITION,
                title="Milk composition completeness",
                status=ValidationCheckStatus.NOT_EVALUATED,
                message="Milk composition has not been submitted yet.",
            )
        )
    else:
        solids_sum = composition.fat_percentage + composition.snf_percentage
        solids_consistent = abs(solids_sum - composition.total_solids_percentage) <= 1e-6 and 0 <= composition.total_solids_percentage <= 100
        checks.append(
            ValidationCheck(
                id="comp-solids-consistency",
                category=ValidationCategory.COMPOSITION,
                title="Fat, SNF, and Total Solids mass balance",
                status=ValidationCheckStatus.PASSED if solids_consistent else ValidationCheckStatus.FAILED,
                message=(
                    f"Consistent on {composition.composition_basis}: Fat {composition.fat_percentage:.2f}% + "
                    f"SNF {composition.snf_percentage:.2f}% = Total Solids {composition.total_solids_percentage:.2f}%."
                    if solids_consistent
                    else "Fat + SNF does not match Total Solids within valid 0–100% bounds."
                ),
            )
        )
        missing_optional = [
            name
            for name, val in [
                ("Protein", composition.protein_percentage),
                ("Lactose", composition.lactose_percentage),
                ("Ash", composition.ash_percentage),
            ]
            if val is None
        ]
        if missing_optional:
            checks.append(
                ValidationCheck(
                    id="comp-optional-fractions",
                    category=ValidationCategory.COMPOSITION,
                    title="Detailed component breakdown",
                    status=ValidationCheckStatus.WARNING,
                    message=f"Optional component(s) not supplied: {', '.join(missing_optional)}.",
                    details="COW PRO does not fabricate unsupplied protein, lactose, or ash fractions; component-level simulation requires measured inputs.",
                )
            )
        else:
            checks.append(
                ValidationCheck(
                    id="comp-optional-fractions",
                    category=ValidationCategory.COMPOSITION,
                    title="Detailed component breakdown",
                    status=ValidationCheckStatus.PASSED,
                    message="Protein, lactose, and ash fractions are explicitly supplied.",
                )
            )

    # 2. Concentration Validation
    if concentration is None or loops is None:
        checks.append(
            ValidationCheck(
                id="conc-factor",
                category=ValidationCategory.CONCENTRATION,
                title="Concentration factor and loop range",
                status=ValidationCheckStatus.NOT_EVALUATED,
                message="Concentration design has not been calculated yet.",
            )
        )
    else:
        if concentration.concentration_factor < 1.0:
            cf_status = ValidationCheckStatus.FAILED
            cf_msg = f"Concentration Factor ({concentration.concentration_factor:.4f}) is below 1.0 (invalid)."
        elif concentration.out_of_automatic_range:
            cf_status = ValidationCheckStatus.WARNING
            cf_msg = (
                f"Concentration Factor ({concentration.concentration_factor:.4f}) >= 3.0 is outside "
                "the COW PRO v1 automatic design range."
            )
        elif concentration.is_no_concentration:
            cf_status = ValidationCheckStatus.WARNING
            cf_msg = "Concentration Factor equals 1.0: no membrane concentration required."
        else:
            cf_status = ValidationCheckStatus.PASSED
            cf_msg = (
                f"Concentration Factor = {concentration.concentration_factor:.4f} within valid range; "
                f"{loops.configuration_label} selected."
            )
        checks.append(
            ValidationCheck(
                id="conc-factor",
                category=ValidationCategory.CONCENTRATION,
                title="Concentration factor & automatic loop selection",
                status=cf_status,
                message=cf_msg,
                details=loops.loop_selection_rule,
            )
        )

    # 3. Membrane Validation
    if composition is not None and composition.ash_restriction_active and process_type != ProcessType.NF:
        checks.append(
            ValidationCheck(
                id="mem-ash-rule",
                category=ValidationCategory.MEMBRANE,
                title="COW PRO v1 Ash/Mineral NF Restriction",
                status=ValidationCheckStatus.FAILED,
                message="Ash/mineral properties are supplied while project process is set to RO. COW PRO v1 restricts ash/mineral separation design to NF membranes.",
                details=composition.ash_rule_explanation,
            )
        )
    elif composition is not None and composition.ash_restriction_active:
        checks.append(
            ValidationCheck(
                id="mem-ash-rule",
                category=ValidationCategory.MEMBRANE,
                title="COW PRO v1 Ash/Mineral NF Restriction",
                status=ValidationCheckStatus.PASSED,
                message="NF process aligns with COW PRO v1 ash/mineral separation rule.",
                details=composition.ash_rule_explanation,
            )
        )

    if not loop_sizings:
        checks.append(
            ValidationCheck(
                id="mem-sizing",
                category=ValidationCategory.MEMBRANE,
                title="Membrane selection and sizing",
                status=ValidationCheckStatus.NOT_EVALUATED,
                message="No active loop membrane sizing has been configured yet.",
            )
        )
    else:
        for sizing in loop_sizings:
            mem = membrane_records.get(sizing.membrane_id, {})
            mem_process = mem.get("process_type")
            if mem_process and mem_process != process_type.value:
                checks.append(
                    ValidationCheck(
                        id=f"mem-process-loop{sizing.loop_number}",
                        category=ValidationCategory.MEMBRANE,
                        title=f"Loop {sizing.loop_number} membrane process compatibility",
                        status=ValidationCheckStatus.FAILED,
                        message=f"Selected membrane {sizing.membrane_model} ({mem_process}) does not match project process ({process_type.value}).",
                    )
                )
            else:
                checks.append(
                    ValidationCheck(
                        id=f"mem-process-loop{sizing.loop_number}",
                        category=ValidationCategory.MEMBRANE,
                        title=f"Loop {sizing.loop_number} membrane sizing & process match",
                        status=ValidationCheckStatus.PASSED,
                        message=(
                            f"Loop {sizing.loop_number}: {sizing.membrane_count} × {sizing.membrane_model} "
                            f"({sizing.membrane_area_m2} m² each = {sizing.installed_area_m2:.2f} m² installed) at "
                            f"{sizing.design_flux_lmh:g} LMH ({sizing.flux_source})."
                        ),
                    )
                )

            ver_status = mem.get("verification_status", VerificationStatus.UNKNOWN.value)
            if ver_status != VerificationStatus.MANUFACTURER_VERIFIED.value:
                unverified_properties.append(
                    f"Loop {sizing.loop_number} membrane '{sizing.membrane_model}' (ID {sizing.membrane_id}) verification status is '{ver_status}'."
                )
                checks.append(
                    ValidationCheck(
                        id=f"mem-datasheet-loop{sizing.loop_number}",
                        category=ValidationCategory.MEMBRANE,
                        title=f"Loop {sizing.loop_number} manufacturer datasheet verification",
                        status=ValidationCheckStatus.WARNING,
                        message=f"Membrane '{sizing.membrane_model}' specifications are '{ver_status}', not Manufacturer Verified.",
                        details=mem.get("notes"),
                    )
                )

            # Temperature limit check
            max_temp = mem.get("max_temperature")
            if feed is not None:
                if max_temp is None:
                    unverified_properties.append(f"Loop {sizing.loop_number} membrane maximum operating temperature is Unknown.")
                    checks.append(
                        ValidationCheck(
                            id=f"mem-temp-loop{sizing.loop_number}",
                            category=ValidationCategory.MEMBRANE,
                            title=f"Loop {sizing.loop_number} operating temperature limit",
                            status=ValidationCheckStatus.NOT_EVALUATED,
                            message=f"Feed temperature is {feed.temperature_c:g} °C, but membrane maximum temperature is Unknown in catalog.",
                        )
                    )
                elif feed.temperature_c > max_temp:
                    checks.append(
                        ValidationCheck(
                            id=f"mem-temp-loop{sizing.loop_number}",
                            category=ValidationCategory.MEMBRANE,
                            title=f"Loop {sizing.loop_number} operating temperature limit",
                            status=ValidationCheckStatus.FAILED,
                            message=f"Feed temperature ({feed.temperature_c:g} °C) exceeds membrane max temperature ({max_temp:g} °C).",
                        )
                    )
                else:
                    checks.append(
                        ValidationCheck(
                            id=f"mem-temp-loop{sizing.loop_number}",
                            category=ValidationCategory.MEMBRANE,
                            title=f"Loop {sizing.loop_number} operating temperature limit",
                            status=ValidationCheckStatus.PASSED,
                            message=f"Feed temperature ({feed.temperature_c:g} °C) is within membrane limit (<= {max_temp:g} °C).",
                        )
                    )

            # pH limit check
            ph_min = mem.get("operating_ph_min")
            ph_max = mem.get("operating_ph_max")
            if feed is not None and feed.ph is not None:
                if ph_min is None or ph_max is None:
                    unverified_properties.append(f"Loop {sizing.loop_number} membrane operating pH range is Unknown.")
                    checks.append(
                        ValidationCheck(
                            id=f"mem-ph-loop{sizing.loop_number}",
                            category=ValidationCategory.MEMBRANE,
                            title=f"Loop {sizing.loop_number} operating pH compatibility",
                            status=ValidationCheckStatus.NOT_EVALUATED,
                            message=f"Feed pH is {feed.ph:g}, but membrane operating pH limits are Unknown.",
                        )
                    )
                elif not (ph_min <= feed.ph <= ph_max):
                    checks.append(
                        ValidationCheck(
                            id=f"mem-ph-loop{sizing.loop_number}",
                            category=ValidationCategory.MEMBRANE,
                            title=f"Loop {sizing.loop_number} operating pH compatibility",
                            status=ValidationCheckStatus.FAILED,
                            message=f"Feed pH ({feed.ph:g}) outside membrane operating range ({ph_min:g}–{ph_max:g}).",
                        )
                    )
                else:
                    checks.append(
                        ValidationCheck(
                            id=f"mem-ph-loop{sizing.loop_number}",
                            category=ValidationCategory.MEMBRANE,
                            title=f"Loop {sizing.loop_number} operating pH compatibility",
                            status=ValidationCheckStatus.PASSED,
                            message=f"Feed pH ({feed.ph:g}) within membrane range ({ph_min:g}–{ph_max:g}).",
                        )
                    )

            # Housing spare position check
            if not sizing.is_divisible and sizing.membrane_count > 0:
                checks.append(
                    ValidationCheck(
                        id=f"mem-housing-fit-loop{sizing.loop_number}",
                        category=ValidationCategory.HYDRAULIC,
                        title=f"Loop {sizing.loop_number} housing arrangement divisibility",
                        status=ValidationCheckStatus.WARNING,
                        message=(
                            f"{sizing.membrane_count} membranes in {sizing.housing_count} housing(s) "
                            f"({sizing.elements_per_housing}/housing) leaves {sizing.spare_positions} spare position(s)."
                        ),
                        details="Spare positions require dummy elements or an alternate vessel configuration; physical fit alone does not guarantee hydraulic acceptability.",
                    )
                )

    # 4. Hydraulic Validation
    if feed is None:
        checks.append(
            ValidationCheck(
                id="hyd-feed-flow",
                category=ValidationCategory.HYDRAULIC,
                title="Positive feed flow rate",
                status=ValidationCheckStatus.NOT_EVALUATED,
                message="Feed flow has not been entered.",
            )
        )
    else:
        checks.append(
            ValidationCheck(
                id="hyd-feed-flow",
                category=ValidationCategory.HYDRAULIC,
                title="Positive feed flow rate",
                status=ValidationCheckStatus.PASSED if feed.feed_flow_lh > 0 else ValidationCheckStatus.FAILED,
                message=f"Feed flow is {feed.feed_flow_lh:.2f} L/h ({feed.feed_flow_m3h:.4f} m³/h).",
            )
        )

    if not hydraulic_loops:
        checks.append(
            ValidationCheck(
                id="hyd-loop-pressures",
                category=ValidationCategory.HYDRAULIC,
                title="Operating pressures, pressure drops & recirculation",
                status=ValidationCheckStatus.NOT_EVALUATED,
                message="Hydraulic operating pressures and recirculation flows have not been entered.",
                details="Supply inlet pressure, retentate pressure, permeate pressure, and recirculation flow to validate hydraulics and pump sizing.",
            )
        )
    else:
        for hl in hydraulic_loops:
            if hl.pressure_drop_bar is None or hl.recirculation_flow_lh is None:
                checks.append(
                    ValidationCheck(
                        id=f"hyd-loop{hl.loop_number}",
                        category=ValidationCategory.HYDRAULIC,
                        title=f"Loop {hl.loop_number} hydraulic operating checks",
                        status=ValidationCheckStatus.NOT_EVALUATED,
                        message=f"Loop {hl.loop_number} pressure profile or recirculation flow is incomplete.",
                        details=" ".join(hl.hydraulic_status_notes),
                    )
                )
            elif any("exceeds" in note.lower() for note in hl.hydraulic_status_notes):
                checks.append(
                    ValidationCheck(
                        id=f"hyd-loop{hl.loop_number}",
                        category=ValidationCategory.HYDRAULIC,
                        title=f"Loop {hl.loop_number} hydraulic operating limits",
                        status=ValidationCheckStatus.FAILED,
                        message="; ".join(hl.hydraulic_status_notes),
                    )
                )
            else:
                checks.append(
                    ValidationCheck(
                        id=f"hyd-loop{hl.loop_number}",
                        category=ValidationCategory.HYDRAULIC,
                        title=f"Loop {hl.loop_number} hydraulic operating checks",
                        status=ValidationCheckStatus.PASSED,
                        message=(
                            f"Loop {hl.loop_number}: ΔP={hl.pressure_drop_bar:.2f} bar, "
                            f"TMP={hl.transmembrane_pressure_bar:.2f} bar, "
                            f"Membrane Feed={hl.membrane_feed_flow_lh:.1f} L/h."
                            if hl.transmembrane_pressure_bar is not None
                            else f"Loop {hl.loop_number}: ΔP={hl.pressure_drop_bar:.2f} bar, Membrane Feed={hl.membrane_feed_flow_lh:.1f} L/h."
                        ),
                    )
                )

    if feed_pump is not None and not feed_pump.evaluated:
        checks.append(
            ValidationCheck(
                id="hyd-feed-pump",
                category=ValidationCategory.HYDRAULIC,
                title="Feed pump sizing",
                status=ValidationCheckStatus.NOT_EVALUATED,
                message="Feed pump differential pressure and efficiency have not been verified.",
            )
        )

    # 5. Mass Balance Validation
    if loops is not None and feed is not None:
        external_ok = loops.overall_mass_balance_error_lh <= 1e-6
        split_ok = loops.loop_permeate_sum_error_lh <= 1e-6
        checks.append(
            ValidationCheck(
                id="mb-external",
                category=ValidationCategory.MASS_BALANCE,
                title="Overall volumetric flow balance",
                status=ValidationCheckStatus.PASSED if (external_ok and split_ok) else ValidationCheckStatus.FAILED,
                message=(
                    f"Feed ({loops.loop1_feed_flow_lh:.2f} L/h) = Final Retentate ({loops.final_retentate_flow_lh:.2f} L/h) + "
                    f"Total Permeate ({loops.loop1_permeate_flow_lh + loops.loop2_permeate_flow_lh:.2f} L/h)."
                ),
            )
        )
        checks.append(
            ValidationCheck(
                id="mb-component",
                category=ValidationCategory.MASS_BALANCE,
                title="Component-level mass balance & rejection",
                status=ValidationCheckStatus.NOT_EVALUATED,
                message=(
                    f"Component-level mass balance not evaluated in {simulation_level} preliminary volumetric mode; "
                    "verified membrane rejection, osmotic pressure, and density curves are required."
                ),
            )
        )
    else:
        checks.append(
            ValidationCheck(
                id="mb-external",
                category=ValidationCategory.MASS_BALANCE,
                title="Overall volumetric flow balance",
                status=ValidationCheckStatus.NOT_EVALUATED,
                message="Mass balance requires completed feed and concentration inputs.",
            )
        )

    passed_count = sum(1 for c in checks if c.status == ValidationCheckStatus.PASSED)
    warning_count = sum(1 for c in checks if c.status == ValidationCheckStatus.WARNING)
    failed_count = sum(1 for c in checks if c.status == ValidationCheckStatus.FAILED)
    not_eval_count = sum(1 for c in checks if c.status == ValidationCheckStatus.NOT_EVALUATED)

    if failed_count > 0:
        overall = ValidationCheckStatus.FAILED
    elif not_eval_count > 0:
        overall = ValidationCheckStatus.NOT_EVALUATED
    elif warning_count > 0:
        overall = ValidationCheckStatus.WARNING
    else:
        overall = ValidationCheckStatus.PASSED

    can_mark_validated = (failed_count == 0 and not_eval_count == 0 and warning_count == 0)

    return ValidationSummary(
        overall_status=overall,
        can_mark_validated=can_mark_validated,
        passed_count=passed_count,
        warning_count=warning_count,
        failed_count=failed_count,
        not_evaluated_count=not_eval_count,
        checks=checks,
        unverified_properties=unverified_properties,
        engineering_limitations=limitations,
    )
