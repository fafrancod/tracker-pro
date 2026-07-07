import { useEffect, useCallback } from 'react';
import { useStore } from '../store';
import {
  subscribeProjects,
  createProject,
  updateProject,
  deleteProject,
} from '../services/projectService';
import type { CreateProjectPayload, UpdateProjectPayload, Project } from '../types';

export function useProjects() {
  const uid = useStore(s => s.uid);
  const projects = useStore(s => s.projects);
  const { setProjects, addProjectOptimistic, updateProjectOptimistic, removeProjectOptimistic } =
    useStore();

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeProjects(uid, projects => {
      setProjects(projects);
    });
    return unsub;
  }, [uid, setProjects]);

  const addProject = useCallback(
    async (payload: CreateProjectPayload) => {
      if (!uid) return;
      const created = await createProject(payload);
      // El listener Firestore va a sincronizar; en demo mode (sin listener)
      // el push optimista es la unica forma de que aparezca en pantalla.
      // En real mode el id coincide con el del doc, asi que el listener
      // no introduce duplicados al setProjects-replace.
      addProjectOptimistic(created as Project);
    },
    [uid, addProjectOptimistic]
  );

  const editProject = useCallback(
    async (projectId: string, payload: UpdateProjectPayload) => {
      if (!uid) return;
      updateProjectOptimistic(projectId, payload);
      await updateProject(projectId, payload);
    },
    [uid, updateProjectOptimistic]
  );

  const removeProject = useCallback(
    async (projectId: string) => {
      if (!uid) return;
      removeProjectOptimistic(projectId);
      await deleteProject(projectId);
    },
    [uid, removeProjectOptimistic]
  );

  return { projects, addProject, editProject, removeProject };
}
