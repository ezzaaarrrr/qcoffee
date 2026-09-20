-- Migration: Add max_stock column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS max_stock numeric DEFAULT NULL;

