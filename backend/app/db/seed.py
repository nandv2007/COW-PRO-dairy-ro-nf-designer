"""Database seeding for COW PRO Version 1: 8 Initial Membranes & Section 27 Demo Project."""

import uuid
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth.security import hash_password
from ..engine.orchestrator import LoopConfigInput, run_full_design_pipeline
from ..engine.types import (
    CompositionInput,
    FeedConditionsInput,
    MilkType,
    ProcessType,
    VerificationStatus,
)
from .models import (
    ConcentrationDesign,
    FeedComposition,
    FeedConditions,
    LoopDesign,
    Membrane,
    MembraneProperty,
    Profile,
    Project,
    Simulation,
)


INITIAL_MEMBRANES = [
    {
        "id": 1,
        "manufacturer": "Preliminary Reference (Unverified Manufacturer)",
        "model": "8038 AEM2-31",
        "full_model_number": "8038 AEM2-31 (Suffix pending confirmation)",
        "process_type": "RO",
        "nominal_size": "8038",
        "membrane_area": 33.0,
        "verification_status": VerificationStatus.USER_SUPPLIED.value,
        "notes": "Preliminary transcription from supplied handwritten reference. Confirm model identifier and effective area against manufacturer datasheet before marking Manufacturer Verified.",
    },
    {
        "id": 2,
        "manufacturer": "Preliminary Reference (Unverified Manufacturer)",
        "model": "8038 AEM2-46",
        "full_model_number": "8038 AEM2-46 (Suffix pending confirmation)",
        "process_type": "RO",
        "nominal_size": "8038",
        "membrane_area": 26.9,
        "verification_status": VerificationStatus.USER_SUPPLIED.value,
        "notes": "Preliminary transcription from supplied handwritten reference. Confirm model identifier and effective area against manufacturer datasheet before marking Manufacturer Verified.",
    },
    {
        "id": 3,
        "manufacturer": "Preliminary Reference (Unverified Manufacturer)",
        "model": "3838 AEM2-31",
        "full_model_number": "3838 AEM2-31 (Suffix pending confirmation)",
        "process_type": "RO",
        "nominal_size": "3838",
        "membrane_area": 6.5,
        "verification_status": VerificationStatus.USER_SUPPLIED.value,
        "notes": "Preliminary transcription from supplied handwritten reference. Confirm model identifier and effective area against manufacturer datasheet before marking Manufacturer Verified.",
    },
    {
        "id": 4,
        "manufacturer": "Preliminary Reference (Unverified Manufacturer)",
        "model": "3838 AEM2-46",
        "full_model_number": "3838 AEM2-46 (Suffix pending confirmation)",
        "process_type": "RO",
        "nominal_size": "3838",
        "membrane_area": 4.9,
        "verification_status": VerificationStatus.USER_SUPPLIED.value,
        "notes": "Preliminary transcription from supplied handwritten reference. Confirm model identifier and effective area against manufacturer datasheet before marking Manufacturer Verified.",
    },
    {
        "id": 5,
        "manufacturer": "Preliminary Reference (Unverified Manufacturer)",
        "model": "8038 TS40",
        "full_model_number": "8038 TS40 (33 m² variant - suffix pending confirmation)",
        "process_type": "NF",
        "nominal_size": "8038",
        "membrane_area": 33.0,
        "verification_status": VerificationStatus.USER_SUPPLIED.value,
        "notes": "Preliminary transcription from supplied handwritten reference. Separate database ID from 26.9 m² 8038 TS40 entry.",
    },
    {
        "id": 6,
        "manufacturer": "Preliminary Reference (Unverified Manufacturer)",
        "model": "8038 TS40",
        "full_model_number": "8038 TS40 (26.9 m² variant - suffix pending confirmation)",
        "process_type": "NF",
        "nominal_size": "8038",
        "membrane_area": 26.9,
        "verification_status": VerificationStatus.USER_SUPPLIED.value,
        "notes": "Preliminary transcription from supplied handwritten reference. Separate database ID from 33 m² 8038 TS40 entry.",
    },
    {
        "id": 7,
        "manufacturer": "Preliminary Reference (Unverified Manufacturer)",
        "model": "3838 TS40",
        "full_model_number": "3838 TS40 (6.5 m² variant - suffix pending confirmation)",
        "process_type": "NF",
        "nominal_size": "3838",
        "membrane_area": 6.5,
        "verification_status": VerificationStatus.USER_SUPPLIED.value,
        "notes": "Preliminary transcription from supplied handwritten reference. Separate database ID from 4.9 m² 3838 TS40 entry.",
    },
    {
        "id": 8,
        "manufacturer": "TurboClean (Unverified Datasheet)",
        "model": "3838 TS40",
        "full_model_number": "3838-TS40-46 (Pending datasheet confirmation)",
        "process_type": "NF",
        "nominal_size": "3838",
        "membrane_area": 4.9,
        "verification_status": VerificationStatus.USER_SUPPLIED.value,
        "notes": "Initial demonstration membrane (TurboClean NF 3838 TS40, 4.9 m²). Specific designation 3838-TS40-46 must be confirmed against current manufacturer datasheet.",
    },
]

STANDARD_PROPERTY_TEMPLATES = [
    ("Effective Membrane Area", "m²"),
    ("Feed Spacer Thickness", "mil"),
    ("Molecular Weight Cutoff", "Da"),
    ("Maximum Operating Pressure", "bar"),
    ("Maximum Operating Temperature", "°C"),
    ("Operating pH Range", "pH"),
    ("Cleaning pH Range", "pH"),
    ("Maximum Pressure Drop", "bar"),
    ("Maximum Feed Flow", "m³/h"),
    ("Salt Rejection", "%"),
    ("Mineral Rejection", "%"),
]


def ensure_membranes_seeded(db: Session) -> None:
    """Seed the exact 8 initial membranes from Section 13.1 without fabricating unknown specs."""
    existing_ids = {m.id for m in db.query(Membrane.id).all()}
    for item in INITIAL_MEMBRANES:
        if item["id"] in existing_ids:
            continue
        membrane = Membrane(**item)
        db.add(membrane)
        db.flush()
        for prop_name, prop_unit in STANDARD_PROPERTY_TEMPLATES:
            is_area = prop_name == "Effective Membrane Area"
            db.add(
                MembraneProperty(
                    membrane_id=membrane.id,
                    property_name=prop_name,
                    property_value=str(item["membrane_area"]) if is_area else None,
                    property_unit=prop_unit,
                    data_source="Supplied handwritten reference" if is_area else None,
                    verification_status=(
                        VerificationStatus.USER_SUPPLIED.value
                        if is_area
                        else VerificationStatus.UNKNOWN.value
                    ),
                )
            )
    db.commit()
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        db.execute(
            text(
                "SELECT setval(pg_get_serial_sequence('membranes', 'id'), "
                "COALESCE((SELECT MAX(id) FROM membranes), 1), true)"
            )
        )
        db.commit()


def create_demo_project_for_user(
    db: Session,
    user_id: str,
    engineer_name: str = "Demo Dairy Process Engineer",
) -> Project:
    """Create the Section 27 Example Design Case via the live calculation engine."""
    membranes = {
        m.id: {
            "id": m.id,
            "model": m.model,
            "process_type": m.process_type,
            "nominal_size": m.nominal_size,
            "membrane_area": m.membrane_area,
            "verification_status": m.verification_status,
            "notes": m.notes,
            "max_temperature": m.max_temperature,
            "max_pressure": m.max_pressure,
            "operating_ph_min": m.operating_ph_min,
            "operating_ph_max": m.operating_ph_max,
            "max_pressure_drop": m.max_pressure_drop,
            "max_feed_flow": m.max_feed_flow,
            "salt_rejection": m.salt_rejection,
            "mineral_rejection": m.mineral_rejection,
        }
        for m in db.query(Membrane).all()
    }

    comp_input = CompositionInput(
        milk_type=MilkType.CUSTOM,
        fat_percentage=0.0,
        input_mode="SNF",
        snf_percentage=9.0,
        ash_design_supplied=False,
    )
    feed_input = FeedConditionsInput(
        flow_input_method="direct",
        feed_flow=1000.0,
        feed_flow_unit="L/h",
        temperature=10.0,
    )
    loop_configs = {
        1: LoopConfigInput(
            loop_number=1,
            membrane_id=8,
            design_flux_lmh=15.0,
            flux_source=VerificationStatus.USER_SUPPLIED,
            elements_per_housing=1,
            housing_type="Sanitary 3.8\" Stainless Vessel (3838)",
        ),
        2: LoopConfigInput(
            loop_number=2,
            membrane_id=8,
            design_flux_lmh=10.0,
            flux_source=VerificationStatus.USER_SUPPLIED,
            elements_per_housing=1,
            housing_type="Sanitary 3.8\" Stainless Vessel (3838)",
        ),
    }

    design = run_full_design_pipeline(
        process_type=ProcessType.NF,
        composition_input=comp_input,
        feed_input=feed_input,
        target_basis="SNF",
        target_percentage=18.0,
        loop_configs=loop_configs,
        membrane_records=membranes,
    )

    short_hex = uuid.uuid4().hex[:6].upper()
    project = Project(
        project_code=f"COW-DEMO-{short_hex}",
        user_id=user_id,
        project_name="Section 27 Demo — NF 3838 TS40 (CF = 2)",
        description=(
            "COW PRO Version 1 demonstration project (Section 27): 1,000 L/h Custom Milk "
            "concentrated to CF = 2 using TurboClean NF 3838 TS40 (4.9 m²) with illustrative "
            "fluxes 15 LMH (Loop 1) and 10 LMH (Loop 2)."
        ),
        customer_organization="COW PRO Reference Plant",
        project_location="Preliminary Engineering Study",
        design_engineer=engineer_name,
        process_type="NF",
        milk_type="Custom Milk",
        status="Validation Required",
        hydraulics_config={},
    )
    db.add(project)
    db.flush()

    db.add(
        FeedComposition(
            project_id=project.id,
            milk_type="Custom Milk",
            input_mode="SNF",
            fat_percentage=design.composition.fat_percentage,
            snf_percentage=design.composition.snf_percentage,
            total_solids_percentage=design.composition.total_solids_percentage,
            ash_design_supplied=False,
            composition_basis=design.composition.composition_basis,
            value_sources=design.composition.value_sources,
        )
    )
    db.add(
        FeedConditions(
            project_id=project.id,
            flow_input_method="direct",
            feed_flow=design.feed.feed_flow_lh,
            feed_flow_unit="L/h",
            temperature=design.feed.temperature_c,
        )
    )
    db.add(
        ConcentrationDesign(
            project_id=project.id,
            target_basis="SNF",
            initial_percentage=design.concentration.initial_percentage,
            target_percentage=design.concentration.target_percentage,
            concentration_factor=design.concentration.concentration_factor,
            permeate_removal=design.concentration.total_permeate_removal_lh,
            total_permeate_volume=design.concentration.total_permeate_volume_l,
            final_retentate_flow=design.concentration.final_retentate_flow_lh,
            selected_loops=design.loops.active_loops,
        )
    )

    sizing_map = {s.loop_number: s for s in design.loop_sizings}
    loop_flows = {
        1: (design.loops.loop1_feed_flow_lh, design.loops.loop1_permeate_flow_lh, design.loops.loop1_retentate_flow_lh, design.loops.loop1_active),
        2: (design.loops.loop2_feed_flow_lh, design.loops.loop2_permeate_flow_lh, design.loops.loop2_retentate_flow_lh, design.loops.loop2_active),
    }
    for loop_num in (1, 2):
        f_flow, p_flow, r_flow, is_act = loop_flows[loop_num]
        s = sizing_map.get(loop_num)
        db.add(
            LoopDesign(
                project_id=project.id,
                loop_number=loop_num,
                is_active=is_act,
                feed_flow=f_flow,
                permeate_flow=p_flow,
                retentate_flow=r_flow,
                membrane_id=s.membrane_id if s else 8,
                membrane_flux=s.design_flux_lmh if s else None,
                flux_source=s.flux_source if s else "User Supplied",
                membrane_count=s.membrane_count if s else 0,
                installed_area=s.installed_area_m2 if s else 0.0,
                housing_count=s.housing_count if s else 0,
                elements_per_housing=s.elements_per_housing if s else 1,
                housing_type="Sanitary 3.8\" Stainless Vessel (3838)",
            )
        )

    db.add(
        Simulation(
            project_id=project.id,
            simulation_type="Level 1",
            input_snapshot={
                "process_type": "NF",
                "feed_flow_lh": 1000.0,
                "concentration_factor": 2.0,
                "loop1_flux_lmh": 15.0,
                "loop2_flux_lmh": 10.0,
                "membrane_id": 8,
            },
            result_snapshot=design.model_dump(mode="json"),
            validation_status=design.validation.overall_status.value,
        )
    )
    db.commit()
    db.refresh(project)
    return project


def seed_initial_data(db: Session) -> None:
    """Ensure initial 8 membranes and demonstration engineer + Section 27 project exist."""
    ensure_membranes_seeded(db)

    demo_email = "engineer@cowpro.dev"
    demo_user = db.query(Profile).filter(Profile.email == demo_email).first()
    if demo_user is None:
        demo_user = Profile(
            full_name="Dr. Elena Vance (Demo Engineer)",
            email=demo_email,
            organization="COW PRO Dairy Process Engineering Lab",
            password_hash=hash_password("CowProDemo2026!"),
            email_verified=True,
        )
        db.add(demo_user)
        db.commit()
        db.refresh(demo_user)
        create_demo_project_for_user(db, demo_user.id, demo_user.full_name)
