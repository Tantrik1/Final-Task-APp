-- Phase 1: Create trigger for new projects
CREATE TRIGGER on_project_created_add_default_statuses
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_project_statuses();

-- Phase 2: Backfill statuses for existing projects that have none
INSERT INTO project_statuses (project_id, name, color, position, is_default, is_completed)
SELECT p.id, 'To Do', '#94a3b8', 0, true, false
FROM projects p
WHERE NOT EXISTS (SELECT 1 FROM project_statuses ps WHERE ps.project_id = p.id);

INSERT INTO project_statuses (project_id, name, color, position, is_default, is_completed)
SELECT p.id, 'In Progress', '#f97316', 1, false, false
FROM projects p
WHERE NOT EXISTS (SELECT 1 FROM project_statuses ps WHERE ps.project_id = p.id AND ps.name = 'In Progress');

INSERT INTO project_statuses (project_id, name, color, position, is_default, is_completed)
SELECT p.id, 'Review', '#8b5cf6', 2, false, false
FROM projects p
WHERE NOT EXISTS (SELECT 1 FROM project_statuses ps WHERE ps.project_id = p.id AND ps.name = 'Review');

INSERT INTO project_statuses (project_id, name, color, position, is_default, is_completed)
SELECT p.id, 'Done', '#22c55e', 3, false, true
FROM projects p
WHERE NOT EXISTS (SELECT 1 FROM project_statuses ps WHERE ps.project_id = p.id AND ps.name = 'Done');

-- Phase 3: Fix orphaned tasks - assign them to their project's default status
UPDATE tasks t
SET custom_status_id = (
  SELECT ps.id FROM project_statuses ps 
  WHERE ps.project_id = t.project_id 
  AND ps.is_default = true
  LIMIT 1
)
WHERE t.custom_status_id IS NULL
AND EXISTS (
  SELECT 1 FROM project_statuses ps 
  WHERE ps.project_id = t.project_id 
  AND ps.is_default = true
);