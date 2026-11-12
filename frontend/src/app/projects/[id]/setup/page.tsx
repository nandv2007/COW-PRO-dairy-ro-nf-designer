"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Save } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert, Button, Card, CardBody, CardHeader, Input, Label, Select } from "@/components/ui";
import { useProject } from "@/context/ProjectContext";
import { api, ApiError } from "@/lib/api";
import type { MilkType, ProcessType } from "@/types/cowpro";

export default function ProjectSetupPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { currentProject, loadProject, setCurrentProject } = useProject();
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [customerOrg, setCustomerOrg] = useState("");
  const [location, setLocation] = useState("");
  const [engineer, setEngineer] = useState("");
  const [processType, setProcessType] = useState<ProcessType>("NF");
  const [milkType, setMilkType] = useState<MilkType>("Custom Milk");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      loadProject(params.id)
        .then((p) => {
          setProjectName(p.project_name);
          setDescription(p.description || "");
          setCustomerOrg(p.customer_organization || "");
          setLocation(p.project_location || "");
          setEngineer(p.design_engineer || "");
          setProcessType(p.process_type);
          setMilkType(p.milk_type);
        })
        .catch((err) => setErrorMsg(err instanceof ApiError ? err.message : "Failed to load project."));
    }
  }, [params.id, loadProject]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!params.id) return;
    setSaving(true);
    setErrorMsg(null);
    setNotice(null);
    try {
      const res = await api.projects.update(params.id, {
        project_name: projectName,
        description,
        customer_organization: customerOrg,
        project_location: location,
        design_engineer: engineer,
        process_type: processType,
        milk_type: milkType,
      });
      setCurrentProject(res.project);
      setNotice("Project setup saved.");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Could not update project.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell activeStep="setup">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Project Setup</h1>
            <p className="text-sm text-slate-500">
              {currentProject?.project_code} — Edit metadata, selected process, and milk basis.
            </p>
          </div>
          <Button variant="teal" onClick={() => router.push(`/projects/${params.id}/feed`)}>
            Feed Analysis <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        {notice && <Alert variant="success">{notice}</Alert>}
        {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

        <Card>
          <CardHeader title="Project Metadata" subtitle="Changes persist immediately to your workspace" />
          <CardBody>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <Label required>Project Name</Label>
                <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} required />
              </div>
              <div>
                <Label>Project Description</Label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label required>Membrane Process</Label>
                  <Select value={processType} onChange={(e) => setProcessType(e.target.value as ProcessType)}>
                    <option value="NF">Nanofiltration (NF)</option>
                    <option value="RO">Reverse Osmosis (RO)</option>
                  </Select>
                </div>
                <div>
                  <Label required>Milk Type</Label>
                  <Select value={milkType} onChange={(e) => setMilkType(e.target.value as MilkType)}>
                    <option value="Skim Milk">Skim Milk</option>
                    <option value="Pasteurized Whole Cow Milk">Pasteurized Whole Cow Milk</option>
                    <option value="Buffalo Milk">Buffalo Milk</option>
                    <option value="Custom Milk">Custom Milk</option>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>Customer / Organization</Label>
                  <Input value={customerOrg} onChange={(e) => setCustomerOrg(e.target.value)} />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>
                <div>
                  <Label>Design Engineer</Label>
                  <Input value={engineer} onChange={(e) => setEngineer(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="submit" variant="primary" disabled={saving}>
                  <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Changes"}
                </Button>
                <Button type="button" variant="teal" onClick={() => router.push(`/projects/${params.id}/feed`)}>
                  Continue to Feed Analysis <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
