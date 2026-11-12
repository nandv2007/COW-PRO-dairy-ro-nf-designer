"""Automated tests for Feed Composition, Ash->NF rule, Feed Flow, and Concentration Factor."""

import pytest

from app.engine.composition import calculate_snf, calculate_total_solids, evaluate_composition
from app.engine.concentration import (
    calculate_concentration_factor,
    calculate_permeate_removal,
    evaluate_concentration,
)
from app.engine.feed import calculate_feed_flow
from app.engine.types import (
    CompositionInput,
    ConcentrationInput,
    FeedConditionsInput,
    MilkType,
    ProcessType,
)


def test_snf_to_total_solids_conversion():
    # SRS Section 7.1 Example: Fat = 4%, SNF = 9% -> Total Solids = 13%
    assert calculate_total_solids(4.0, 9.0) == pytest.approx(13.0)
    res = evaluate_composition(
        CompositionInput(
            milk_type=MilkType.WHOLE,
            fat_percentage=4.0,
            input_mode="SNF",
            snf_percentage=9.0,
        )
    )
    assert res.total_solids_percentage == pytest.approx(13.0)
    assert res.value_sources["total_solids_percentage"] == "calculated"
    # Never fabricate unsupplied protein, lactose, or ash
    assert res.protein_percentage is None
    assert res.lactose_percentage is None
    assert res.ash_percentage is None


def test_total_solids_to_snf_conversion():
    assert calculate_snf(4.0, 13.0) == pytest.approx(9.0)
    res = evaluate_composition(
        CompositionInput(
            milk_type=MilkType.WHOLE,
            fat_percentage=4.0,
            input_mode="Total Solids",
            total_solids_percentage=13.0,
        )
    )
    assert res.snf_percentage == pytest.approx(9.0)
    assert res.value_sources["snf_percentage"] == "calculated"


@pytest.mark.parametrize(
    "kwargs",
    [
        {"fat_percentage": -1.0, "input_mode": "SNF", "snf_percentage": 9.0},
        {"fat_percentage": 4.0, "input_mode": "SNF", "snf_percentage": -0.5},
        {"fat_percentage": 10.0, "input_mode": "Total Solids", "total_solids_percentage": 8.0},
        {"fat_percentage": 50.0, "input_mode": "SNF", "snf_percentage": 55.0},
        {"fat_percentage": 4.0, "input_mode": "SNF", "snf_percentage": 9.0, "protein_percentage": 6.0, "lactose_percentage": 5.0},
    ],
)
def test_invalid_composition_percentages_rejected(kwargs):
    with pytest.raises(ValueError):
        evaluate_composition(CompositionInput(**kwargs))


def test_ash_restriction_to_nf():
    without_ash = evaluate_composition(
        CompositionInput(fat_percentage=0.1, input_mode="SNF", snf_percentage=9.0)
    )
    assert without_ash.ash_restriction_active is False
    assert set(without_ash.allowed_processes) == {ProcessType.RO, ProcessType.NF}

    with_ash = evaluate_composition(
        CompositionInput(
            fat_percentage=0.1,
            input_mode="SNF",
            snf_percentage=9.0,
            ash_percentage=0.72,
            ash_design_supplied=True,
        )
    )
    assert with_ash.ash_restriction_active is True
    assert with_ash.allowed_processes == [ProcessType.NF]
    assert "not a universal limitation" in with_ash.ash_rule_explanation


def test_feed_flow_conversions_and_validations():
    # Direct m3/h -> L/h
    direct = calculate_feed_flow(
        FeedConditionsInput(flow_input_method="direct", feed_flow=2.5, feed_flow_unit="m3/h")
    )
    assert direct.feed_flow_lh == pytest.approx(2500.0)
    assert direct.feed_flow_m3h == pytest.approx(2.5)

    # Processing capacity in kg requires positive density
    with pytest.raises(ValueError):
        calculate_feed_flow(
            FeedConditionsInput(
                flow_input_method="capacity",
                processing_capacity=5150.0,
                capacity_unit="kg",
                operating_time=5.0,
            )
        )

    cap_kg = calculate_feed_flow(
        FeedConditionsInput(
            flow_input_method="capacity",
            processing_capacity=5150.0,
            capacity_unit="kg",
            operating_time=5.0,
            density=1.03,
        )
    )
    assert cap_kg.feed_flow_lh == pytest.approx(1000.0)

    # Invalid operating time
    with pytest.raises(ValueError):
        calculate_feed_flow(
            FeedConditionsInput(
                flow_input_method="capacity",
                processing_capacity=1000.0,
                capacity_unit="L",
                operating_time=0.0,
            )
        )


def test_concentration_factor_boundaries():
    # CF < 1 invalid
    with pytest.raises(ValueError):
        calculate_concentration_factor(9.0, 8.5)

    # CF == 1: no concentration required
    cf1 = evaluate_concentration(
        ConcentrationInput(
            target_basis="SNF",
            initial_snf_percentage=9.0,
            initial_total_solids_percentage=13.0,
            target_percentage=9.0,
            feed_flow_lh=1000.0,
        )
    )
    assert cf1.concentration_factor == pytest.approx(1.0)
    assert cf1.is_no_concentration is True
    assert cf1.total_permeate_removal_lh == pytest.approx(0.0)

    # CF = 2 -> 500 L/h permeate
    assert calculate_permeate_removal(1000.0, 2.0) == pytest.approx(500.0)

    # CF = 3 -> out of automatic range warning
    cf3 = evaluate_concentration(
        ConcentrationInput(
            target_basis="SNF",
            initial_snf_percentage=9.0,
            initial_total_solids_percentage=13.0,
            target_percentage=27.0,
            feed_flow_lh=1000.0,
        )
    )
    assert cf3.concentration_factor == pytest.approx(3.0)
    assert cf3.out_of_automatic_range is True
