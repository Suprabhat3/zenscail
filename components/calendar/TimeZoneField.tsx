"use client";

import { useEffect, useState } from "react";

/** Hidden input carrying the browser's IANA timezone for event create/update. */
export function TimeZoneField() {
  const [tz, setTz] = useState("");
  useEffect(() => {
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);
  return <input type="hidden" name="timeZone" value={tz} />;
}
