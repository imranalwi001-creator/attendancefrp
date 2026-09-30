alter table public.staff
alter column employee_id type text
using employee_id::text;

