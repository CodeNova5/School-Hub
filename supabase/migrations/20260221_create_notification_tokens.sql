-- Create notification_tokens table
create table if not exists public.notification_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  token text not null,
  role text default 'user',
  device_type text default 'unknown',
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  last_registered_at timestamp with time zone default timezone('utc'::text, now()),
  constraint fk_user foreign key (user_id) references auth.users(id) on delete cascade
);

-- Create index on user_id for faster queries
create index if not exists idx_notification_tokens_user_id on public.notification_tokens(user_id);

-- Create index on token for uniqueness check
create index if not exists idx_notification_tokens_token on public.notification_tokens(token);

-- Create index on is_active for filtering active tokens
create index if not exists idx_notification_tokens_is_active on public.notification_tokens(is_active);

-- Create unique constraint to prevent duplicate tokens per user (optional but recommended)
-- Uncomment if you want to prevent same token from being registered twice per user
-- alter table notification_tokens add constraint unique_user_token unique(user_id, token);

-- Enable RLS (Row Level Security)
alter table public.notification_tokens enable row level security;

-- Create policy: Users can only see their own tokens
create policy "Users can view their own notification tokens"
  on public.notification_tokens for select
  using (auth.uid() = user_id);

-- Create policy: Users can insert their own tokens
create policy "Users can insert their own notification tokens"
  on public.notification_tokens for insert
  with check (auth.uid() = user_id);

-- Create policy: Users can update their own tokens
create policy "Users can update their own notification tokens"
  on public.notification_tokens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Create policy: Users can delete their own tokens
create policy "Users can delete their own notification tokens"
  on public.notification_tokens for delete
  using (auth.uid() = user_id);

-- Create policy: Admins can view all tokens
create policy "Admins can view all notification tokens"
  on public.notification_tokens for select
  using (
    exists (
      select 1 from admins where admins.user_id = auth.uid()
    )
  );
