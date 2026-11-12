"""Module 2: Hydraulic Design, Pressure Drop, TMP & SI Pump Power Calculations."""

from .types import (
    FeedPumpInput,
    FeedPumpResult,
    HydraulicLoopInput,
    HydraulicLoopResult,
)


def calculate_pressure_drop(inlet_pressure_bar: float, retentate_pressure_bar: float) -> float:
    """Membrane Pressure Drop = Membrane Inlet Pressure - Membrane Retentate Outlet Pressure (bar)."""
    if inlet_pressure_bar < 0 or retentate_pressure_bar < 0:
        raise ValueError("Gauge/operating pressures cannot be negative.")
    if retentate_pressure_bar > inlet_pressure_bar:
        raise ValueError("Retentate outlet pressure cannot exceed membrane inlet pressure.")
    return inlet_pressure_bar - retentate_pressure_bar


def calculate_average_feed_pressure(inlet_pressure_bar: float, retentate_pressure_bar: float) -> float:
    """Average Feed-Side Pressure = (Inlet Pressure + Retentate Outlet Pressure) / 2 (bar)."""
    if inlet_pressure_bar < 0 or retentate_pressure_bar < 0:
        raise ValueError("Pressures cannot be negative.")
    return (inlet_pressure_bar + retentate_pressure_bar) / 2.0


def calculate_transmembrane_pressure(
    average_feed_pressure_bar: float, permeate_pressure_bar: float
) -> float:
    """Transmembrane Pressure (TMP) = Average Feed-Side Pressure - Permeate Pressure (bar)."""
    if permeate_pressure_bar < 0:
        raise ValueError("Permeate pressure cannot be negative.")
    tmp = average_feed_pressure_bar - permeate_pressure_bar
    if tmp < 0:
        raise ValueError("Transmembrane pressure cannot be negative (permeate exceeds average feed pressure).")
    return tmp


def calculate_pump_power_si(
    volumetric_flow_lh: float,
    differential_pressure_bar: float,
    pump_efficiency: float,
) -> tuple[float, float, float, float]:
    """Calculate Hydraulic Pump Power and Required Pump Shaft Power using SI units.

    Conversions:
        Q (m³/s) = Volumetric Flow (L/h) / 3,600,000
        dP (Pa)  = Differential Pressure (bar) * 100,000
        Hydraulic Power (W) = Q (m³/s) * dP (Pa)
        Shaft Power (W)     = Hydraulic Power (W) / Pump Efficiency

    Returns:
        (hydraulic_power_w, hydraulic_power_kw, shaft_power_w, shaft_power_kw)
    """
    if volumetric_flow_lh < 0:
        raise ValueError("Pump volumetric flow cannot be negative.")
    if differential_pressure_bar < 0:
        raise ValueError("Pump differential pressure cannot be negative.")
    if pump_efficiency <= 0 or pump_efficiency > 1.0:
        raise ValueError("Pump efficiency must be strictly greater than 0 and <= 1.0.")

    flow_m3_s = volumetric_flow_lh / 3_600_000.0
    pressure_pa = differential_pressure_bar * 100_000.0
    hydraulic_w = flow_m3_s * pressure_pa
    shaft_w = hydraulic_w / pump_efficiency
    return hydraulic_w, hydraulic_w / 1000.0, shaft_w, shaft_w / 1000.0


def evaluate_feed_pump(data: FeedPumpInput) -> FeedPumpResult:
    """Evaluate Feed Pump hydraulic and shaft power when differential pressure & efficiency are supplied."""
    if data.feed_flow_lh <= 0:
        raise ValueError("Feed flow must be strictly greater than zero.")

    flow_m3_s = data.feed_flow_lh / 3_600_000.0
    notes = []

    if data.required_differential_pressure_bar is None or data.pump_efficiency is None:
        notes.append(
            "Feed pump sizing not evaluated: supply required differential pressure (bar) "
            "and pump efficiency (0-1) to compute validated SI pump power."
        )
        return FeedPumpResult(
            feed_flow_lh=data.feed_flow_lh,
            feed_flow_m3_s=flow_m3_s,
            required_differential_pressure_bar=data.required_differential_pressure_bar,
            pump_efficiency=data.pump_efficiency,
            evaluated=False,
            notes=notes,
        )

    hyd_w, hyd_kw, shaft_w, shaft_kw = calculate_pump_power_si(
        data.feed_flow_lh,
        data.required_differential_pressure_bar,
        data.pump_efficiency,
    )
    notes.append(
        f"Feed pump evaluated in SI units: Q={flow_m3_s:.6f} m³/s, "
        f"ΔP={data.required_differential_pressure_bar * 100000:.0f} Pa, η={data.pump_efficiency:.2%}."
    )
    return FeedPumpResult(
        feed_flow_lh=data.feed_flow_lh,
        feed_flow_m3_s=flow_m3_s,
        required_differential_pressure_bar=data.required_differential_pressure_bar,
        required_differential_pressure_pa=data.required_differential_pressure_bar * 100_000.0,
        pump_efficiency=data.pump_efficiency,
        hydraulic_power_w=hyd_w,
        hydraulic_power_kw=hyd_kw,
        shaft_power_w=shaft_w,
        shaft_power_kw=shaft_kw,
        evaluated=True,
        notes=notes,
    )


def evaluate_loop_hydraulics(data: HydraulicLoopInput) -> HydraulicLoopResult:
    """Evaluate loop pressure profile, recirculation feed flow, and recirculation pump power."""
    notes = []
    membrane_feed_flow = None
    flow_per_housing = None

    if data.recirculation_flow_lh is not None:
        if data.recirculation_flow_lh < 0:
            raise ValueError("Recirculation flow cannot be negative.")
        membrane_feed_flow = data.net_feed_flow_lh + data.recirculation_flow_lh
        if data.housing_count > 0:
            flow_per_housing = membrane_feed_flow / data.housing_count
            if data.max_housing_feed_flow_lh is not None and flow_per_housing > data.max_housing_feed_flow_lh:
                notes.append(
                    f"Loop {data.loop_number}: Flow per housing ({flow_per_housing:.2f} L/h) exceeds "
                    f"maximum housing feed flow ({data.max_housing_feed_flow_lh:.2f} L/h)."
                )
            if data.max_membrane_feed_flow_lh is not None and flow_per_housing > data.max_membrane_feed_flow_lh:
                notes.append(
                    f"Loop {data.loop_number}: Flow per vessel ({flow_per_housing:.2f} L/h) exceeds "
                    f"membrane maximum feed flow ({data.max_membrane_feed_flow_lh:.2f} L/h)."
                )
    else:
        notes.append(
            f"Loop {data.loop_number}: Recirculation flow not yet supplied; membrane crossflow and "
            "recirculation pump sizing remain pending manufacturer hydraulic limits."
        )

    pressure_drop = None
    avg_pressure = None
    tmp = None

    if data.inlet_pressure_bar is not None and data.retentate_pressure_bar is not None:
        pressure_drop = calculate_pressure_drop(data.inlet_pressure_bar, data.retentate_pressure_bar)
        avg_pressure = calculate_average_feed_pressure(data.inlet_pressure_bar, data.retentate_pressure_bar)
        if data.max_pressure_drop_bar is not None and pressure_drop > data.max_pressure_drop_bar:
            notes.append(
                f"Loop {data.loop_number}: Pressure drop ({pressure_drop:.2f} bar) exceeds "
                f"maximum allowable pressure drop ({data.max_pressure_drop_bar:.2f} bar)."
            )
        if data.max_operating_pressure_bar is not None and data.inlet_pressure_bar > data.max_operating_pressure_bar:
            notes.append(
                f"Loop {data.loop_number}: Inlet pressure ({data.inlet_pressure_bar:.2f} bar) exceeds "
                f"maximum membrane operating pressure ({data.max_operating_pressure_bar:.2f} bar)."
            )
        if data.permeate_pressure_bar is not None:
            tmp = calculate_transmembrane_pressure(avg_pressure, data.permeate_pressure_bar)
    else:
        notes.append(
            f"Loop {data.loop_number}: Inlet and/or retentate pressures not supplied; pressure drop and TMP not evaluated."
        )

    rec_hyd_kw = None
    rec_shaft_kw = None
    pump_evaluated = False
    if (
        data.recirculation_flow_lh is not None
        and data.recirculation_flow_lh > 0
        and pressure_drop is not None
        and data.pump_efficiency is not None
    ):
        _, rec_hyd_kw, _, rec_shaft_kw = calculate_pump_power_si(
            data.recirculation_flow_lh, pressure_drop, data.pump_efficiency
        )
        pump_evaluated = True
    elif data.recirculation_flow_lh is not None:
        notes.append(
            f"Loop {data.loop_number}: Recirculation pump power requires recirculation flow, pressure drop, and pump efficiency."
        )

    return HydraulicLoopResult(
        loop_number=data.loop_number,
        net_feed_flow_lh=data.net_feed_flow_lh,
        recirculation_flow_lh=data.recirculation_flow_lh,
        membrane_feed_flow_lh=membrane_feed_flow,
        flow_per_housing_lh=flow_per_housing,
        inlet_pressure_bar=data.inlet_pressure_bar,
        retentate_pressure_bar=data.retentate_pressure_bar,
        permeate_pressure_bar=data.permeate_pressure_bar,
        pressure_drop_bar=pressure_drop,
        average_feed_pressure_bar=avg_pressure,
        transmembrane_pressure_bar=tmp,
        recirculation_hydraulic_power_kw=rec_hyd_kw,
        recirculation_shaft_power_kw=rec_shaft_kw,
        pump_sizing_evaluated=pump_evaluated,
        hydraulic_status_notes=notes,
    )
