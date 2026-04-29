-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Format enum
create type mtg_format as enum ('commander', 'standard', 'pauper', 'modern', 'pioneer', 'legacy');

-- Collection cards
create table collection_cards (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  scryfall_id text not null,
  card_name text not null,
  quantity integer not null default 1,
  foil boolean not null default false,
  set_code text,
  collector_number text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(user_id, scryfall_id, foil)
);

alter table collection_cards enable row level security;
create policy "Users can manage their own collection"
  on collection_cards for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Meta decks (cached from external sources, public read)
create table meta_decks (
  id uuid primary key default uuid_generate_v4(),
  format mtg_format not null,
  deck_name text not null,
  archetype text not null,
  source text not null,
  source_url text,
  win_rate numeric(5,2),
  popularity integer,
  cards jsonb not null default '[]',
  fetched_at timestamptz default now() not null
);

create index on meta_decks (format);
create index on meta_decks (fetched_at);
alter table meta_decks enable row level security;
create policy "Meta decks are publicly readable"
  on meta_decks for select
  using (true);

-- Saved recommendations
create table saved_recommendations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  format mtg_format not null,
  deck_name text not null,
  already_have jsonb not null default '[]',
  cards_to_buy_budget jsonb not null default '[]',
  cards_to_buy_full jsonb not null default '[]',
  meta_deck_id uuid references meta_decks(id),
  created_at timestamptz default now() not null
);

alter table saved_recommendations enable row level security;
create policy "Users can manage their own recommendations"
  on saved_recommendations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger collection_cards_updated_at
  before update on collection_cards
  for each row execute function update_updated_at();
