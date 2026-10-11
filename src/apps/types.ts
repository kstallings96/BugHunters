/**
 * Every glitch app takes the same props, so the hunt step can host any form.
 * Interactive elements carry data-feature attributes; the hunt step reads
 * those to log clicks and place flags, so apps don't log clicks themselves.
 */
export interface GlitchAppProps {
  /** Internal app happenings (question shown, skipped, ...) for analysis. */
  onAppEvent?: (type: string, payload: Record<string, unknown>) => void;
}
