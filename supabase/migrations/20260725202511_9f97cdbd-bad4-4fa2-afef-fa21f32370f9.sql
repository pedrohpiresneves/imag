
CREATE OR REPLACE FUNCTION public.normalize_handle_body(_raw text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT
    CASE
      WHEN length(cleaned) < 3 THEN NULL
      WHEN length(cleaned) > 30 THEN substring(cleaned from 1 for 30)
      ELSE cleaned
    END
  FROM (
    SELECT
      regexp_replace(
        regexp_replace(
          lower(
            translate(
              coalesce(_raw, ''),
              'áàâãäåéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
              'aaaaaaeeeeiiiiooooouuuucnaaaaaaeeeeiiiiooooouuuucn'
            )
          ),
          '[^a-z0-9._]', '', 'g'
        ),
        '\.+', '.', 'g'
      ) AS cleaned
  ) s;
$function$;
