import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  formatFlow,
  formatPressure,
  formatTemp,
  projectStatusColor,
  validationStatusColor,
} from "@/lib/utils";
import LoginPage from "@/app/login/page";
import { AuthProvider } from "@/context/AuthContext";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe("COW PRO Unit Formatting & Status Helpers", () => {
  it("converts flow units accurately between L/h and m3/h", () => {
    expect(formatFlow(1000, "L/h", 0)).toContain("1,000 L/h");
    expect(formatFlow(1000, "m3/h", 2)).toBe("1.000 m³/h");
  });

  it("converts pressure units accurately between bar, kPa, and psi", () => {
    expect(formatPressure(10, "bar")).toBe("10.00 bar");
    expect(formatPressure(10, "kPa")).toBe("1000.0 kPa");
    expect(formatPressure(1, "psi")).toBe("14.5 psi");
  });

  it("converts temperature units accurately between C and F", () => {
    expect(formatTemp(10, "C")).toBe("10.0 °C");
    expect(formatTemp(10, "F")).toBe("50.0 °F");
  });

  it("maps project and validation status badges distinctly", () => {
    expect(projectStatusColor("Validation Required")).toContain("amber");
    expect(projectStatusColor("Validated")).toContain("emerald");
    expect(validationStatusColor("Not Evaluated")).toContain("slate");
    expect(validationStatusColor("Failed")).toContain("rose");
  });
});

describe("COW PRO Login Page", () => {
  it("renders COW PRO branding, form controls, remember session, and create account link", () => {
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );
    expect(screen.getByText("COW PRO")).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i, { selector: "input" })).toBeInTheDocument();
    expect(screen.getByText(/Remember session/i)).toBeInTheDocument();
    expect(screen.getByText(/Forgot password\?/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Login to COW PRO/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Create an engineering account/i })).toBeInTheDocument();
  });
});
