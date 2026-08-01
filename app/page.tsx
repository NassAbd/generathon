import { HomeWorkflow } from "@/components/HomeWorkflow";

export default function HomePage(): JSX.Element {
  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-6 py-16">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_20%,rgba(124,58,237,0.2),transparent_36rem)]" />
      <div className="w-full max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-violet-300">Motion Decorator</p>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-6xl">Make every word move.</h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">Upload a clip to turn its speech into dynamic subtitles, kinetic type, and visual hooks.</p>
        <div className="mt-10 flex flex-col items-center"><HomeWorkflow /></div>
      </div>
    </main>
  );
}
