-- Migration: Organization Settings (RUC, Phone, Address, City, Email)
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS ruc TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'La Troncal',
ADD COLUMN IF NOT EXISTS email TEXT;
