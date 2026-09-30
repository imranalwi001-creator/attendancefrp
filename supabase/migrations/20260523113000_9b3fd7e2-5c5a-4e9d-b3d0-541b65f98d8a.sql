create or replace function public.delete_kelas_safe(_kelas_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  blockers jsonb := '{}'::jsonb;
  cnt integer;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Forbidden';
  end if;

  select count(*) into cnt from public.santri where kelas_id = _kelas_id;
  if cnt > 0 then blockers := jsonb_set(blockers, '{santri}', to_jsonb(cnt), true); end if;

  select count(*) into cnt from public.jadwal where kelas_id = _kelas_id;
  if cnt > 0 then blockers := jsonb_set(blockers, '{jadwal}', to_jsonb(cnt), true); end if;

  select count(*) into cnt from public.mapel where kelas_id = _kelas_id;
  if cnt > 0 then blockers := jsonb_set(blockers, '{mapel}', to_jsonb(cnt), true); end if;

  select count(*) into cnt from public.sesi_pembelajaran where kelas_id = _kelas_id;
  if cnt > 0 then blockers := jsonb_set(blockers, '{sesi_pembelajaran}', to_jsonb(cnt), true); end if;

  select count(*) into cnt from public.tagihan where kelas_id = _kelas_id;
  if cnt > 0 then blockers := jsonb_set(blockers, '{tagihan}', to_jsonb(cnt), true); end if;

  select count(*) into cnt from public.raport where kelas_id = _kelas_id;
  if cnt > 0 then blockers := jsonb_set(blockers, '{raport}', to_jsonb(cnt), true); end if;

  select count(*) into cnt from public.target_hafalan where kelas_id = _kelas_id;
  if cnt > 0 then blockers := jsonb_set(blockers, '{target_hafalan}', to_jsonb(cnt), true); end if;

  select count(*) into cnt from public.bahan_belajar where kelas_id = _kelas_id;
  if cnt > 0 then blockers := jsonb_set(blockers, '{bahan_belajar}', to_jsonb(cnt), true); end if;

  if blockers <> '{}'::jsonb then
    return jsonb_build_object('success', false, 'blockers', blockers);
  end if;

  update public.staff set kelas_id = null where kelas_id = _kelas_id;
  update public.kelas set walikelas_id = null where id = _kelas_id;

  delete from public.kelas where id = _kelas_id;

  return jsonb_build_object('success', true);
end;
$$;

