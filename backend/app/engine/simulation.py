"""Module 3: Process Simulation Engine (Level 1 Preliminary & Level 2 Guarded Mode)."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from .types import (
    CompositionResult,
    ConcentrationResult,
    FeedFlowResult,
    FeedPumpResult,
    HydraulicLoopResult,
    LoopAllocationResult,
    LoopSizingResult,
    ProcessType,
    ValidationSummary,
)


class LoopSimulationMetrics(BaseModel):
    """Calculated Level 1 simulation metrics for a single loop."""

    loop_number: int
    is_active: bool
    feed_flow_lh: float
    permeate_flow_lh: float
    retentate_flow_lh: float
    permeate_recovery_pct: float
    cumulative_concentration_factor: float
    membrane_model: Optional[str] = None
    membrane_area_m2: Optional[float] = None
    design_flux_lmh: Optional[float] = None
    actual_flux_lmh: Optional[float] = None
    membrane_count: int = 0
    installed_area_m2: float = 0.0
    housing_count: int = 0
    spare_positions: int = 0


class Level1SimulationOutput(BaseModel):
    """Deterministic output for Level 1 — Preliminary Design Simulation."""

    simulation_level: str = "Level 1"
    process_type: ProcessType
    feed_flow_lh: float
    concentration_factor: float
    total_permeate_removal_lh: float
    final_retentate_flow_lh: float
    overall_recovery_pct: float
    active_loops: int
    configuration_label: str
    total_membranes: int
    total_installed_area_m2: float
    loop_metrics: List[LoopSimulationMetrics]
    estimated_retentate_snf_pct: Optional[float] = None
    estimated_retentate_total_solids_pct: Optional[float] = None
    assumptions: List[str] = Field(default_factory=list)


class Level2ReadinessOutput(BaseModel):
    """Honest status report for Level 2 — Advanced Performance Simulation (Section 21)."""

    simulation_level: str = "Level 2"
    is_available: bool = False
    status_label: str = "Not Executed — Validated Physical Parameters Required"
    message: str
    missing_requirements: List[str]


def run_level1_simulation(
    process_type: ProcessType,
    composition: CompositionResult,
    feed: FeedFlowResult,
    concentration: ConcentrationResult,
    loops: LoopAllocationResult,
    sizings: List[LoopSizingResult],
) -> Level1SimulationOutput:
    """Execute Level 1 Preliminary Design Simulation using agreed COW PRO formulas."""
    sizing_by_loop = {s.loop_number: s for s in sizings}
    loop_metrics: List[LoopSimulationMetrics] = []

    # Loop 1
    s1 = sizing_by_loop.get(1)
    l1_recovery = (loops.loop1_permeate_flow_lh / loops.loop1_feed_flow_lh * 100.0) if loops.loop1_feed_flow_lh > 0 else 0.0
    l1_cum_cf = (feed.feed_flow_lh / loops.loop1_retentate_flow_lh) if loops.loop1_retentate_flow_lh > 0 else concentration.concentration_factor
    loop_metrics.append(
        LoopSimulationMetrics(
            loop_number=1,
            is_active=loops.loop1_active,
            feed_flow_lh=loops.loop1_feed_flow_lh,
            permeate_flow_lh=loops.loop1_permeate_flow_lh,
            retentate_flow_lh=loops.loop1_retentate_flow_lh,
            permeate_recovery_pct=l1_recovery,
            cumulative_concentration_factor=l1_cum_cf,
            membrane_model=s1.membrane_model if s1 else None,
            membrane_area_m2=s1.membrane_area_m2 if s1 else None,
            design_flux_lmh=s1.design_flux_lmh if s1 else None,
            actual_flux_lmh=s1.actual_operating_flux_lmh if s1 else None,
            membrane_count=s1.membrane_count if s1 else 0,
            installed_area_m2=s1.installed_area_m2 if s1 else 0.0,
            housing_count=s1.housing_count if s1 else 0,
            spare_positions=s1.spare_positions if s1 else 0,
        )
    )

    # Loop 2
    s2 = sizing_by_loop.get(2)
    l2_recovery = (loops.loop2_permeate_flow_lh / loops.loop2_feed_flow_lh * 100.0) if loops.loop2_feed_flow_lh > 0 else 0.0
    l2_cum_cf = (feed.feed_flow_lh / loops.loop2_retentate_flow_lh) if (loops.loop2_active and loops.loop2_retentate_flow_lh > 0) else 0.0
    loop_metrics.append(
        LoopSimulationMetrics(
            loop_number=2,
            is_active=loops.loop2_active,
            feed_flow_lh=loops.loop2_feed_flow_lh,
            permeate_flow_lh=loops.loop2_permeate_flow_lh,
            retentate_flow_lh=loops.loop2_retentate_flow_lh,
            permeate_recovery_pct=l2_recovery,
            cumulative_concentration_factor=l2_cum_cf,
            membrane_model=s2.membrane_model if (loops.loop2_active and s2) else None,
            membrane_area_m2=s2.membrane_area_m2 if (loops.loop2_active and s2) else None,
            design_flux_lmh=s2.design_flux_lmh if (loops.loop2_active and s2) else None,
            actual_flux_lmh=s2.actual_operating_flux_lmh if (loops.loop2_active and s2) else None,
            membrane_count=s2.membrane_count if (loops.loop2_active and s2) else 0,
            installed_area_m2=s2.installed_area_m2 if (loops.loop2_active and s2) else 0.0,
            housing_count=s2.housing_count if (loops.loop2_active and s2) else 0,
            spare_positions=s2.spare_positions if (loops.loop2_active and s2) else 0,
        )
    )

    total_membranes = sum(s.membrane_count for s in sizings)
    total_area = sum(s.installed_area_m2 for s in sizings)
    overall_recovery = (concentration.total_permeate_removal_lh / feed.feed_flow_lh * 100.0) if feed.feed_flow_lh > 0 else 0.0

    est_ret_snf = composition.snf_percentage * concentration.concentration_factor if concentration.target_basis == "SNF" else None
    est_ret_ts = composition.total_solids_percentage * concentration.concentration_factor if concentration.target_basis == "Total Solids" else None

    assumptions = [
        "Preliminary volumetric concentration assumption: Permeate Removal = Feed Flow * (1 - 1 / CF).",
        "Design fluxes are user-supplied demonstration/engineering values, not validated manufacturer curves.",
        "NF permeate may transmit dissolved minerals/salts; retentate solids estimates assume target-basis scaling only.",
    ]

    return Level1SimulationOutput(
        process_type=process_type,
        feed_flow_lh=feed.feed_flow_lh,
        concentration_factor=concentration.concentration_factor,
        total_permeate_removal_lh=concentration.total_permeate_removal_lh,
        final_retentate_flow_lh=loops.final_retentate_flow_lh,
        overall_recovery_pct=overall_recovery,
        active_loops=loops.active_loops,
        configuration_label=loops.configuration_label,
        total_membranes=total_membranes,
        total_installed_area_m2=total_area,
        loop_metrics=loop_metrics,
        estimated_retentate_snf_pct=est_ret_snf,
        estimated_retentate_total_solids_pct=est_ret_ts,
        assumptions=assumptions,
    )


def evaluate_level2_readiness(
    composition: Optional[CompositionResult],
    membrane_records: Dict[int, Dict[str, Any]],
    hydraulic_loops: List[HydraulicLoopResult],
) -> Level2ReadinessOutput:
    """Check requirements for Level 2 Advanced Simulation without fabricating unimplemented outputs."""
    missing: List[str] = [
        "Validated physical osmotic pressure correlation as a function of milk solids & temperature.",
        "Validated concentration polarization mass-transfer model and boundary-layer viscosity correlation.",
        "Experimentally or manufacturer-verified flux decline and fouling kinetics model.",
    ]

    if composition is None or (composition.protein_percentage is None or composition.lactose_percentage is None or composition.ash_percentage is None):
        missing.append("Complete measured component breakdown (protein, lactose, ash, and mineral fractions) for component mass balance.")

    for mid, rec in membrane_records.items():
        if not rec.get("mineral_rejection") or not rec.get("salt_rejection"):
            missing.append(f"Verified salt/mineral rejection data for membrane '{rec.get('model', mid)}'.")

    if not hydraulic_loops or any(h.transmembrane_pressure_bar is None for h in hydraulic_loops):
        missing.append("Complete operating pressure profile (inlet, retentate, permeate pressures) and loop recirculation flow.")

    return Level2ReadinessOutput(
        is_available=False,
        message=(
            "Level 2 Advanced Performance Simulation is reserved for validated component mass-balance, "
            "osmotic pressure, concentration polarization, and rheological models. COW PRO does not "
            "generate fictional advanced simulation outputs when underlying physical parameters are unverified."
        ),
        missing_requirements=missing,
    )
