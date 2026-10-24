"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createPlan, type PlanFormState } from "@/app/app/plans/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PLAN_MAX_WEEKS } from "@/lib/plan-dates";

const initial: PlanFormState = { status: "idle" };

export function CreatePlanForm() {
  const [state, formAction, pending] = useActionState(createPlan, initial);
  const errors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form
      action={formAction}
      aria-label="New plan"
      className="bg-card flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-start sm:p-4"
    >
      {/* Side by side on phones; joins the parent row from sm up. */}
      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] items-start gap-3 sm:contents">
        <Field data-invalid={errors?.name ? true : undefined} className="sm:flex-1">
          <FieldLabel htmlFor="plan-name">Plan name</FieldLabel>
          <Input
            id="plan-name"
            name="name"
            required
            maxLength={100}
            placeholder="e.g. 10k block"
            aria-invalid={!!errors?.name}
          />
          {errors?.name && <FieldError>{errors.name}</FieldError>}
        </Field>
        <Field data-invalid={errors?.weeks ? true : undefined} className="sm:w-28">
          <FieldLabel htmlFor="plan-weeks">Weeks</FieldLabel>
          <Input
            id="plan-weeks"
            name="weeks"
            type="number"
            inputMode="numeric"
            min={1}
            max={PLAN_MAX_WEEKS}
            defaultValue={4}
            required
            aria-invalid={!!errors?.weeks}
          />
          {errors?.weeks && <FieldError>{errors.weeks}</FieldError>}
        </Field>
      </div>
      <Button type="submit" disabled={pending} className="sm:mt-6">
        <Plus data-icon="inline-start" />
        {pending ? "Creating…" : "Create plan"}
      </Button>
      {state.status === "error" && !errors && (
        <p role="alert" className="text-destructive text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
