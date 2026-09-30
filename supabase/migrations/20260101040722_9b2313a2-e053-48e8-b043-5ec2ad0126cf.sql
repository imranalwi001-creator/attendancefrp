-- Fix pg_net http_post signature usage in notification triggers

create or replace function public.notify_konseling_record()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  santri_name text;
  notification_title text;
  notification_message text;
begin
  -- Get santri name
  select p.name into santri_name
  from profiles p
  where p.id = new.santri_id;

  -- Set notification based on type
  if new.tipe = 'pelanggaran' then
    notification_title := 'Catatan Pelanggaran Baru';
    notification_message := 'Catatan pelanggaran baru telah ditambahkan: ' || new.kategori;
  else
    notification_title := 'Catatan Prestasi Baru';
    notification_message := 'Catatan prestasi baru telah ditambahkan: ' || new.kategori;
  end if;

  -- Create in-app notification for santri
  perform create_notification(
    new.santri_id,
    notification_title,
    notification_message
  );

  -- Call edge function for push notification (non-blocking via pg_net)
  perform net.http_post(
    url := 'http://127.0.0.1:54321/functions/v1/trigger-push-notification',
    body := jsonb_build_object(
      'type', 'konseling_record',
      'record', jsonb_build_object(
        'santri_id', new.santri_id,
        'tipe', new.tipe,
        'kategori', new.kategori
      )
    ),
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$function$;

create or replace function public.notify_setoran_hafalan()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  santri_name text;
  notification_title text;
  notification_message text;
  kategori_label text;
begin
  -- Get santri name
  select p.name into santri_name
  from profiles p
  where p.id = new.santri_id;

  -- Set kategori label
  case new.kategori
    when 'ziyadah' then kategori_label := 'Ziyadah';
    when 'murojaah' then kategori_label := 'Murojaah';
    when 'tahsin' then kategori_label := 'Tahsin';
    else kategori_label := new.kategori;
  end case;

  notification_title := 'Data Hafalan Baru';
  notification_message := 'Data ' || kategori_label || ' telah ditambahkan: ' || new.judul;

  perform create_notification(
    new.santri_id,
    notification_title,
    notification_message
  );

  perform net.http_post(
    url := 'http://127.0.0.1:54321/functions/v1/trigger-push-notification',
    body := jsonb_build_object(
      'type', 'setoran_hafalan',
      'record', jsonb_build_object(
        'santri_id', new.santri_id,
        'kategori', new.kategori,
        'judul', new.judul
      )
    ),
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$function$;