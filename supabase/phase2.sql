-- Phase 2: assets bucket, Realtime, and server-side update support.
-- Run after phase1.sql in the Supabase SQL editor.

insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do update set public = true;

create policy "public asset reads"
on storage.objects for select to anon
using (bucket_id = 'assets');

alter publication supabase_realtime add table public.projects;

-- Service role bypasses RLS for /api/process-video status + transcript updates.
-- If you later add authenticated users, scope updates to project owners.
