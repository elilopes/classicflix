-- Durable, private-to-the-backend queue for English Wikidata descriptions.
-- No existing description fields are overwritten unless descriptionen is blank.

create table if not exists public.wikidata_description_jobs (
  job_key text primary key check (job_key = 'wikidata_descriptions_en'),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'paused', 'completed', 'completed_with_errors', 'error')),
  paused boolean not null default false,
  started_at timestamptz,
  finished_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wikidata_description_queue (
  wikidataid text primary key references public.movies(wikidataid) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'no_description', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_retry_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wikidata_description_queue_pending_idx
  on public.wikidata_description_queue (next_retry_at, created_at)
  where status = 'pending';

create index if not exists wikidata_description_queue_processing_idx
  on public.wikidata_description_queue (locked_at)
  where status = 'processing';

alter table public.wikidata_description_jobs enable row level security;
alter table public.wikidata_description_queue enable row level security;

revoke all on table public.wikidata_description_jobs from public, anon, authenticated;
revoke all on table public.wikidata_description_queue from public, anon, authenticated;
grant select, insert, update, delete on table public.wikidata_description_jobs to service_role;
grant select, insert, update, delete on table public.wikidata_description_queue to service_role;

insert into public.wikidata_description_jobs (job_key)
values ('wikidata_descriptions_en')
on conflict (job_key) do nothing;

create or replace function public.seed_wikidata_description_queue()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  insert into public.wikidata_description_queue (wikidataid)
  select m.wikidataid
  from public.movies as m
  left join public.description as d on d.wikidataid = m.wikidataid
  where m.wikidataid ~* '^Q[1-9][0-9]*$'
    and nullif(btrim(d.descriptionen), '') is null
  on conflict (wikidataid) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.claim_wikidata_description_batch(p_limit integer default 40)
returns table (wikidataid text, attempts integer)
language sql
set search_path = ''
as $$
  with candidates as (
    select q.wikidataid
    from public.wikidata_description_queue as q
    where (
      (q.status = 'pending' and q.next_retry_at <= now())
      or
      (q.status = 'processing' and q.locked_at < now() - interval '15 minutes')
    )
    order by q.created_at, q.wikidataid
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 40), 50))
  )
  update public.wikidata_description_queue as q
  set status = 'processing',
      attempts = q.attempts + 1,
      locked_at = now(),
      next_retry_at = now(),
      updated_at = now()
  from candidates
  where q.wikidataid = candidates.wikidataid
  returning q.wikidataid, q.attempts;
$$;

create or replace function public.save_wikidata_english_descriptions(p_items jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  item record;
  affected integer;
  saved_count integer := 0;
begin
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items must be a JSON array';
  end if;

  for item in
    select upper(x.qid) as qid, btrim(x.description) as description
    from jsonb_to_recordset(p_items) as x(qid text, description text)
  loop
    if item.qid !~ '^Q[1-9][0-9]*$' or item.description is null or item.description = '' then
      continue;
    end if;

    insert into public.description as existing (wikidataid, descriptionen)
    values (item.qid, item.description)
    on conflict (wikidataid) do update
      set descriptionen = excluded.descriptionen
      where nullif(btrim(existing.descriptionen), '') is null;

    get diagnostics affected = row_count;
    saved_count := saved_count + affected;
  end loop;

  return saved_count;
end;
$$;

revoke all on function public.seed_wikidata_description_queue() from public, anon, authenticated;
revoke all on function public.claim_wikidata_description_batch(integer) from public, anon, authenticated;
revoke all on function public.save_wikidata_english_descriptions(jsonb) from public, anon, authenticated;
grant execute on function public.seed_wikidata_description_queue() to service_role;
grant execute on function public.claim_wikidata_description_batch(integer) to service_role;
grant execute on function public.save_wikidata_english_descriptions(jsonb) to service_role;
