-- The Rivalry League: Supabase schema
-- Run once in Supabase → SQL Editor → New query → Run. Safe to run again.
--
-- The app connects as the database owner through the connection string, so it
-- is not affected by Row Level Security. RLS is switched on with no policies so
-- that Supabase's public API keys cannot read or change anything.

-- ---------------------------------------------------------------- tables

create table if not exists league (
  id             smallint primary key default 1 check (id = 1),  -- one league per database
  name           text    not null,
  season         text    not null,
  default_purse  integer not null check (default_purse >= 0),
  max_squad_size integer not null check (max_squad_size > 0),
  rev            integer not null default 0,                     -- bumped on every save, so two saves cannot overwrite each other
  updated_at     timestamptz not null default now()
);

create table if not exists superadmin (
  id       smallint primary key default 1 check (id = 1),
  name     text not null,
  pin_hash text                                                  -- salted scrypt hash; never plain text
);

create table if not exists teams (
  id         text primary key,
  position   integer not null default 0,                         -- display order
  name       text    not null,
  short      text    not null default '',
  color      text    not null default '',
  owner      text    not null default '',
  tagline    text    not null default '',
  purse      integer not null default 0,
  spent      integer not null default 0,
  players    integer not null default 0,                         -- squad size so far
  logo       text                                                -- small image as a data URL
);
create unique index if not exists teams_name_unique on teams (lower(name));

create table if not exists owner_logins (
  team_id  text primary key references teams (id) on delete cascade,
  login_id text not null unique,
  pin_hash text not null                                         -- salted scrypt hash
);

create table if not exists players (
  id         bigint  primary key,
  position   integer not null default 0,
  number     integer not null,
  name       text    not null,
  initials   text    not null default '',
  base       integer not null default 500,
  status     text    not null default 'Upcoming' check (status in ('Upcoming', 'Sold', 'Unsold')),
  sold_to    text,                                               -- team name
  sold_price integer
);
create index if not exists players_status on players (status);

create table if not exists matches (
  id               text primary key,
  position         integer not null default 0,
  match_number     integer not null,
  stage            text not null default '',
  team_a           text not null,
  team_b           text not null,
  match_date       text not null default '',
  venue            text not null default '',
  status           text not null default 'Scheduled' check (status in ('Scheduled', 'Toss Done', 'Live', 'Completed')),
  toss_winner      text,
  toss_decision    text check (toss_decision in ('Bat', 'Bowl')),
  overs_limit      integer,
  score_a_runs     integer,
  score_a_wickets  integer,
  score_a_balls    integer,
  score_a_all_out  boolean,
  score_b_runs     integer,
  score_b_wickets  integer,
  score_b_balls    integer,
  score_b_all_out  boolean,
  winner           text,
  result_type      text check (result_type in ('win', 'tie', 'no-result')),
  result           text
);

create table if not exists auction_state (
  id                smallint primary key default 1 check (id = 1),
  current_player_id bigint,
  current_bid       integer not null default 0,
  leader_team_id    text,
  leader_team_name  text,
  min_raise         integer,                                     -- smallest raise still open for the player up for bidding
  spin              jsonb,                                       -- latest wheel draw: start time, pool and landing slot
  last_updated      timestamptz not null default now()
);

create table if not exists login_attempts (
  key             varchar(64) primary key,                       -- hash of account + network
  failures        integer not null,
  first_failed_at timestamptz not null
);

alter table league         enable row level security;
alter table superadmin     enable row level security;
alter table teams          enable row level security;
alter table owner_logins   enable row level security;
alter table players        enable row level security;
alter table matches        enable row level security;
alter table auction_state  enable row level security;
alter table login_attempts enable row level security;

-- ---------------------------------------------------------------- load: the whole league as one JSON document

create or replace function load_league() returns jsonb
language sql stable set search_path = public as $$
  select case when not exists (select 1 from league) then null else jsonb_build_object(
    'rev', (select rev from league),
    'league', (select jsonb_build_object('name', name, 'season', season, 'defaultPurse', default_purse, 'maxSquadSize', max_squad_size) from league),
    'auctioneer', coalesce((select jsonb_strip_nulls(jsonb_build_object('name', name, 'pinHash', pin_hash)) from superadmin), '{"name":"Chief Auctioneer"}'::jsonb),
    'teams', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', id, 'name', name, 'short', short, 'color', color, 'owner', owner, 'tagline', tagline,
        'purse', purse, 'spent', spent, 'players', players, 'logo', logo)) order by position, id) from teams), '[]'::jsonb),
    'ownerLogins', coalesce((select jsonb_object_agg(team_id, jsonb_build_object('loginId', login_id, 'pinHash', pin_hash)) from owner_logins), '{}'::jsonb),
    'players', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', id, 'number', number, 'name', name, 'initials', initials, 'base', base,
        'status', status, 'soldTo', sold_to, 'soldPrice', sold_price)) order by position, id) from players), '[]'::jsonb),
    'matches', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', id, 'matchNumber', match_number, 'stage', stage, 'teamA', team_a, 'teamB', team_b,
        'date', match_date, 'venue', venue, 'status', status, 'tossWinner', toss_winner, 'tossDecision', toss_decision,
        'oversLimit', overs_limit, 'winner', winner, 'resultType', result_type, 'result', result,
        'scoreA', case when score_a_runs is null then null else jsonb_build_object('runs', score_a_runs, 'wickets', score_a_wickets, 'balls', score_a_balls, 'allOut', score_a_all_out) end,
        'scoreB', case when score_b_runs is null then null else jsonb_build_object('runs', score_b_runs, 'wickets', score_b_wickets, 'balls', score_b_balls, 'allOut', score_b_all_out) end
        )) order by position, id) from matches), '[]'::jsonb),
    'auctionState', coalesce((select jsonb_build_object(
        'currentPlayerId', current_player_id, 'currentBid', current_bid,
        'leaderTeamId', leader_team_id, 'leaderTeamName', leader_team_name,
        'lastUpdated', to_char(last_updated at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      ) || jsonb_strip_nulls(jsonb_build_object('minRaise', min_raise, 'spin', spin)) from auction_state),
      '{"currentPlayerId":null,"currentBid":0,"leaderTeamId":null,"leaderTeamName":null,"lastUpdated":""}'::jsonb)
  ) end
$$;

-- ---------------------------------------------------------------- save: write the whole league in one transaction
-- Returns false, and changes nothing, when someone else saved since base_rev was read.

create or replace function save_league(base_rev integer, doc jsonb) returns boolean
language plpgsql set search_path = public as $$
begin
  update league set
    name = doc->'league'->>'name',
    season = doc->'league'->>'season',
    default_purse = (doc->'league'->>'defaultPurse')::integer,
    max_squad_size = (doc->'league'->>'maxSquadSize')::integer,
    rev = rev + 1,
    updated_at = now()
  where id = 1 and rev = base_rev;

  if not found then
    if base_rev <> 0 or exists (select 1 from league) then
      return false;
    end if;
    insert into league (id, name, season, default_purse, max_squad_size, rev)
    values (1, doc->'league'->>'name', doc->'league'->>'season',
            (doc->'league'->>'defaultPurse')::integer, (doc->'league'->>'maxSquadSize')::integer, 1);
  end if;

  insert into superadmin (id, name, pin_hash)
  values (1, coalesce(doc->'auctioneer'->>'name', 'Chief Auctioneer'), doc->'auctioneer'->>'pinHash')
  on conflict (id) do update set name = excluded.name, pin_hash = excluded.pin_hash;

  -- Teams first, so owner logins can point at them
  delete from teams where id not in (select t->>'id' from jsonb_array_elements(coalesce(doc->'teams', '[]')) t);
  insert into teams (id, position, name, short, color, owner, tagline, purse, spent, players, logo)
  select x.id, (e.ord - 1)::integer, x.name, coalesce(x.short, ''), coalesce(x.color, ''), coalesce(x.owner, ''),
         coalesce(x.tagline, ''), coalesce(x.purse, 0), coalesce(x.spent, 0), coalesce(x.players, 0), x.logo
  from jsonb_array_elements(coalesce(doc->'teams', '[]')) with ordinality as e(v, ord),
       jsonb_to_record(e.v) as x(
    id text, name text, short text, color text, owner text, tagline text, purse integer, spent integer, players integer, logo text)
  on conflict (id) do update set
    position = excluded.position, name = excluded.name, short = excluded.short, color = excluded.color,
    owner = excluded.owner, tagline = excluded.tagline, purse = excluded.purse, spent = excluded.spent,
    players = excluded.players, logo = excluded.logo;

  delete from owner_logins;
  insert into owner_logins (team_id, login_id, pin_hash)
  select e.key, e.value->>'loginId', e.value->>'pinHash'
  from jsonb_each(coalesce(doc->'ownerLogins', '{}')) e
  where exists (select 1 from teams where id = e.key);

  delete from players where id not in (select (p->>'id')::bigint from jsonb_array_elements(coalesce(doc->'players', '[]')) p);
  insert into players (id, position, number, name, initials, base, status, sold_to, sold_price)
  select x.id, (e.ord - 1)::integer, coalesce(x.number, 0), x.name, coalesce(x.initials, ''), coalesce(x.base, 500),
         coalesce(x.status, 'Upcoming'), x."soldTo", x."soldPrice"
  from jsonb_array_elements(coalesce(doc->'players', '[]')) with ordinality as e(v, ord),
       jsonb_to_record(e.v) as x(
    id bigint, number integer, name text, initials text, base integer, status text, "soldTo" text, "soldPrice" integer)
  on conflict (id) do update set
    position = excluded.position, number = excluded.number, name = excluded.name, initials = excluded.initials,
    base = excluded.base, status = excluded.status, sold_to = excluded.sold_to, sold_price = excluded.sold_price;

  delete from matches where id not in (select m->>'id' from jsonb_array_elements(coalesce(doc->'matches', '[]')) m);
  insert into matches (id, position, match_number, stage, team_a, team_b, match_date, venue, status, toss_winner, toss_decision,
                       overs_limit, score_a_runs, score_a_wickets, score_a_balls, score_a_all_out,
                       score_b_runs, score_b_wickets, score_b_balls, score_b_all_out, winner, result_type, result)
  select x.id, (e.ord - 1)::integer, coalesce(x."matchNumber", 0), coalesce(x.stage, ''), coalesce(x."teamA", ''), coalesce(x."teamB", ''), coalesce(x."date", ''),
         coalesce(x.venue, ''), coalesce(x.status, 'Scheduled'), nullif(x."tossWinner", ''), nullif(x."tossDecision", ''), x."oversLimit",
         (x."scoreA"->>'runs')::integer, (x."scoreA"->>'wickets')::integer, (x."scoreA"->>'balls')::integer, (x."scoreA"->>'allOut')::boolean,
         (x."scoreB"->>'runs')::integer, (x."scoreB"->>'wickets')::integer, (x."scoreB"->>'balls')::integer, (x."scoreB"->>'allOut')::boolean,
         x.winner, nullif(x."resultType", ''), x.result
  from jsonb_array_elements(coalesce(doc->'matches', '[]')) with ordinality as e(v, ord),
       jsonb_to_record(e.v) as x(
    id text, "matchNumber" integer, stage text, "teamA" text, "teamB" text, "date" text, venue text, status text,
    "tossWinner" text, "tossDecision" text, "oversLimit" integer, "scoreA" jsonb, "scoreB" jsonb,
    winner text, "resultType" text, result text)
  on conflict (id) do update set
    position = excluded.position, match_number = excluded.match_number, stage = excluded.stage,
    team_a = excluded.team_a, team_b = excluded.team_b, match_date = excluded.match_date, venue = excluded.venue,
    status = excluded.status, toss_winner = excluded.toss_winner, toss_decision = excluded.toss_decision,
    overs_limit = excluded.overs_limit,
    score_a_runs = excluded.score_a_runs, score_a_wickets = excluded.score_a_wickets,
    score_a_balls = excluded.score_a_balls, score_a_all_out = excluded.score_a_all_out,
    score_b_runs = excluded.score_b_runs, score_b_wickets = excluded.score_b_wickets,
    score_b_balls = excluded.score_b_balls, score_b_all_out = excluded.score_b_all_out,
    winner = excluded.winner, result_type = excluded.result_type, result = excluded.result;

  insert into auction_state (id, current_player_id, current_bid, leader_team_id, leader_team_name, min_raise, spin, last_updated)
  values (1,
    (doc->'auctionState'->>'currentPlayerId')::bigint,
    coalesce((doc->'auctionState'->>'currentBid')::integer, 0),
    doc->'auctionState'->>'leaderTeamId',
    doc->'auctionState'->>'leaderTeamName',
    (doc->'auctionState'->>'minRaise')::integer,
    doc->'auctionState'->'spin',
    coalesce(nullif(doc->'auctionState'->>'lastUpdated', '')::timestamptz, now()))
  on conflict (id) do update set
    current_player_id = excluded.current_player_id, current_bid = excluded.current_bid,
    leader_team_id = excluded.leader_team_id, leader_team_name = excluded.leader_team_name,
    min_raise = excluded.min_raise, spin = excluded.spin, last_updated = excluded.last_updated;

  return true;
end
$$;

-- Only the app's own connection may call these; Supabase's public API keys may not
revoke all on function load_league() from public, anon, authenticated;
revoke all on function save_league(integer, jsonb) from public, anon, authenticated;
