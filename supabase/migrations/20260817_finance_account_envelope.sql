-- Cifrado de cuenta (restablecible). scheme=account | private.
alter table public.finance_vault
  add column if not exists scheme text;
alter table public.finance_vault
  add column if not exists account_wrapped_dek text;

update public.finance_vault
set scheme = 'private'
where scheme is null
  and wrapped_dek is not null;
