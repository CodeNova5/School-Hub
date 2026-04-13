export type ZoomMeetingDetails = {
  meetingId: string;
  password: string;
  webUrl: string;
};

export type ZoomJoinLinks = {
  webUrl: string;
  desktopDeepLink: string;
  mobileDeepLink: string;
};

const ALLOWED_ZOOM_HOSTS = ["zoom.us", "us02web.zoom.us", "us04web.zoom.us"];

function isAllowedZoomHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (ALLOWED_ZOOM_HOSTS.includes(host)) return true;
  return host.endsWith(".zoom.us");
}

function normalizeMeetingId(rawId: string): string {
  const digitsOnly = rawId.replace(/\D/g, "");
  if (!digitsOnly || digitsOnly.length < 9 || digitsOnly.length > 12) {
    throw new Error("Invalid Zoom meeting ID");
  }
  return digitsOnly;
}

function readMeetingIdFromPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  const joinIndex = segments.findIndex((segment) => segment === "j");
  if (joinIndex === -1 || !segments[joinIndex + 1]) {
    return null;
  }
  return segments[joinIndex + 1];
}

export function parseZoomJoinUrl(inputUrl: string): ZoomMeetingDetails {
  let url: URL;

  try {
    url = new URL(inputUrl.trim());
  } catch {
    throw new Error("Invalid URL format");
  }

  if (url.protocol !== "https:") {
    throw new Error("Zoom join URL must use HTTPS");
  }

  if (!isAllowedZoomHost(url.hostname)) {
    throw new Error("Only zoom.us links are allowed");
  }

  const rawMeetingId = readMeetingIdFromPath(url.pathname) || url.searchParams.get("confno") || "";
  const meetingId = normalizeMeetingId(rawMeetingId);
  const password = (url.searchParams.get("pwd") || "").trim();

  return {
    meetingId,
    password,
    webUrl: url.toString(),
  };
}

export function buildZoomJoinLinks(meetingId: string, password = ""): ZoomJoinLinks {
  const normalizedMeetingId = normalizeMeetingId(meetingId);
  const params = new URLSearchParams({ confno: normalizedMeetingId });

  if (password) {
    params.set("pwd", password);
  }

  return {
    webUrl: `https://zoom.us/j/${normalizedMeetingId}${password ? `?pwd=${encodeURIComponent(password)}` : ""}`,
    desktopDeepLink: `zoommtg://zoom.us/join?${params.toString()}`,
    mobileDeepLink: `zoomus://zoom.us/join?${params.toString()}`,
  };
}

export function buildZoomJoinLinksFromWebUrl(inputUrl: string): ZoomJoinLinks {
  const { meetingId, password } = parseZoomJoinUrl(inputUrl);
  return buildZoomJoinLinks(meetingId, password);
}
