/** Plugins we connect, in the order the in-app popup chains through them. */
export const CONNECT_PLUGINS = ["gmail", "googlecalendar"] as const;
export type ConnectPlugin = (typeof CONNECT_PLUGINS)[number];
