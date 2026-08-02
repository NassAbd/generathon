import Link from "next/link";
import { notFound } from "next/navigation";

import { ProjectView } from "@/components/ProjectView";
import { AppHeader } from "@/components/studio/AppHeader";
import { fetchProjectById } from "@/lib/projects/fetchProject";

interface ProjectPageProps {
  params: { id: string };
}

export default async function ProjectPage({ params }: ProjectPageProps): Promise<JSX.Element> {
  const project = await fetchProjectById(params.id);

  if (!project) {
    notFound();
  }

  if (project.status !== "completed" || !project.transcript_data?.length) {
    return (
      <main className="flex min-h-dvh flex-col">
        <AppHeader />
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Project
          </p>
          <h1 className="mt-4 font-display text-3xl font-bold">Still processing</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This project is currently <span className="text-foreground">{project.status}</span>. Return
            home to watch live progress.
          </p>
          <Link
            href="/"
            className="mt-8 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium transition hover:bg-accent"
          >
            Back to upload
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen max-h-screen overflow-hidden bg-background">
      <ProjectView project={project} />
    </main>
  );
}
