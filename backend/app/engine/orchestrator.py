"""Centralized Calculation Engine Orchestrator for COW PRO."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from .composition import evaluate_composition
from .concentration import evaluate_concentration
from .feed import calculate_feed_flow
from .hydraulics import evaluate_feed_pump, evaluate_loop_hydraulics
from .loops import select_and_balance_loops
from .sizing import size_loop_equipment
from .simulation import (
    Level1SimulationOutput,
    Level2ReadinessOutput,
    evaluate_level2_readiness,
    run_level1_simulation,
)
from .types import (
    CompositionInput,
    CompositionResult,
    ConcentrationInput,
    ConcentrationResult,
    FeedConditionsInput,
    FeedFlowResult,
    FeedPumpInput,
    FeedPumpResult,
    HydraulicLoopInput,
    HydraulicLoopResult,
    LoopAllocationResult,
    LoopSizingInput,
    LoopSizingResult,
    ProcessType,
    ValidationSummary,
    VerificationStatus,
)
from .validation import run_engineering_validation


class LoopConfigInput(BaseModel):
    """Per-loop user configuration for membrane, flux, housing, and hydraulics."""

    loop_number: int
    membrane_id: int
    design_flux_lmh: float
    flux_source: VerificationStatus = VerificationStatus.USER_SUPPLIED
    elements_per_housing: int = 1
    housing_type: Optional[str] = None
    housing_pressure_rating_bar: Optional[float] = None
    max_elements_per_housing: Optional[int] = None
    max_housing_feed_flow_lh: Optional[float] = None
    max_housing_pressure_drop_bar: Optional[float] = None
    recirculation_flow_lh: Optional[float] = None
    inlet_pressure_bar: Optional[float] = None
    retentate_pressure_bar: Optional[float] = None
    permeate_pressure_bar: Optional[float] = None
    pump_efficiency: Optional[float] = None


class FullDesignOutput(BaseModel):
    """Complete deterministic design, hydraulic, simulation, and validation output."""

    composition: CompositionResult
    feed: FeedFlowResult
    concentration: ConcentrationResult
    loops: LoopAllocationResult
    loop_sizings: List[LoopSizingResult] = Field(default_factory=list)
    total_membranes: int = 0
    total_installed_area_m2: float = 0.0
    total_housings: int = 0
    feed_pump: Optional[FeedPumpResult] = None
    hydraulic_loops: List[HydraulicLoopResult] = Field(default_factory=list)
    validation: ValidationSummary
    level1_simulation: Optional[Level1SimulationOutput] = None
    level2_readiness: Optional[Level2ReadinessOutput] = None


def run_full_design_pipeline(
    process_type: ProcessType,
    composition_input: CompositionInput,
    feed_input: FeedConditionsInput,
    target_basis: str,
    target_percentage: float,
    loop_configs: Dict[int, LoopConfigInput],
    membrane_records: Dict[int, Dict[str, Any]],
    feed_pump_diff_pressure_bar: Optional[float] = None,
    feed_pump_efficiency: Optional[float] = None,
) -> FullDesignOutput:
    """Run the entire centralized COW PRO calculation sequence deterministically."""
    comp_res = evaluate_composition(composition_input)
    feed_res = calculate_feed_flow(feed_input)

    conc_res = evaluate_concentration(
        ConcentrationInput(
            target_basis=target_basis,  # type: ignore[arg-type]
            initial_snf_percentage=comp_res.snf_percentage,
            initial_total_solids_percentage=comp_res.total_solids_percentage,
            target_percentage=target_percentage,
            feed_flow_lh=feed_res.feed_flow_lh,
            operating_time_hours=feed_res.operating_time_hours,
        )
    )

    loop_res = select_and_balance_loops(
        feed_flow_lh=feed_res.feed_flow_lh,
        concentration_factor=conc_res.concentration_factor,
        total_permeate_removal_lh=conc_res.total_permeate_removal_lh,
    )

    sizings: List[LoopSizingResult] = []
    hydraulic_loops: List[HydraulicLoopResult] = []

    active_loop_flows = [(1, loop_res.loop1_feed_flow_lh, loop_res.loop1_permeate_flow_lh)]
    if loop_res.loop2_active:
        active_loop_flows.append((2, loop_res.loop2_feed_flow_lh, loop_res.loop2_permeate_flow_lh))

    for loop_num, net_feed, perm_flow in active_loop_flows:
        cfg = loop_configs.get(loop_num)
        if cfg is None:
            continue
        mem = membrane_records.get(cfg.membrane_id)
        if mem is None:
            raise ValueError(f"Membrane ID {cfg.membrane_id} not found in membrane catalog.")

        sizing = size_loop_equipment(
            LoopSizingInput(
                loop_number=loop_num,
                permeate_flow_lh=perm_flow,
                membrane_id=cfg.membrane_id,
                membrane_model=mem["model"],
                membrane_area_m2=float(mem["membrane_area"]),
                nominal_size=mem.get("nominal_size", ""),
                design_flux_lmh=cfg.design_flux_lmh,
                flux_source=cfg.flux_source,
                elements_per_housing=cfg.elements_per_housing,
                housing_type=cfg.housing_type,
                housing_pressure_rating_bar=cfg.housing_pressure_rating_bar,
                max_elements_per_housing=cfg.max_elements_per_housing,
                max_housing_feed_flow_lh=cfg.max_housing_feed_flow_lh,
                max_housing_pressure_drop_bar=cfg.max_housing_pressure_drop_bar,
            )
        )
        sizings.append(sizing)

        hyd = evaluate_loop_hydraulics(
            HydraulicLoopInput(
                loop_number=loop_num,
                net_feed_flow_lh=net_feed,
                recirculation_flow_lh=cfg.recirculation_flow_lh,
                inlet_pressure_bar=cfg.inlet_pressure_bar,
                retentate_pressure_bar=cfg.retentate_pressure_bar,
                permeate_pressure_bar=cfg.permeate_pressure_bar,
                pump_efficiency=cfg.pump_efficiency,
                housing_count=sizing.housing_count,
                max_membrane_feed_flow_lh=mem.get("max_feed_flow"),
                max_housing_feed_flow_lh=cfg.max_housing_feed_flow_lh,
                max_pressure_drop_bar=cfg.max_housing_pressure_drop_bar or mem.get("max_pressure_drop"),
                max_operating_pressure_bar=mem.get("max_pressure"),
            )
        )
        hydraulic_loops.append(hyd)

    feed_pump = evaluate_feed_pump(
        FeedPumpInput(
            feed_flow_lh=feed_res.feed_flow_lh,
            required_differential_pressure_bar=feed_pump_diff_pressure_bar,
            pump_efficiency=feed_pump_efficiency,
        )
    )

    used_membranes = {s.membrane_id: membrane_records[s.membrane_id] for s in sizings if s.membrane_id in membrane_records}
    validation = run_engineering_validation(
        process_type=process_type,
        composition=comp_res,
        feed=feed_res,
        concentration=conc_res,
        loops=loop_res,
        loop_sizings=sizings,
        membrane_records=used_membranes,
        hydraulic_loops=hydraulic_loops,
        feed_pump=feed_pump,
        simulation_level="Level 1",
    )

    level1_sim = run_level1_simulation(
        process_type=process_type,
        composition=comp_res,
        feed=feed_res,
        concentration=conc_res,
        loops=loop_res,
        sizings=sizings,
    )
    level2_readiness = evaluate_level2_readiness(
        composition=comp_res,
        membrane_records=used_membranes,
        hydraulic_loops=hydraulic_loops,
    )

    return FullDesignOutput(
        composition=comp_res,
        feed=feed_res,
        concentration=conc_res,
        loops=loop_res,
        loop_sizings=sizings,
        total_membranes=sum(s.membrane_count for s in sizings),
        total_installed_area_m2=sum(s.installed_area_m2 for s in sizings),
        total_housings=sum(s.housing_count for s in sizings),
        feed_pump=feed_pump,
        hydraulic_loops=hydraulic_loops,
        validation=validation,
        level1_simulation=level1_sim,
        level2_readiness=level2_readiness,
    )
