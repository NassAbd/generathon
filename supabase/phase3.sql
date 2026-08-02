-- Phase 3: persist selected BGM so web preview and CapCut export stay in sync.
-- Run after phase2.sql in the Supabase SQL editor.

alter table public.projects
  add column if not exists selected_bgm_track text,
  add column if not exists selected_bgm_url text;

comment on column public.projects.selected_bgm_track is
  'Canonical BGM filename assigned once (e.g. cartoon.mp3 / lofi_relax.mp3).';

comment on column public.projects.selected_bgm_url is
  'Public Storage URL for selected_bgm_track; used by preview and CapCut export.';
