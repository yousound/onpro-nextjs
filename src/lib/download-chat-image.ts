function extensionFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

function extensionFromUrl(url: string): string | null {
  const match = url.match(/\.(jpe?g|png|gif|webp)(\?|$)/i);
  return match ? match[1].toLowerCase().replace("jpeg", "jpg") : null;
}

/** Trigger a browser download for a chat image (blob or remote URL). */
export async function downloadChatImage(url: string, index = 0): Promise<void> {
  const ext = extensionFromUrl(url) ?? "jpg";
  const filename = `onpro-chat-${Date.now()}-${index + 1}.${ext}`;

  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const mimeExt = extensionFromMime(blob.type || "");
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename.replace(/\.[^.]+$/, `.${mimeExt}`);
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 500);
  } catch {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}
