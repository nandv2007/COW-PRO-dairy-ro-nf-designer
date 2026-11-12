"""Module 1 Stage 2: Feed Flow & Conditions Calculations."""

from .types import FeedConditionsInput, FeedFlowResult


def calculate_feed_flow(data: FeedConditionsInput) -> FeedFlowResult:
    """Compute volumetric feed flow in L/h and m³/h from direct input or processing capacity.

    Method A (Direct): converts L/h or m³/h -> L/h (1 m³/h = 1,000 L/h).
    Method B (Capacity): Feed Flow = Total Milk Processing Capacity / Operating Time.
        If capacity_unit == 'kg', requires positive density (kg/L) to convert mass to liters.
    """
    warnings = []

    if data.ph is not None and (data.ph < 0 or data.ph > 14):
        raise ValueError("Feed pH must be between 0 and 14.")
    if data.density is not None and data.density <= 0:
        raise ValueError("Feed density must be strictly positive (kg/L).")
    if data.viscosity is not None and data.viscosity <= 0:
        raise ValueError("Feed viscosity must be strictly positive (mPa·s).")
    if data.conductivity is not None and data.conductivity < 0:
        raise ValueError("Feed conductivity must be nonnegative (mS/cm).")

    capacity_liters = None
    operating_time = data.operating_time

    if data.flow_input_method == "direct":
        if data.feed_flow is None or data.feed_flow <= 0:
            raise ValueError("Feed flow must be strictly greater than zero.")
        if data.feed_flow_unit == "L/h":
            feed_flow_lh = data.feed_flow
            formula_used = f"Direct feed flow = {data.feed_flow:g} L/h"
        elif data.feed_flow_unit == "m3/h":
            feed_flow_lh = data.feed_flow * 1000.0
            formula_used = f"Feed flow = {data.feed_flow:g} m³/h × 1,000 L/m³ = {feed_flow_lh:g} L/h"
        else:
            raise ValueError(f"Unsupported feed_flow_unit: {data.feed_flow_unit}")

        if operating_time is not None and operating_time <= 0:
            raise ValueError("Operating time must be strictly greater than zero when provided.")

    elif data.flow_input_method == "capacity":
        if data.processing_capacity is None or data.processing_capacity <= 0:
            raise ValueError("Processing capacity must be strictly greater than zero.")
        if data.operating_time is None or data.operating_time <= 0:
            raise ValueError("Operating time must be strictly greater than zero.")

        if data.capacity_unit == "L":
            capacity_liters = data.processing_capacity
            formula_used = (
                f"Feed Flow = {data.processing_capacity:g} L / {data.operating_time:g} h"
            )
        elif data.capacity_unit == "m3":
            capacity_liters = data.processing_capacity * 1000.0
            formula_used = (
                f"Feed Flow = ({data.processing_capacity:g} m³ × 1,000 L/m³) / {data.operating_time:g} h"
            )
        elif data.capacity_unit == "kg":
            if data.density is None or data.density <= 0:
                raise ValueError(
                    "Positive feed density (kg/L) is required when processing capacity is entered in kg."
                )
            capacity_liters = data.processing_capacity / data.density
            formula_used = (
                f"Feed Flow = ({data.processing_capacity:g} kg / {data.density:g} kg/L) / {data.operating_time:g} h"
            )
        else:
            raise ValueError(f"Unsupported capacity_unit: {data.capacity_unit}")

        feed_flow_lh = capacity_liters / data.operating_time
    else:
        raise ValueError(f"Unsupported flow_input_method: {data.flow_input_method}")

    if data.temperature < 0 or data.temperature > 90:
        warnings.append(
            f"Feed temperature ({data.temperature:g} °C) is outside typical dairy membrane processing range (0–65 °C)."
        )

    return FeedFlowResult(
        feed_flow_lh=feed_flow_lh,
        feed_flow_m3h=feed_flow_lh / 1000.0,
        flow_input_method=data.flow_input_method,
        processing_capacity_liters=capacity_liters,
        operating_time_hours=operating_time,
        temperature_c=data.temperature,
        ph=data.ph,
        density_kg_per_l=data.density,
        viscosity_cp=data.viscosity,
        conductivity_ms_cm=data.conductivity,
        formula_used=formula_used,
        warnings=warnings,
    )
