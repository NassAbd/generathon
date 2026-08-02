/**
 * @deprecated Server-side FFmpeg burn-in is deprecated.
 * Use the browser canvas exporter (`lib/export/clientCanvasExporter.ts`)
 * triggered by the Export MP4 button instead.
 */
export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  return Response.json(
    {
      error:
        "Server-side MP4 burn-in is deprecated. Use the in-browser Export MP4 button (canvas + MediaRecorder) for styled captions + audio.",
      deprecated: true,
      clientExporter: "lib/export/clientCanvasExporter.ts",
    },
    {
      status: 410,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function GET(): Promise<Response> {
  return POST();
}
