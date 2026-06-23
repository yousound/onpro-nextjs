export type MimeAttachment = {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
};

export type BuildMimeMessageInput = {
  fromName: string;
  fromEmail: string;
  to: Array<{ name: string; email: string }>;
  cc?: Array<{ name: string; email: string }>;
  subject: string;
  textBody: string;
  htmlBody?: string;
  inReplyTo?: string;
  references?: string;
  attachments?: MimeAttachment[];
};

function encodeHeaderValue(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  const encoded = Buffer.from(value, "utf8").toString("base64");
  return `=?UTF-8?B?${encoded}?=`;
}

function formatAddress(name: string, email: string): string {
  const safeEmail = email.trim();
  const safeName = name.trim();
  if (!safeName || safeName === safeEmail) return safeEmail;
  const escaped = safeName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}" <${safeEmail}>`;
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function chunkBase64(b64: string, lineLength = 76): string {
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += lineLength) {
    lines.push(b64.slice(i, i + lineLength));
  }
  return lines.join("\r\n");
}

/** Build RFC 822 MIME message (CRLF) for Gmail `messages.send` raw payload. */
export function buildMimeMessage(input: BuildMimeMessageInput): string {
  const mixedBoundary = `mixed_${Date.now().toString(36)}`;
  const altBoundary = `alt_${Date.now().toString(36)}`;
  const hasHtml = Boolean(input.htmlBody?.trim());
  const hasAttachments = (input.attachments?.length ?? 0) > 0;

  const headers: string[] = [
    `From: ${formatAddress(input.fromName, input.fromEmail)}`,
    `To: ${input.to.map((r) => formatAddress(r.name, r.email)).join(", ")}`,
  ];

  if (input.cc?.length) {
    headers.push(`Cc: ${input.cc.map((r) => formatAddress(r.name, r.email)).join(", ")}`);
  }

  headers.push(`Subject: ${encodeHeaderValue(input.subject.trim())}`);
  headers.push("MIME-Version: 1.0");

  if (input.inReplyTo) headers.push(`In-Reply-To: ${input.inReplyTo}`);
  if (input.references) headers.push(`References: ${input.references}`);

  const textPart = [
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    input.textBody.trim(),
  ].join("\r\n");

  const htmlPart = hasHtml
    ? [
        "Content-Type: text/html; charset=UTF-8",
        "Content-Transfer-Encoding: 7bit",
        "",
        input.htmlBody!.trim(),
      ].join("\r\n")
    : null;

  let body = "";

  if (hasAttachments) {
    headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
    body += `--${mixedBoundary}\r\n`;

    if (hasHtml) {
      body += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n`;
      body += `--${altBoundary}\r\n${textPart}\r\n\r\n`;
      body += `--${altBoundary}\r\n${htmlPart}\r\n\r\n`;
      body += `--${altBoundary}--\r\n`;
    } else {
      body += `${textPart}\r\n`;
    }

    for (const att of input.attachments ?? []) {
      const safeName = att.filename.replace(/[^\w.\- ]+/g, "_") || "attachment";
      body += `--${mixedBoundary}\r\n`;
      body += `Content-Type: ${att.mimeType}; name="${safeName}"\r\n`;
      body += `Content-Disposition: attachment; filename="${safeName}"\r\n`;
      body += "Content-Transfer-Encoding: base64\r\n\r\n";
      body += `${chunkBase64(toBase64(att.bytes))}\r\n`;
    }

    body += `--${mixedBoundary}--`;
  } else if (hasHtml) {
    headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
    body += `--${altBoundary}\r\n${textPart}\r\n\r\n`;
    body += `--${altBoundary}\r\n${htmlPart}\r\n\r\n`;
    body += `--${altBoundary}--`;
  } else {
    headers.push("Content-Type: text/plain; charset=UTF-8");
    headers.push("Content-Transfer-Encoding: 7bit");
    body = input.textBody.trim();
  }

  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

/** Gmail API expects URL-safe base64 without padding. */
export function mimeToGmailRaw(mime: string): string {
  return Buffer.from(mime, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
