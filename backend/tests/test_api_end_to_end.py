"""End-to-end API tests: Auth, Project Ownership, Membrane Catalog, Design, Simulation & Reporting."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.database import Base, get_db
from app.db.seed import seed_initial_data
from app.main import app


@pytest.fixture()
def client(tmp_path):
    db_file = tmp_path / "test_cowpro.db"
    engine = create_engine(f"sqlite:///{db_file}", connect_args={"check_same_thread": False})
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    seed_db = TestingSession()
    seed_initial_data(seed_db)
    seed_db.close()

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as tc:
        yield tc
    app.dependency_overrides.clear()


def _register_verify_login(client: TestClient, email: str, password: str, name: str = "Engineer One") -> str:
    reg = client.post(
        "/api/auth/register",
        json={
            "full_name": name,
            "email": email,
            "organization": "Dairy Lab",
            "password": password,
            "confirm_password": password,
        },
    )
    assert reg.status_code == 201
    token = reg.json()["verification_token"]

    # Login before email verification should be rejected
    pre_login = client.post("/api/auth/login", json={"email": email, "password": password})
    assert pre_login.status_code == 403

    ver = client.post("/api/auth/verify-email", json={"token": token})
    assert ver.status_code == 200

    login = client.post("/api/auth/login", json={"email": email, "password": password, "remember_me": True})
    assert login.status_code == 200
    return login.json()["access_token"]


def test_auth_lifecycle_and_password_reset(client: TestClient):
    access_token = _register_verify_login(client, "alice@dairy.org", "StrongPass123!")
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {access_token}"})
    assert me.status_code == 200
    assert me.json()["user"]["email"] == "alice@dairy.org"

    # Password reset
    forgot = client.post("/api/auth/forgot-password", json={"email": "alice@dairy.org"})
    assert forgot.status_code == 200
    reset_tok = forgot.json()["reset_token"]
    reset = client.post(
        "/api/auth/reset-password",
        json={
            "token": reset_tok,
            "new_password": "NewStrongPass456!",
            "confirm_password": "NewStrongPass456!",
        },
    )
    assert reset.status_code == 200

    bad_login = client.post("/api/auth/login", json={"email": "alice@dairy.org", "password": "StrongPass123!"})
    assert bad_login.status_code == 401
    good_login = client.post("/api/auth/login", json={"email": "alice@dairy.org", "password": "NewStrongPass456!"})
    assert good_login.status_code == 200

    logout = client.post("/api/auth/logout")
    assert logout.status_code == 200


def test_membrane_catalog_filters_and_ash_restriction(client: TestClient):
    tok = _register_verify_login(client, "mem@dairy.org", "StrongPass123!")
    headers = {"Authorization": f"Bearer {tok}"}

    all_mem = client.get("/api/membranes", headers=headers)
    assert all_mem.status_code == 200
    assert len(all_mem.json()["membranes"]) == 8

    ro_mem = client.get("/api/membranes?process_type=RO", headers=headers)
    assert len(ro_mem.json()["membranes"]) == 4

    # Ash-based NF restriction overrides process filter to NF only
    ash_mem = client.get("/api/membranes?process_type=RO&ash_supplied=true", headers=headers)
    data = ash_mem.json()
    assert data["ash_restriction_active"] is True
    assert len(data["membranes"]) == 4
    assert all(m["process_type"] == "NF" for m in data["membranes"])

    # Verify unknown properties are NOT fabricated
    m8 = client.get("/api/membranes/8", headers=headers).json()["membrane"]
    assert m8["membrane_area"] == pytest.approx(4.9)
    assert m8["max_pressure"] is None
    assert m8["verification_status"] == "User Supplied"


def test_project_crud_ownership_and_reporting(client: TestClient):
    tok_a = _register_verify_login(client, "usera@dairy.org", "StrongPass123!", "User A")
    tok_b = _register_verify_login(client, "userb@dairy.org", "StrongPass123!", "User B")
    h_a = {"Authorization": f"Bearer {tok_a}"}
    h_b = {"Authorization": f"Bearer {tok_b}"}

    # Create project as User A
    created = client.post(
        "/api/projects",
        headers=h_a,
        json={
            "project_name": "Whole Milk Concentration Trial",
            "description": "Two-loop NF trial",
            "process_type": "NF",
            "milk_type": "Custom Milk",
        },
    )
    assert created.status_code == 201
    proj_id = created.json()["project"]["id"]
    assert created.json()["project"]["status"] == "Draft"

    # Unauthorized access by User B must fail with 403
    assert client.get(f"/api/projects/{proj_id}", headers=h_b).status_code == 403
    assert client.delete(f"/api/projects/{proj_id}", headers=h_b).status_code == 403

    # Save Feed Analysis (Section 27 numbers)
    fa = client.put(
        f"/api/projects/{proj_id}/feed-analysis",
        headers=h_a,
        json={
            "milk_type": "Custom Milk",
            "fat_percentage": 0.0,
            "input_mode": "SNF",
            "snf_percentage": 9.0,
            "flow_input_method": "direct",
            "feed_flow": 1000.0,
            "feed_flow_unit": "L/h",
            "temperature": 10.0,
            "target_basis": "SNF",
            "target_percentage": 18.0,
        },
    )
    assert fa.status_code == 200
    assert fa.json()["concentration"]["concentration_factor"] == pytest.approx(2.0)
    assert fa.json()["loops"]["active_loops"] == 2

    # Save Equipment Design
    eq = client.put(
        f"/api/projects/{proj_id}/equipment-design",
        headers=h_a,
        json={
            "loops": [
                {"loop_number": 1, "membrane_id": 8, "design_flux_lmh": 15.0, "elements_per_housing": 1},
                {"loop_number": 2, "membrane_id": 8, "design_flux_lmh": 10.0, "elements_per_housing": 1},
            ]
        },
    )
    assert eq.status_code == 200
    design = eq.json()["design"]
    assert design["total_membranes"] == 9
    assert design["total_installed_area_m2"] == pytest.approx(44.1)
    assert eq.json()["project"]["status"] == "Validation Required"

    # Duplicate project
    dup = client.post(f"/api/projects/{proj_id}/duplicate", headers=h_a)
    assert dup.status_code == 201
    dup_id = dup.json()["project"]["id"]
    assert dup_id != proj_id

    # PDF & CSV & JSON Export
    pdf_resp = client.post(f"/api/reports/project/{proj_id}/pdf", headers=h_a)
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert pdf_resp.content.startswith(b"%PDF-")

    csv_resp = client.get(f"/api/reports/project/{proj_id}/csv", headers=h_a)
    assert csv_resp.status_code == 200
    assert "44.1000" in csv_resp.text
    assert "Whole Milk Concentration Trial" in csv_resp.text

    json_exp = client.get(f"/api/projects/{proj_id}/export/json", headers=h_a)
    assert json_exp.status_code == 200
    imported = client.post("/api/projects/import/json", headers=h_a, json={"data": json_exp.json()})
    assert imported.status_code == 201

    # Delete duplicated project
    assert client.delete(f"/api/projects/{dup_id}", headers=h_a).status_code == 200
    assert client.get(f"/api/projects/{dup_id}", headers=h_a).status_code == 404
