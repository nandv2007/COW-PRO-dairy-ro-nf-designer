"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { api } from "@/lib/api";
import type { ProjectDetail, ProjectSummary } from "@/types/cowpro";

export type SaveStatus = "Saved" | "Unsaved Changes" | "Saving..." | "Error";

interface ProjectContextValue {
  currentProject: ProjectDetail | null;
  projects: ProjectSummary[];
  saveStatus: SaveStatus;
  setSaveStatus: (s: SaveStatus) => void;
  setCurrentProject: (p: ProjectDetail | null) => void;
  loadProject: (id: string) => Promise<ProjectDetail>;
  loadProjectsList: () => Promise<ProjectSummary[]>;
  clearProject: () => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [currentProject, setCurrentProject] = useState<ProjectDetail | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("Saved");

  const loadProject = useCallback(async (id: string) => {
    const res = await api.projects.get(id);
    setCurrentProject(res.project);
    setSaveStatus("Saved");
    return res.project;
  }, []);

  const loadProjectsList = useCallback(async () => {
    const res = await api.projects.list();
    setProjects(res.projects);
    return res.projects;
  }, []);

  const clearProject = useCallback(() => {
    setCurrentProject(null);
    setSaveStatus("Saved");
  }, []);

  return (
    <ProjectContext.Provider
      value={{
        currentProject,
        projects,
        saveStatus,
        setSaveStatus,
        setCurrentProject,
        loadProject,
        loadProjectsList,
        clearProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used inside ProjectProvider");
  return ctx;
}
