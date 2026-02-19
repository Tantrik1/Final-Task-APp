-- Add super admin by email (will work after user signs up)
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Find user by email in profiles
  SELECT id INTO v_user_id FROM public.profiles WHERE email = 'info@tantriktech.com.np';
  
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.super_admins (user_id)
    VALUES (v_user_id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END $$;