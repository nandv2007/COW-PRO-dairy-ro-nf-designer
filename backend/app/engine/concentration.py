"""Module 1 Stage 3 & Module 2: Concentration Factor & Permeate Removal Calculations."""

from .types import ConcentrationInput, ConcentrationResult


VOLUMETRIC_CF_WARNING = (
    "Preliminary Sizing Assumption: The solids concentration ratio (Target / Initial) is treated "
    "as a preliminary volumetric concentration factor. Actual volumetric concentration factor may "
    "differ when feed and retentate densities change, solids/minerals pass into the permeate "
    "(especially in NF), or components are retained differently."
)


def calculate_concentration_factor(
    initial_percentage: float, target_percentage: float
) -> float:
    """Calculate preliminary Concentration Factor = Target Percentage / Initial Percentage."""
    if initial_percentage <= 0:
        raise ValueError("Initial concentration percentage must be greater than zero.")
    if target_percentage <= 0:
        raise ValueError("Target concentration percentage must be greater than zero.")
    cf = target_percentage / initial_percentage
    if cf < 1.0 - 1e-12:
        raise ValueError(
            f"Invalid Concentration Factor ({cf:.4f} < 1). Target concentration ({target_percentage:g}%) "
            f"cannot be less than initial concentration ({initial_percentage:g}%)."
        )
    # Clamp tiny floating-point undershoot at exactly 1.0
    if abs(cf - 1.0) <= 1e-12:
        return 1.0
    return cf


def calculate_permeate_removal(feed_flow_lh: float, concentration_factor: float) -> float:
    """Calculate Total Permeate Removal (L/h) = Feed Flow * (1 - 1 / Concentration Factor)."""
    if feed_flow_lh <= 0:
        raise ValueError("Feed flow must be greater than zero (L/h).")
    if concentration_factor < 1.0:
        raise ValueError("Concentration factor cannot be less than 1.0.")
    return feed_flow_lh * (1.0 - 1.0 / concentration_factor)


def evaluate_concentration(data: ConcentrationInput) -> ConcentrationResult:
    """Compute Concentration Factor, Permeate Removal rate & volume, and engineering warnings."""
    if data.target_basis == "SNF":
        initial_pct = data.initial_snf_percentage
    elif data.target_basis == "Total Solids":
        initial_pct = data.initial_total_solids_percentage
    else:
        raise ValueError(f"Unsupported target_basis: {data.target_basis}")

    cf = calculate_concentration_factor(initial_pct, data.target_percentage)
    permeate_removal_lh = calculate_permeate_removal(data.feed_flow_lh, cf)
    final_retentate_flow_lh = data.feed_flow_lh - permeate_removal_lh

    permeate_volume_l = None
    if data.operating_time_hours is not None:
        if data.operating_time_hours <= 0:
            raise ValueError("Operating time must be strictly positive when provided.")
        permeate_volume_l = permeate_removal_lh * data.operating_time_hours

    is_no_conc = abs(cf - 1.0) <= 1e-9
    out_of_range = cf >= 3.0 - 1e-12

    warnings = [VOLUMETRIC_CF_WARNING]
    if is_no_conc:
        warnings.append(
            "Concentration Factor equals 1.0: No concentration required (Total Permeate Removal = 0 L/h)."
        )
    if out_of_range:
        warnings.append(
            f"Concentration Factor ({cf:.4f}) is >= 3.0, which is outside the currently defined "
            "COW PRO Version 1 automatic loop design range (1 < CF < 3). Manual multi-stage or "
            "custom plant configuration review is required."
        )

    return ConcentrationResult(
        target_basis=data.target_basis,
        initial_percentage=initial_pct,
        target_percentage=data.target_percentage,
        concentration_factor=cf,
        total_permeate_removal_lh=permeate_removal_lh,
        total_permeate_volume_l=permeate_volume_l,
        final_retentate_flow_lh=final_retentate_flow_lh,
        is_no_concentration=is_no_conc,
        out_of_automatic_range=out_of_range,
        warnings=warnings,
    )
