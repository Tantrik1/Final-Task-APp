-- Add needs_password_reset column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN needs_password_reset BOOLEAN DEFAULT false;