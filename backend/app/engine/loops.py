"""Module 2: Automatic Loop Selection, Permeate Distribution & Sequential Flow Balance."""

from .types import LoopAllocationResult


HEURISTIC_DISCLAIMER = (
    "COW PRO Version 1 Design Heuristic: Automatic loop selection (Single Loop for 1 <= CF <= 1.6; "
    "Two Loops with 2/3 & 1/3 permeate split for 1.6 < CF < 3) is a preliminary sizing rule "
    "and does not represent a universally optimized industrial membrane configuration."
)


def select_and_balance_loops(
    feed_flow_lh: float,
    concentration_factor: float,
    total_permeate_removal_lh: float,
) -> LoopAllocationResult:
    """Apply COW PRO Version 1 automatic loop selection and compute sequential loop flow balances.

    Rules (Section 11):
        - CF < 1: Invalid
        - 1 <= CF <= 1.6: Single Loop (Loop 1 = Total Permeate Removal, Loop 2 = 0)
        - 1.6 < CF < 3: Two Loops (Loop 1 = Total * 2/3, Loop 2 = Total / 3)
        - CF >= 3: Outside automatic design range (flag warning; do not invent 3+ loops)

    Flow balance (Section 12, sequential Feed -> Loop 1 -> Loop 2 -> Final Retentate):
        - Loop 1 Feed = Total Feed
        - Loop 1 Retentate = Loop 1 Feed - Loop 1 Permeate
        - Loop 2 Feed = Loop 1 Retentate (if two loops else 0)
        - Final Retentate = Loop 2 Feed - Loop 2 Permeate (or Loop 1 Retentate for 1 loop)
    """
    if feed_flow_lh <= 0:
        raise ValueError("Feed flow must be strictly greater than zero.")
    if concentration_factor < 1.0:
        raise ValueError("Concentration factor below 1 is invalid.")
    if total_permeate_removal_lh < 0:
        raise ValueError("Total permeate removal cannot be negative.")

    warnings = [HEURISTIC_DISCLAIMER]

    if abs(concentration_factor - 1.0) <= 1e-9:
        config_label = "No Concentration Required"
        active_loops = 1
        rule = "CF = 1.0: No concentration required; Loop 1 standby (0 L/h permeate), Loop 2 inactive."
        loop1_active = True
        loop2_active = False
        loop1_permeate = 0.0
        loop2_permeate = 0.0
    elif concentration_factor <= 1.6 + 1e-12:
        config_label = "Single Loop"
        active_loops = 1
        rule = "1.0 < CF <= 1.6: Single-Loop configuration selected (Loop 1 handles 100% permeate removal)."
        loop1_active = True
        loop2_active = False
        loop1_permeate = total_permeate_removal_lh
        loop2_permeate = 0.0
    elif concentration_factor < 3.0 - 1e-12:
        config_label = "Two Loops"
        active_loops = 2
        rule = "1.6 < CF < 3.0: Two-Loop configuration selected (Loop 1 = 2/3 permeate, Loop 2 = 1/3 permeate)."
        loop1_active = True
        loop2_active = True
        loop1_permeate = total_permeate_removal_lh * (2.0 / 3.0)
        loop2_permeate = total_permeate_removal_lh / 3.0
    else:
        config_label = "Out of Automatic Range (CF >= 3)"
        active_loops = 2
        rule = (
            f"CF = {concentration_factor:.4f} >= 3.0: Outside defined COW PRO v1 automatic loop range. "
            "Showing preliminary 2-loop heuristic breakdown with mandatory engineering warning."
        )
        loop1_active = True
        loop2_active = True
        loop1_permeate = total_permeate_removal_lh * (2.0 / 3.0)
        loop2_permeate = total_permeate_removal_lh / 3.0
        warnings.append(
            "Concentration Factor >= 3.0 is outside the COW PRO automatic design range. "
            "Do not use preliminary two-loop sizing without dedicated multi-stage process engineering."
        )

    loop1_feed = feed_flow_lh
    loop1_retentate = loop1_feed - loop1_permeate

    if loop2_active:
        loop2_feed = loop1_retentate
        loop2_retentate = loop2_feed - loop2_permeate
        final_retentate = loop2_retentate
    else:
        loop2_feed = 0.0
        loop2_retentate = 0.0
        final_retentate = loop1_retentate

    permeate_sum_error = abs((loop1_permeate + loop2_permeate) - total_permeate_removal_lh)
    overall_balance_error = abs(feed_flow_lh - (final_retentate + total_permeate_removal_lh))

    return LoopAllocationResult(
        configuration_label=config_label,
        active_loops=active_loops,
        loop_selection_rule=rule,
        loop1_active=loop1_active,
        loop2_active=loop2_active,
        loop1_feed_flow_lh=loop1_feed,
        loop1_permeate_flow_lh=loop1_permeate,
        loop1_retentate_flow_lh=loop1_retentate,
        loop2_feed_flow_lh=loop2_feed,
        loop2_permeate_flow_lh=loop2_permeate,
        loop2_retentate_flow_lh=loop2_retentate,
        final_retentate_flow_lh=final_retentate,
        overall_mass_balance_error_lh=overall_balance_error,
        loop_permeate_sum_error_lh=permeate_sum_error,
        warnings=warnings,
    )
