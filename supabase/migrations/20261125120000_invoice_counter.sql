-- Compteur de factures serie WEB (FAC/ANNEE/Wxxxx), atomique, isole de la compta.
create table if not exists public.invoice_counters (
  series   text primary key,
  last_no  int  not null default 0
);

create or replace function public.next_invoice_no(p_series text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  insert into public.invoice_counters (series, last_no)
  values (p_series, 1)
  on conflict (series) do update set last_no = public.invoice_counters.last_no + 1
  returning last_no into n;
  return n;
end;
$$;

revoke all on function public.next_invoice_no(text) from public, anon;
grant execute on function public.next_invoice_no(text) to service_role;
