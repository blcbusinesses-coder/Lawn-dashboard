alter table customers add column if not exists extra_emails text[] not null default '{}';
