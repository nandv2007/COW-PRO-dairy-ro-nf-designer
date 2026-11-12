"""SQLAlchemy ORM Models mirroring Section 25 Database Structure."""

import datetime as dt
import uuid
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _uuid_str() -> str:
    return str(uuid.uuid4())


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    organization: Mapped[str | None] = mapped_column(String(255), nullable=True)
    preferred_units: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default=lambda: {"flow": "L/h", "pressure": "bar", "temperature": "C", "area": "m2"},
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    verification_token: Mapped[str | None] = mapped_column(String(128), nullable=True)
    reset_token: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    projects: Mapped[list["Project"]] = relationship(
        "Project", back_populates="owner", cascade="all, delete-orphan"
    )


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    project_code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    customer_organization: Mapped[str | None] = mapped_column(String(255), nullable=True)
    project_location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    design_engineer: Mapped[str | None] = mapped_column(String(255), nullable=True)
    process_type: Mapped[str] = mapped_column(String(10), nullable=False)
    milk_type: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="Draft")
    hydraulics_config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    owner: Mapped["Profile"] = relationship("Profile", back_populates="projects")
    feed_composition: Mapped["FeedComposition | None"] = relationship(
        "FeedComposition", back_populates="project", uselist=False, cascade="all, delete-orphan"
    )
    feed_conditions: Mapped["FeedConditions | None"] = relationship(
        "FeedConditions", back_populates="project", uselist=False, cascade="all, delete-orphan"
    )
    concentration_design: Mapped["ConcentrationDesign | None"] = relationship(
        "ConcentrationDesign", back_populates="project", uselist=False, cascade="all, delete-orphan"
    )
    loop_designs: Mapped[list["LoopDesign"]] = relationship(
        "LoopDesign", back_populates="project", cascade="all, delete-orphan", order_by="LoopDesign.loop_number"
    )
    simulations: Mapped[list["Simulation"]] = relationship(
        "Simulation", back_populates="project", cascade="all, delete-orphan", order_by="Simulation.created_at.desc()"
    )
    reports: Mapped[list["Report"]] = relationship(
        "Report", back_populates="project", cascade="all, delete-orphan", order_by="Report.generated_at.desc()"
    )


class FeedComposition(Base):
    __tablename__ = "feed_composition"
    __table_args__ = (
        CheckConstraint("fat_percentage >= 0 AND fat_percentage <= 100", name="ck_fat_range"),
        CheckConstraint("snf_percentage >= 0 AND snf_percentage <= 100", name="ck_snf_range"),
        CheckConstraint("total_solids_percentage >= fat_percentage", name="ck_ts_gte_fat"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    milk_type: Mapped[str] = mapped_column(String(64), nullable=False)
    input_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="SNF")
    fat_percentage: Mapped[float] = mapped_column(Float, nullable=False)
    snf_percentage: Mapped[float] = mapped_column(Float, nullable=False)
    total_solids_percentage: Mapped[float] = mapped_column(Float, nullable=False)
    protein_percentage: Mapped[float | None] = mapped_column(Float, nullable=True)
    lactose_percentage: Mapped[float | None] = mapped_column(Float, nullable=True)
    ash_percentage: Mapped[float | None] = mapped_column(Float, nullable=True)
    other_solids_percentage: Mapped[float | None] = mapped_column(Float, nullable=True)
    individual_minerals: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    ash_design_supplied: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    composition_basis: Mapped[str] = mapped_column(String(64), nullable=False, default="% w/w (mass basis)")
    value_sources: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    project: Mapped["Project"] = relationship("Project", back_populates="feed_composition")


class FeedConditions(Base):
    __tablename__ = "feed_conditions"
    __table_args__ = (CheckConstraint("feed_flow > 0", name="ck_feed_flow_positive"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    flow_input_method: Mapped[str] = mapped_column(String(20), nullable=False, default="direct")
    feed_flow: Mapped[float] = mapped_column(Float, nullable=False)
    feed_flow_unit: Mapped[str] = mapped_column(String(16), nullable=False, default="L/h")
    processing_capacity: Mapped[float | None] = mapped_column(Float, nullable=True)
    capacity_unit: Mapped[str | None] = mapped_column(String(16), nullable=True)
    operating_time: Mapped[float | None] = mapped_column(Float, nullable=True)
    temperature: Mapped[float] = mapped_column(Float, nullable=False, default=10.0)
    ph: Mapped[float | None] = mapped_column(Float, nullable=True)
    density: Mapped[float | None] = mapped_column(Float, nullable=True)
    viscosity: Mapped[float | None] = mapped_column(Float, nullable=True)
    conductivity: Mapped[float | None] = mapped_column(Float, nullable=True)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    project: Mapped["Project"] = relationship("Project", back_populates="feed_conditions")


class ConcentrationDesign(Base):
    __tablename__ = "concentration_design"
    __table_args__ = (
        CheckConstraint("concentration_factor >= 1", name="ck_cf_gte_1"),
        CheckConstraint("permeate_removal >= 0", name="ck_permeate_nonnegative"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    target_basis: Mapped[str] = mapped_column(String(24), nullable=False, default="SNF")
    initial_percentage: Mapped[float] = mapped_column(Float, nullable=False)
    target_percentage: Mapped[float] = mapped_column(Float, nullable=False)
    concentration_factor: Mapped[float] = mapped_column(Float, nullable=False)
    permeate_removal: Mapped[float] = mapped_column(Float, nullable=False)
    total_permeate_volume: Mapped[float | None] = mapped_column(Float, nullable=True)
    final_retentate_flow: Mapped[float] = mapped_column(Float, nullable=False)
    selected_loops: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    project: Mapped["Project"] = relationship("Project", back_populates="concentration_design")


class Membrane(Base):
    __tablename__ = "membranes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    manufacturer: Mapped[str] = mapped_column(String(255), nullable=False)
    model: Mapped[str] = mapped_column(String(128), nullable=False)
    full_model_number: Mapped[str | None] = mapped_column(String(255), nullable=True)
    process_type: Mapped[str] = mapped_column(String(10), nullable=False)
    nominal_size: Mapped[str] = mapped_column(String(32), nullable=False)
    membrane_area: Mapped[float] = mapped_column(Float, nullable=False)
    membrane_material: Mapped[str | None] = mapped_column(String(128), nullable=True)
    feed_spacer_thickness: Mapped[float | None] = mapped_column(Float, nullable=True)
    mwco: Mapped[str | None] = mapped_column(String(64), nullable=True)
    design_flux: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_pressure: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_temperature: Mapped[float | None] = mapped_column(Float, nullable=True)
    operating_ph_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    operating_ph_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    cleaning_ph_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    cleaning_ph_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_pressure_drop: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_feed_flow: Mapped[float | None] = mapped_column(Float, nullable=True)
    salt_rejection: Mapped[str | None] = mapped_column(String(64), nullable=True)
    mineral_rejection: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ash_rejection_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    datasheet_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    verification_status: Mapped[str] = mapped_column(String(64), nullable=False, default="Unknown")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    properties: Mapped[list["MembraneProperty"]] = relationship(
        "MembraneProperty", back_populates="membrane", cascade="all, delete-orphan"
    )


class MembraneProperty(Base):
    __tablename__ = "membrane_properties"
    __table_args__ = (UniqueConstraint("membrane_id", "property_name", name="uq_membrane_prop_name"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    membrane_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("membranes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    property_name: Mapped[str] = mapped_column(String(128), nullable=False)
    property_value: Mapped[str | None] = mapped_column(String(255), nullable=True)
    property_unit: Mapped[str | None] = mapped_column(String(64), nullable=True)
    data_source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    verification_status: Mapped[str] = mapped_column(String(64), nullable=False, default="Unknown")

    membrane: Mapped["Membrane"] = relationship("Membrane", back_populates="properties")


class LoopDesign(Base):
    __tablename__ = "loop_designs"
    __table_args__ = (
        UniqueConstraint("project_id", "loop_number", name="uq_project_loop"),
        CheckConstraint("loop_number IN (1, 2)", name="ck_loop_number"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    loop_number: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    feed_flow: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    permeate_flow: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    retentate_flow: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    membrane_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("membranes.id"), nullable=True)
    membrane_flux: Mapped[float | None] = mapped_column(Float, nullable=True)
    flux_source: Mapped[str] = mapped_column(String(64), nullable=False, default="User Supplied")
    membrane_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    installed_area: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    housing_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    elements_per_housing: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    housing_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    housing_pressure_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_elements_per_housing: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_housing_feed_flow: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_housing_pressure_drop: Mapped[float | None] = mapped_column(Float, nullable=True)
    recirculation_flow: Mapped[float | None] = mapped_column(Float, nullable=True)
    inlet_pressure: Mapped[float | None] = mapped_column(Float, nullable=True)
    retentate_pressure: Mapped[float | None] = mapped_column(Float, nullable=True)
    permeate_pressure: Mapped[float | None] = mapped_column(Float, nullable=True)
    pump_efficiency: Mapped[float | None] = mapped_column(Float, nullable=True)

    project: Mapped["Project"] = relationship("Project", back_populates="loop_designs")


class Simulation(Base):
    __tablename__ = "simulations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    simulation_type: Mapped[str] = mapped_column(String(32), nullable=False, default="Level 1")
    input_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    result_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    validation_status: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    project: Mapped["Project"] = relationship("Project", back_populates="simulations")


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    simulation_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("simulations.id", ondelete="SET NULL"), nullable=True
    )
    report_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    report_format: Mapped[str] = mapped_column(String(16), nullable=False, default="PDF")
    generated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    project: Mapped["Project"] = relationship("Project", back_populates="reports")
