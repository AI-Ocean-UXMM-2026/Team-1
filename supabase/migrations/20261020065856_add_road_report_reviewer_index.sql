create index road_reports_reviewed_by_idx
  on public.road_reports (reviewed_by)
  where reviewed_by is not null;
