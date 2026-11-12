"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, FolderPlus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Alert, Button, Card, CardBody, CardHeader, Input, Label, Select } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { api, ApiError } from "@/lib/api";

const newProjectSchema = z.object({
  project_name: z.string().min(2, "Project name is required"),
  description: z.string().optional(),
  customer_organization: z.string().optional(),
  project_location: z.string().optional(),
  design_engineer: z.string().optional(),
  process_type: z.enum(["RO", "NF"]),
  milk_type: z.enum([
    "Skim Milk",
    "Pasteurized Whole Cow Milk",
    "Buffalo Milk",
    "Custom Milk",
  ]),
});

type NewProjectValues = z.infer<typeof newProjectSchema>;

export default function NewProjectPage() {
  const { user } = useAuth();
  const { setCurrentProject } = useProject();
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewProjectValues>({
    resolver: zodResolver(newProjectSchema),
    defaultValues: {
      project_name: "",
      description: "",
      customer_organization: user?.organization || "",
      project_location: "",
      design_engineer: user?.full_name || "",
      process_type: "NF",
      milk_type: "Skim Milk",
    },
  });

  const onSubmit = async (values: NewProjectValues) => {
    setErrorMsg(null);
    try {
      const res = await api.projects.create(values);
      setCurrentProject(res.project);
      router.push(`/projects/${res.project.id}/feed`);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Failed to create project.");
    }
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Create New Engineering Project</h1>
          <p className="text-sm text-slate-500 mt-1">
            Initialize project metadata and select the dairy membrane process. The project is saved immediately as a Draft.
          </p>
        </div>

        {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

        <Card>
          <CardHeader
            title="Project Setup"
            subtitle="Step 1 of 6 — Project Identification & Process Selection"
          />
          <CardBody>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <Label htmlFor="project_name" required>
                  Project Name
                </Label>
                <Input
                  id="project_name"
                  placeholder="e.g., Skim Milk Concentration Plant — Line A"
                  {...register("project_name")}
                />
                {errors.project_name && (
                  <p className="text-xs text-rose-600 mt-1">{errors.project_name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Project Description</Label>
                <textarea
                  id="description"
                  rows={3}
                  placeholder="Describe feed capacity, concentration objectives, and design constraints..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                  {...register("description")}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="process_type" required>
                    Membrane Process
                  </Label>
                  <Select id="process_type" {...register("process_type")}>
                    <option value="NF">Nanofiltration (NF)</option>
                    <option value="RO">Reverse Osmosis (RO)</option>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="milk_type" required>
                    Milk Type
                  </Label>
                  <Select id="milk_type" {...register("milk_type")}>
                    <option value="Skim Milk">Skim Milk</option>
                    <option value="Pasteurized Whole Cow Milk">Pasteurized Whole Cow Milk</option>
                    <option value="Buffalo Milk">Buffalo Milk</option>
                    <option value="Custom Milk">Custom Milk</option>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="customer_organization">Customer / Organization</Label>
                  <Input
                    id="customer_organization"
                    placeholder="Optional"
                    {...register("customer_organization")}
                  />
                </div>
                <div>
                  <Label htmlFor="project_location">Project Location</Label>
                  <Input
                    id="project_location"
                    placeholder="Optional"
                    {...register("project_location")}
                  />
                </div>
                <div>
                  <Label htmlFor="design_engineer">Design Engineer</Label>
                  <Input
                    id="design_engineer"
                    placeholder="Optional"
                    {...register("design_engineer")}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => router.push("/dashboard")}>
                  Cancel
                </Button>
                <Button type="submit" variant="teal" disabled={isSubmitting}>
                  <FolderPlus className="w-4 h-4" />
                  {isSubmitting ? "Saving Draft..." : "Save Draft & Continue to Feed Analysis"}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
