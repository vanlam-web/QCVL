alter table public.profiles
  add column username text,
  add column phone text,
  add column email text,
  add column birthday date,
  add column region text,
  add column ward text,
  add column address text,
  add column note text;

alter table public.profiles
  add constraint profiles_username_check check (username is null or char_length(btrim(username)) between 1 and 100),
  add constraint profiles_phone_check check (phone is null or phone ~ '^[0-9+\s().-]{8,20}$'),
  add constraint profiles_email_check check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add constraint profiles_region_check check (region is null or char_length(btrim(region)) between 1 and 100),
  add constraint profiles_ward_check check (ward is null or char_length(btrim(ward)) between 1 and 100),
  add constraint profiles_address_check check (address is null or char_length(btrim(address)) between 1 and 255),
  add constraint profiles_note_check check (note is null or char_length(btrim(note)) between 1 and 500);
