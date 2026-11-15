export function stripBrokenDataImages(html: string) {
  return html.replace(/<img\b[^>]*\ssrc\s*=\s*["']data:image\/[^"']*$/gi, "");
}
