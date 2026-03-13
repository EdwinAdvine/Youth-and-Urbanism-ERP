"""Create project base tables (full schema) — catch-up migration for existing deployments.

This migration ensures all base project tables exist with the full current schema.
It is safe to run on databases where these tables already exist (uses IF NOT EXISTS).
Also creates project_milestones_v2 which was missing from all previous migrations.
Merges heads: z6u7v8w9x0y1 and 842a2ead8709.

Revision ID: proj1a2b3c4d5e
Revises: z6u7v8w9x0y1, 842a2ead8709
Create Date: 2026-03-13 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision = "proj1a2b3c4d5e"
down_revision: Union[str, tuple] = ("z6u7v8w9x0y1", "842a2ead8709")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Core project tables (full current schema) ────────────────────────────
    # All statements use IF NOT EXISTS — safe for both fresh and existing DBs.

    op.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(500) NOT NULL,
            description TEXT,
            owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            start_date TIMESTAMPTZ,
            end_date TIMESTAMPTZ,
            color VARCHAR(20),
            members JSONB DEFAULT '[]',
            version INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_projects_owner_id ON projects (owner_id)")

    # project_tasks includes full Sprint-era columns
    op.execute("""
        CREATE TABLE IF NOT EXISTS project_tasks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            title VARCHAR(500) NOT NULL,
            description TEXT,
            assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'todo',
            priority VARCHAR(20) NOT NULL DEFAULT 'medium',
            due_date TIMESTAMPTZ,
            "order" INTEGER NOT NULL DEFAULT 0,
            tags TEXT[],
            parent_id UUID REFERENCES project_tasks(id) ON DELETE CASCADE,
            start_date TIMESTAMPTZ,
            estimated_hours FLOAT,
            sprint_id UUID,
            recurring_config_id UUID,
            version INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_project_tasks_project_id ON project_tasks (project_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_project_tasks_assignee_id ON project_tasks (assignee_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_project_tasks_parent_id ON project_tasks (parent_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_project_tasks_sprint_id ON project_tasks (sprint_id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS project_milestones (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            title VARCHAR(500) NOT NULL,
            due_date TIMESTAMPTZ,
            is_completed BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_project_milestones_project_id ON project_milestones (project_id)")

    # project_milestones_v2 — enhanced milestone (was missing from ALL prior migrations)
    op.execute("""
        CREATE TABLE IF NOT EXISTS project_milestones_v2 (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            name VARCHAR(500) NOT NULL,
            due_date TIMESTAMPTZ,
            status VARCHAR(20) NOT NULL DEFAULT 'open',
            completed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_project_milestones_v2_project_id ON project_milestones_v2 (project_id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS project_time_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            task_id UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            hours FLOAT NOT NULL,
            description TEXT,
            logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_project_time_logs_task_id ON project_time_logs (task_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_project_time_logs_user_id ON project_time_logs (user_id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS project_task_dependencies (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            task_id UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
            depends_on_id UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
            dependency_type VARCHAR(30) NOT NULL DEFAULT 'finish_to_start',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_project_task_dependencies_task_id ON project_task_dependencies (task_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_project_task_dependencies_depends_on_id ON project_task_dependencies (depends_on_id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS project_task_attachments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            task_id UUID NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
            file_id UUID NOT NULL,
            file_name VARCHAR(500) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_project_task_attachments_task_id ON project_task_attachments (task_id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS project_templates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(500) NOT NULL,
            description TEXT,
            tasks JSONB DEFAULT '[]',
            settings JSONB,
            owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_project_templates_owner_id ON project_templates (owner_id)")

    # ── Add sprint/recurring FKs if the referenced tables now exist ──────────
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_sprints')
               AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_tasks' AND column_name = 'sprint_id')
               AND NOT EXISTS (
                   SELECT 1 FROM information_schema.table_constraints tc
                   JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
                   WHERE tc.constraint_type = 'FOREIGN KEY'
                     AND tc.table_name = 'project_tasks'
                     AND kcu.column_name = 'sprint_id'
               )
            THEN
                ALTER TABLE project_tasks
                    ADD CONSTRAINT fk_project_tasks_sprint_id
                    FOREIGN KEY (sprint_id) REFERENCES project_sprints(id) ON DELETE SET NULL;
            END IF;
        END $$;
    """)

    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_recurring_configs')
               AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_tasks' AND column_name = 'recurring_config_id')
               AND NOT EXISTS (
                   SELECT 1 FROM information_schema.table_constraints tc
                   JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
                   WHERE tc.constraint_type = 'FOREIGN KEY'
                     AND tc.table_name = 'project_tasks'
                     AND kcu.column_name = 'recurring_config_id'
               )
            THEN
                ALTER TABLE project_tasks
                    ADD CONSTRAINT fk_project_tasks_recurring_config_id
                    FOREIGN KEY (recurring_config_id) REFERENCES project_recurring_configs(id) ON DELETE SET NULL;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS project_templates")
    op.execute("DROP TABLE IF EXISTS project_task_attachments")
    op.execute("DROP TABLE IF EXISTS project_task_dependencies")
    op.execute("DROP TABLE IF EXISTS project_time_logs")
    op.execute("DROP TABLE IF EXISTS project_milestones_v2")
    op.execute("DROP TABLE IF EXISTS project_milestones")
    op.execute("DROP TABLE IF EXISTS project_tasks")
    op.execute("DROP TABLE IF EXISTS projects")
