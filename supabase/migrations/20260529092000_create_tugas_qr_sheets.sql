-- QR sheets for printed assignments (tugas) so teachers can scan and instantly identify the student.

create table if not exists public.tugas_qr_sheets (
  id uuid primary key default gen_random_uuid(),
  tugas_id uuid not null references public.tugas(id) on delete cascade,
  santri_id uuid not null references public.santri(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);

-- One sheet per (tugas, santri)
create unique index if not exists tugas_qr_sheets_unique_pair on public.tugas_qr_sheets (tugas_id, santri_id);

alter table public.tugas_qr_sheets enable row level security;

-- Minimal policies for teacher/admin usage (local use-case).
do $$
begin
  create policy "Teacher can read tugas_qr_sheets"
  on public.tugas_qr_sheets
  for select
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','guru','walikelas','Pembina','guru_ekskul')
    )
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "Teacher can insert tugas_qr_sheets"
  on public.tugas_qr_sheets
  for insert
  with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin','guru','walikelas','Pembina','guru_ekskul')
    )
  );
exception when duplicate_object then null;
end $$;
