-- Run this in the Supabase SQL editor before using the browser uploader.
-- The `videos` bucket must be public because the app stores public video URLs.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  video_url text not null,
  status text check (status in ('uploading', 'transcribing', 'decorating', 'completed', 'failed')) default 'uploading',
  theme text default 'pop_3d',
  transcript_data jsonb,
  duration_seconds float,
  capcut_draft_url text,
  selected_bgm_track text,
  selected_bgm_url text
);

insert into storage.buckets (id, name, public)
values ('videos', 'videos', true)
on conflict (id) do update set public = true;

alter table public.projects enable row level security;

-- Phase 1 permits anonymous upload. Replace these with user-scoped policies once Auth is enabled.
create policy "anonymous project creation"
on public.projects for insert to anon
with check (status = 'uploading');

create policy "anonymous project reads"
on public.projects for select to anon
using (true);

create policy "anonymous video uploads"
on storage.objects for insert to anon
with check (bucket_id = 'videos');

create policy "anonymous video deletion"
on storage.objects for delete to anon
using (bucket_id = 'videos');
