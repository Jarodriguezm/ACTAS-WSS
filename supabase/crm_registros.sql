create table if not exists public.crm_registros (
  id         bigint primary key,
  tipo       text not null,
  numero     text,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_registros_tipo_idx   on public.crm_registros (tipo);
create index if not exists crm_registros_numero_idx on public.crm_registros (numero);

-- Sin políticas: solo la clave service_role (usada por el CRM) puede leer o escribir.
alter table public.crm_registros enable row level security;
