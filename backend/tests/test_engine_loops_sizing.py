"""Automated tests for Loop Selection, Membrane Sizing, Housing, Hydraulics, Validation & Section 27 Case."""

import pytest

from app.db.seed import INITIAL_MEMBRANES
from app.engine.hydraulics import (
    calculate_average_feed_pressure,
    calculate_pressure_drop,
    calculate_pump_power_si,
    calculate_transmembrane_pressure,
)
from app.engine.loops import select_and_balance_loops
from app.engine.orchestrator import LoopConfigInput, run_full_design_pipeline
from app.engine.sizing import (
    calculate_housing_count,
    calculate_installed_area,
    calculate_membrane_count,
    size_loop_equipment,
)
from app.engine.types import (
    CompositionInput,
    FeedConditionsInput,
    LoopSizingInput,
    MilkType,
    ProcessType,
    ValidationCheckStatus,
    VerificationStatus,
)


def _catalog_dict():
    return {m["id"]: dict(m) for m in INITIAL_MEMBRANES}


def test_loop_selection_boundaries():
    # CF = 1.0 -> no concentration / single loop standby
    r1 = select_and_balance_loops(1000.0, 1.0, 0.0)
    assert r1.active_loops == 1
    assert r1.loop2_active is False

    # CF = 1.6 -> Single Loop
    perm_16 = 1000.0 * (1.0 - 1.0 / 1.6)
    r16 = select_and_balance_loops(1000.0, 1.6, perm_16)
    assert r16.configuration_label == "Single Loop"
    assert r16.active_loops == 1
    assert r16.loop1_permeate_flow_lh == pytest.approx(perm_16)
    assert r16.loop2_permeate_flow_lh == 0.0
    assert r16.final_retentate_flow_lh == pytest.approx(1000.0 - perm_16)

    # CF just above 1.6 -> Two Loops with 2/3 & 1/3 split
    perm_above = 1000.0 * (1.0 - 1.0 / 1.61)
    r_above = select_and_balance_loops(1000.0, 1.61, perm_above)
    assert r_above.configuration_label == "Two Loops"
    assert r_above.active_loops == 2
    assert r_above.loop1_permeate_flow_lh == pytest.approx(perm_above * 2.0 / 3.0)
    assert r_above.loop2_permeate_flow_lh == pytest.approx(perm_above / 3.0)
    assert r_above.overall_mass_balance_error_lh < 1e-9

    # CF just below 3 -> Two Loops
    perm_299 = 1000.0 * (1.0 - 1.0 / 2.99)
    r_299 = select_and_balance_loops(1000.0, 2.99, perm_299)
    assert r_299.configuration_label == "Two Loops"
    assert r_299.active_loops == 2

    # CF == 3 -> Out of Automatic Range warning
    perm_3 = 1000.0 * (1.0 - 1.0 / 3.0)
    r_3 = select_and_balance_loops(1000.0, 3.0, perm_3)
    assert "Out of Automatic Range" in r_3.configuration_label
    assert len(r_3.warnings) >= 2


def test_membrane_sizing_and_flux_validation():
    exact, count = calculate_membrane_count(333.3333333333, 4.9, 15.0)
    assert exact == pytest.approx(4.535147, rel=1e-4)
    assert count == 5
    assert calculate_installed_area(5, 4.9) == pytest.approx(24.5)

    # Zero or negative flux rejected
    with pytest.raises(ValueError):
        calculate_membrane_count(100.0, 4.9, 0.0)
    with pytest.raises(ValueError):
        calculate_membrane_count(100.0, 4.9, -12.0)

    # Housing divisibility & spare positions
    housings, spare = calculate_housing_count(5, 2)
    assert housings == 3
    assert spare == 1
    sz = size_loop_equipment(
        LoopSizingInput(
            loop_number=1,
            permeate_flow_lh=333.3333333,
            membrane_id=8,
            membrane_model="3838 TS40",
            membrane_area_m2=4.9,
            nominal_size="3838",
            design_flux_lmh=15.0,
            elements_per_housing=2,
        )
    )
    assert sz.is_divisible is False
    assert sz.spare_positions == 1
    assert any("spare position" in w.lower() for w in sz.housing_warnings)

    # Matching 3.8" housing for 3838 element must NOT produce a dimension mismatch warning
    sz_match = size_loop_equipment(
        LoopSizingInput(
            loop_number=1,
            permeate_flow_lh=333.3333333,
            membrane_id=8,
            membrane_model="3838 TS40",
            membrane_area_m2=4.9,
            nominal_size="3838",
            design_flux_lmh=15.0,
            elements_per_housing=1,
            housing_type='Sanitary 3.8" Stainless Vessel (3838)',
        )
    )
    assert sz_match.housing_warnings == []

    # Mismatched 8.0" housing for 3838 element MUST produce a dimension mismatch warning
    sz_mismatch = size_loop_equipment(
        LoopSizingInput(
            loop_number=1,
            permeate_flow_lh=333.3333333,
            membrane_id=8,
            membrane_model="3838 TS40",
            membrane_area_m2=4.9,
            nominal_size="3838",
            design_flux_lmh=15.0,
            elements_per_housing=1,
            housing_type='Sanitary 8.0" Stainless Vessel (8038)',
        )
    )
    assert any("dimension mismatch" in w.lower() for w in sz_mismatch.housing_warnings)


def test_hydraulics_si_pump_power():
    dp = calculate_pressure_drop(25.0, 22.0)
    assert dp == pytest.approx(3.0)
    avg_p = calculate_average_feed_pressure(25.0, 22.0)
    assert avg_p == pytest.approx(23.5)
    tmp = calculate_transmembrane_pressure(avg_p, 1.5)
    assert tmp == pytest.approx(22.0)

    # 3600 L/h = 0.001 m3/s; 10 bar = 1,000,000 Pa -> Hyd Power = 1000 W = 1 kW
    hyd_w, hyd_kw, shaft_w, shaft_kw = calculate_pump_power_si(3600.0, 10.0, 0.8)
    assert hyd_w == pytest.approx(1000.0)
    assert hyd_kw == pytest.approx(1.0)
    assert shaft_w == pytest.approx(1250.0)
    assert shaft_kw == pytest.approx(1.25)


def test_section_27_demonstration_case():
    """Verify exact Section 27 outputs and ensure project is NOT falsely marked fully Validated."""
    membranes = _catalog_dict()
    design = run_full_design_pipeline(
        process_type=ProcessType.NF,
        composition_input=CompositionInput(
            milk_type=MilkType.CUSTOM,
            fat_percentage=0.0,
            input_mode="SNF",
            snf_percentage=9.0,
        ),
        feed_input=FeedConditionsInput(
            flow_input_method="direct",
            feed_flow=1000.0,
            feed_flow_unit="L/h",
            temperature=10.0,
        ),
        target_basis="SNF",
        target_percentage=18.0,
        loop_configs={
            1: LoopConfigInput(loop_number=1, membrane_id=8, design_flux_lmh=15.0, flux_source=VerificationStatus.USER_SUPPLIED),
            2: LoopConfigInput(loop_number=2, membrane_id=8, design_flux_lmh=10.0, flux_source=VerificationStatus.USER_SUPPLIED),
        },
        membrane_records=membranes,
    )

    assert design.concentration.concentration_factor == pytest.approx(2.0)
    assert design.concentration.total_permeate_removal_lh == pytest.approx(500.0)
    assert design.loops.active_loops == 2
    assert design.loops.loop1_permeate_flow_lh == pytest.approx(500.0 * 2.0 / 3.0)
    assert design.loops.loop2_permeate_flow_lh == pytest.approx(500.0 / 3.0)
    assert design.loops.final_retentate_flow_lh == pytest.approx(500.0)

    s1, s2 = design.loop_sizings
    assert s1.membrane_count == 5
    assert s2.membrane_count == 4
    assert design.total_membranes == 9
    assert design.total_installed_area_m2 == pytest.approx(44.1)

    # Critical Section 27 requirement: math checks pass, but NOT fully validated until hydraulics & datasheet verified
    assert design.validation.can_mark_validated is False
    assert design.validation.overall_status == ValidationCheckStatus.NOT_EVALUATED
    assert design.level2_readiness is not None
    assert design.level2_readiness.is_available is False
