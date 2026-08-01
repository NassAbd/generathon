import Link from "next/link";
import { notFound } from "next/navigation";

import { ProjectView } from "@/components/ProjectView";
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
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-violet-300">Project</p>
        <h1 className="mt-4 text-3xl font-bold text-white">Still processing</h1>
        <p className="mt-3 text-slate-400">
          This project is currently <span className="text-white">{project.status}</span>. Return home to watch live progress.
        </p>
        <Link
          href="/"
          className="mt-8 rounded-xl border border-white/15 px-5 py-3 text-sm font-medium text-white transition hover:border-violet-400/50"
        >
          Back to upload
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08090d]">
      <ProjectView project={project} />
    </main>
  );
}
