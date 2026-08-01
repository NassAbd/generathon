import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { TranscriptData } from "@/types/transcript";

export type ProjectStatus =
  | "uploading"
  | "transcribing"
  | "decorating"
  | "completed"
  | "failed";

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          capcut_draft_url: string | null;
          created_at: string;
          duration_seconds: number | null;
          id: string;
          status: ProjectStatus;
          theme: string | null;
          transcript_data: TranscriptData | null;
          video_url: string;
        };
        Insert: {
          capcut_draft_url?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          status?: ProjectStatus;
          theme?: string | null;
          transcript_data?: TranscriptData | null;
          video_url: string;
        };
        Update: {
          capcut_draft_url?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          status?: ProjectStatus;
          theme?: string | null;
          transcript_data?: TranscriptData | null;
          video_url?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

let browserClient: SupabaseClient<Database> | undefined;

function getSupabaseConfig(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return { url, anonKey };
}

/** Returns a singleton browser client configured from public environment variables. */
export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (!browserClient) {
    const { url, anonKey } = getSupabaseConfig();
    browserClient = createClient<Database>(url, anonKey);
  }

  return browserClient;
}
