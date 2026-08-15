-- ============================================================
-- ATS webapp — Supabase database setup
-- À exécuter une seule fois dans: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- 1) Table des profils clients (liée au compte auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- 2) Création automatique du profil à chaque inscription (email ou Google)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', split_part(new.raw_user_meta_data->>'full_name', ' ', 1)),
    coalesce(new.raw_user_meta_data->>'last_name', nullif(substr(new.raw_user_meta_data->>'full_name', strpos(new.raw_user_meta_data->>'full_name', ' ') + 1), '')),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3) Table des réservations, liée au client
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists bookings_user_id_idx on public.bookings(user_id);

alter table public.bookings enable row level security;

create policy "Users can view own bookings" on public.bookings
  for select using (auth.uid() = user_id);
create policy "Users can create own bookings" on public.bookings
  for insert with check (auth.uid() = user_id);
