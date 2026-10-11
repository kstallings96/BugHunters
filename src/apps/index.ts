import type { ComponentType } from "react";
import type { Form } from "@/lib/types";
import { TimesTablesApp } from "./formA/TimesTablesApp";
import type { GlitchAppProps } from "./types";

/** The app each form's students test. Form B is added in stage 4. */
export const GLITCH_APPS: Partial<Record<Form, ComponentType<GlitchAppProps>>> = {
  A: TimesTablesApp,
};
