-- Consent is tied to the phone number. The app re-applies choices made
-- explicitly in the same profile save after this trigger has cleared them.
create or replace function private.reset_phone_verification_on_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.phone is distinct from old.phone then
    new.phone_verified := false;
    new.whatsapp_opt_in := false;
    new.sms_opt_in := false;
  end if;
  return new;
end $$;
