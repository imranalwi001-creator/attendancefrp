-- Perangkat Pembelajaran (Kurikulum Merdeka)
-- Stores generated/edited teaching devices (ATP, Modul Ajar, LKPD, Rubrik, etc.)

create table if not exists public.perangkat_pembelajaran (
  id uuid primary key default gen_random_uuid(),
  mapel_id uuid not null references public.mapel(id) on delete cascade,
  academic_year_id uuid null references public.academic_years(id) on delete set null,
  semester text null check (semester in ('ganjil','genap')),
  tipe text not null check (tipe in ('CP','ATP','MODUL_AJAR','LKPD','PROTA','PROMES','KALDIK','KKTP','ASESMEN','INSTRUMEN','MEDIA','BAHAN_AJAR','JURNAL','BANK_SOAL')),
  title text not null,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','ready','final')),
  version integer not null default 1,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists perangkat_pembelajaran_mapel_id_idx on public.perangkat_pembelajaran(mapel_id);
create index if not exists perangkat_pembelajaran_academic_year_id_idx on public.perangkat_pembelajaran(academic_year_id);
create index if not exists perangkat_pembelajaran_tipe_idx on public.perangkat_pembelajaran(tipe);
create index if not exists perangkat_pembelajaran_status_idx on public.perangkat_pembelajaran(status);

alter table public.perangkat_pembelajaran enable row level security;

-- Read: any authenticated user can view perangkat for mapel they can access.
do $$
begin
  create policy "Authenticated can view perangkat_pembelajaran"
  on public.perangkat_pembelajaran
  for select
  to authenticated
  using (true);
exception
  when duplicate_object then null;
end $$;

-- Write: staff roles only
do $$
begin
  create policy "Staff can insert perangkat_pembelajaran"
  on public.perangkat_pembelajaran
  for insert
  to authenticated
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'guru')
    or public.has_role(auth.uid(), 'walikelas')
    or public.has_role(auth.uid(), 'Pembina')
    or public.has_role(auth.uid(), 'guru_ekskul')
    or public.has_role(auth.uid(), 'staff')
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Staff can update perangkat_pembelajaran"
  on public.perangkat_pembelajaran
  for update
  to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'guru')
    or public.has_role(auth.uid(), 'walikelas')
    or public.has_role(auth.uid(), 'Pembina')
    or public.has_role(auth.uid(), 'guru_ekskul')
    or public.has_role(auth.uid(), 'staff')
  )
  with check (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Admins can delete perangkat_pembelajaran"
  on public.perangkat_pembelajaran
  for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));
exception
  when duplicate_object then null;
end $$;

