type SearchParams = Record<string, string | string[] | undefined> | undefined;

export function buildPlannerCallbackPath(pathname: string, searchParams: SearchParams) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined) params.append(key, item);
      }
      continue;
    }

    if (value !== undefined) params.set(key, value);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function buildLoginCallbackHref(callbackPath: string) {
  return `/login?callbackUrl=${encodeURIComponent(callbackPath)}`;
}
