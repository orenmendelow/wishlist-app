-- Fix the next_thursday_5pm function to return correct 5pm EST time
-- Run this in Supabase SQL editor to update the function

DROP FUNCTION IF EXISTS public.next_thursday_5pm();

CREATE OR REPLACE FUNCTION public.next_thursday_5pm()
RETURNS timestamp with time zone AS $$
DECLARE
  next_thursday timestamp with time zone;
BEGIN
  -- Start with current time in EST/EDT
  next_thursday := now() at time zone 'America/New_York';
  
  -- Find next Thursday (4 = Thursday in extract(dow))
  next_thursday := next_thursday + ((4 - extract(dow from next_thursday) + 7) % 7) * interval '1 day';
  
  -- Set to 5pm (17:00) in the local timezone
  next_thursday := date_trunc('day', next_thursday) + interval '17 hours';
  
  -- If it's already past 5pm Thursday, move to next Thursday
  IF next_thursday <= (now() at time zone 'America/New_York') THEN
    next_thursday := next_thursday + interval '7 days';
  END IF;
  
  -- Convert back to UTC for storage (this was the issue)
  RETURN next_thursday at time zone 'America/New_York';
END;
$$ LANGUAGE plpgsql;

-- Test the function
SELECT 
  public.next_thursday_5pm() as next_thursday_5pm_utc,
  public.next_thursday_5pm() AT TIME ZONE 'America/New_York' as next_thursday_5pm_est,
  EXTRACT(HOUR FROM public.next_thursday_5pm() AT TIME ZONE 'America/New_York') as hour_est,
  EXTRACT(DOW FROM public.next_thursday_5pm() AT TIME ZONE 'America/New_York') as day_of_week;

-- Now update the existing match processing schedule to use the corrected time
UPDATE public.match_processing 
SET next_processing_at = public.next_thursday_5pm()
WHERE id = (SELECT id FROM public.match_processing ORDER BY created_at DESC LIMIT 1);
