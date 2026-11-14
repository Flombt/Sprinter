-- Lecture du seul média publié signalé (§17.9). Aucun accès aux brouillons ni au bucket entier.
create or replace function public.admin_report_media(p_report_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_admin record; v_reason text; v_report private.reports; v_media record;
begin
  select * into v_admin from private.assert_admin('moderation.read');
  v_reason := private.check_reason(p_reason, null);
  select * into v_report from private.reports where id = p_report_id;
  if not found or v_report.target_kind <> 'profile_element' then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select m.id, m.mime, m.bytes into v_media
  from public.profile_published p
  join public.profile_sharing s on s.user_id = p.user_id and s.mode <> 'private'
  join private.user_directory u on u.user_id = p.user_id and u.status = 'active'
  join public.profile_elements e on e.user_id = p.user_id and e.element_key = p.element_key
    and e.visibility = 'audience' and not e.deleted
  join public.profile_media m on m.user_id = p.user_id and m.status = 'ready'
    and m.id = any(private.profile_payload_media(p.payload))
  where p.user_id = v_report.target_user
    and p.element_key = substr(v_report.target_ref, position(':' in v_report.target_ref) + 1)
  order by m.id limit 1;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform private.audit('moderation.media', v_report.target_user, v_reason, jsonb_build_object('report_id', p_report_id));
  return jsonb_build_object('media_id', v_media.id, 'mime', v_media.mime, 'bytes', v_media.bytes);
end $$;
revoke all on function public.admin_report_media(uuid, text) from public, anon;
grant execute on function public.admin_report_media(uuid, text) to authenticated;
