
create table accounts(
id uuid primary key default gen_random_uuid(),
name text,
type text,
balance numeric
);

create table transactions(
id uuid primary key default gen_random_uuid(),
type text,
account text,
weight numeric,
density numeric,
price numeric,
date timestamp
);
