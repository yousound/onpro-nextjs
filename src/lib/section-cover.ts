/** Build a path with optional `?cover=1` for section overview pages. */
export function sectionCoverHref(
  pathname: string,
  searchParams: URLSearchParams | ReadonlyURLSearchParams,
  cover: boolean,
): string {
  const params = new URLSearchParams(searchParams.toString());
  if (cover) params.set("cover", "1");
  else params.delete("cover");
  const q = params.toString();
  return q ? `${pathname}?${q}` : pathname;
}

type ReadonlyURLSearchParams = Pick<URLSearchParams, "toString" | "get">;

/**
 * Show marketing cover only when the section is empty.
 * If there is already content, cover appears only when the user opens About (`?cover=1`).
 */
export function shouldShowSectionCover(showCoverPage: boolean, contentCount: number): boolean {
  if (contentCount > 0) return showCoverPage;
  return true;
}
