"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Save, User } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert, Button, Card, CardBody, CardHeader, Input, Label, Select } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";

export default function SettingsPage() {
  const { user, setUser, updateUnits, logout } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [organization, setOrganization] = useState(user?.organization || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setErrorMsg(null);
    try {
      const res = await api.auth.updateMe({ full_name: fullName, organization });
      setUser(res.user);
      setMessage("Profile updated successfully.");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to update profile.");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setErrorMsg(null);
    try {
      const res = await api.auth.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage(res.message);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to change password.");
    }
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Account &amp; Engineering Preferences</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your engineer profile, password, and display unit defaults.
          </p>
        </div>

        {message && <Alert variant="success">{message}</Alert>}
        {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

        <Card>
          <CardHeader title="Engineer Profile" subtitle="Account identity & affiliation" />
          <CardBody>
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Full Name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div>
                  <Label>Email Address</Label>
                  <Input value={user?.email || ""} disabled />
                </div>
              </div>
              <div>
                <Label>Organization / Institution</Label>
                <Input
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <Button type="submit" variant="teal">
                <Save className="w-4 h-4" /> Save Profile
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Preferred Display Units" subtitle="Used across results, PFD, and dashboards" />
          <CardBody className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Flow Rate</Label>
              <Select
                value={user?.preferred_units?.flow || "L/h"}
                onChange={(e) => updateUnits({ flow: e.target.value as "L/h" | "m3/h" })}
              >
                <option value="L/h">L/h (Liters per hour)</option>
                <option value="m3/h">m³/h (Cubic meters per hour)</option>
              </Select>
            </div>
            <div>
              <Label>Pressure</Label>
              <Select
                value={user?.preferred_units?.pressure || "bar"}
                onChange={(e) => updateUnits({ pressure: e.target.value as "bar" | "kPa" | "psi" })}
              >
                <option value="bar">bar</option>
                <option value="kPa">kPa</option>
                <option value="psi">psi</option>
              </Select>
            </div>
            <div>
              <Label>Temperature</Label>
              <Select
                value={user?.preferred_units?.temperature || "C"}
                onChange={(e) => updateUnits({ temperature: e.target.value as "C" | "F" })}
              >
                <option value="C">°C (Celsius)</option>
                <option value="F">°F (Fahrenheit)</option>
              </Select>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Security & Password" subtitle="Change your account password" />
          <CardBody>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <Label>Current Password</Label>
                <Input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>New Password</Label>
                  <Input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Confirm New Password</Label>
                  <Input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <Button type="submit" variant="primary">
                  <KeyRound className="w-4 h-4" /> Change Password
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={async () => {
                    await logout();
                    router.push("/login");
                  }}
                >
                  <User className="w-4 h-4" /> Sign Out
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
