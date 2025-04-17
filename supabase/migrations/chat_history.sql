-- Create chat_history table
create table public.chat_history (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) not null,
    role text not null,
    content text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.chat_history enable row level security;

-- Create policy to allow users to read only their own chat history
create policy "Users can read their own chat history"
    on public.chat_history
    for select
    using (auth.uid() = user_id);

-- Create policy to allow users to insert their own messages
create policy "Users can insert their own messages"
    on public.chat_history
    for insert
    with check (auth.uid() = user_id);

-- Create index for faster queries
create index chat_history_user_id_idx on public.chat_history(user_id);
create index chat_history_created_at_idx on public.chat_history(created_at); 