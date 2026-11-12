"""Module 2: Membrane Sizing, Installed Area & Membrane Housing Arrangement."""

import math
import re
from typing import List
from .types import LoopSizingInput, LoopSizingResult


def _ceil_engineering(value: float) -> int:
    """Round upward to the nearest integer while avoiding floating-point overshoots."""
    if value <= 0:
        return 0
    nearest = round(value)
    if abs(value - nearest) <= 1e-9:
        return int(nearest)
    return int(math.ceil(value))


def calculate_membrane_count(
    permeate_flow_lh: float,
    membrane_area_m2: float,
    design_flux_lmh: float,
) -> tuple[float, int]:
    """Calculate exact and rounded-up whole number of membrane elements.

    Formula (Section 17):
        Number of Membranes Required = Round Up [Permeate Flow / (Membrane Area * Design Flux)]
    """
    if permeate_flow_lh < 0:
        raise ValueError("Permeate flow cannot be negative.")
    if membrane_area_m2 <= 0:
        raise ValueError("Effective membrane area must be strictly positive (m²).")
    if design_flux_lmh <= 0:
        raise ValueError("Design membrane flux must be strictly positive (LMH).")

    if permeate_flow_lh == 0:
        return 0.0, 0

    exact_count = permeate_flow_lh / (membrane_area_m2 * design_flux_lmh)
    return exact_count, _ceil_engineering(exact_count)


def calculate_installed_area(membrane_count: int, membrane_area_m2: float) -> float:
    """Calculate Total Installed Membrane Area (m²) = Membrane Count * Membrane Area."""
    if membrane_count < 0:
        raise ValueError("Membrane count cannot be negative.")
    if membrane_area_m2 <= 0:
        raise ValueError("Membrane area must be strictly positive.")
    return membrane_count * membrane_area_m2


def calculate_housing_count(membrane_count: int, elements_per_housing: int) -> tuple[int, int]:
    """Calculate pressure vessel / housing count and spare positions.

    Formula (Section 18):
        Number of Housings = Round Up [Membranes Required / Elements per Housing]
    Returns:
        (housing_count, spare_positions)
    """
    if membrane_count < 0:
        raise ValueError("Membrane count cannot be negative.")
    if elements_per_housing < 1:
        raise ValueError("Elements per housing must be at least 1.")

    if membrane_count == 0:
        return 0, 0

    housing_count = _ceil_engineering(membrane_count / elements_per_housing)
    total_positions = housing_count * elements_per_housing
    spare_positions = total_positions - membrane_count
    return housing_count, spare_positions


def _suggest_even_divisors(membrane_count: int, max_elements: int) -> List[int]:
    if membrane_count <= 0:
        return []
    return [n for n in range(1, min(membrane_count, max_elements) + 1) if membrane_count % n == 0]


def size_loop_equipment(data: LoopSizingInput) -> LoopSizingResult:
    """Compute membrane count, installed area, housing arrangement, and compatibility notices for one loop."""
    exact_count, membrane_count = calculate_membrane_count(
        data.permeate_flow_lh, data.membrane_area_m2, data.design_flux_lmh
    )
    installed_area = calculate_installed_area(membrane_count, data.membrane_area_m2)
    actual_flux = data.permeate_flow_lh / installed_area if installed_area > 0 else 0.0

    housing_count, spare_positions = calculate_housing_count(
        membrane_count, data.elements_per_housing
    )
    total_positions = housing_count * data.elements_per_housing
    is_divisible = spare_positions == 0

    warnings: List[str] = []

    if data.max_elements_per_housing is not None and data.elements_per_housing > data.max_elements_per_housing:
        warnings.append(
            f"Loop {data.loop_number}: Selected {data.elements_per_housing} elements/housing exceeds "
            f"maximum allowable elements per housing ({data.max_elements_per_housing})."
        )

    if data.housing_type:
        is_38_housing = "3838" in data.housing_type or "3.8" in data.housing_type
        is_80_housing = (
            "8038" in data.housing_type
            or "8.0" in data.housing_type
            or bool(re.search(r'(?<![0-9.])8"', data.housing_type))
        )
        if "8038" in data.nominal_size and is_38_housing:
            warnings.append(
                f"Loop {data.loop_number}: Dimension mismatch — 8038 element cannot fit inside a 3.8\" housing."
            )
        if "3838" in data.nominal_size and is_80_housing:
            warnings.append(
                f"Loop {data.loop_number}: Dimension mismatch — 3838 element does not match an 8.0\" housing."
            )

    if not is_divisible and membrane_count > 0:
        max_cap = data.max_elements_per_housing or 6
        even_options = _suggest_even_divisors(membrane_count, max_cap)
        alt_text = (
            f" Alternative even configurations (elements/housing): {', '.join(map(str, even_options))}."
            if even_options
            else ""
        )
        warnings.append(
            f"Loop {data.loop_number} Design Review Required: {membrane_count} membranes with "
            f"{data.elements_per_housing} elements/housing leaves {spare_positions} spare position(s) "
            f"across {housing_count} housing(s). Confirm dummy element / bypass acceptability.{alt_text}"
        )

    return LoopSizingResult(
        loop_number=data.loop_number,
        membrane_id=data.membrane_id,
        membrane_model=data.membrane_model,
        membrane_area_m2=data.membrane_area_m2,
        design_flux_lmh=data.design_flux_lmh,
        flux_source=data.flux_source.value,
        exact_membranes_required=exact_count,
        membrane_count=membrane_count,
        installed_area_m2=installed_area,
        actual_operating_flux_lmh=actual_flux,
        elements_per_housing=data.elements_per_housing,
        housing_count=housing_count,
        total_housing_positions=total_positions,
        spare_positions=spare_positions,
        is_divisible=is_divisible,
        housing_warnings=warnings,
    )
