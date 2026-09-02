import "server-only";

import { validateRecipeDraftPayload } from "@/lib/cookbook-v2/domain";
import type {
  RecipeGenerationInput,
  RecipeGenerationProvider,
} from "@/lib/cookbook-v2/generation-provider";
import { supabaseAdmin } from "@/lib/supabase/admin";

type ClaimedJob = {
  id: string;
  idempotency_key: string;
  input_payload: {
    production_item?: {
      id?: string;
      name?: string;
      kind?: string;
      active?: boolean;
      recipe_requirement?: "required" | "optional" | "none";
    };
    sources?: Array<{
      source_type?: string;
      source_id?: string | null;
      name?: string;
      mapping_state?: "confirmed" | "proposed" | "rejected";
    }>;
  };
};

export type IntakeProcessingSummary = {
  claimed: number;
  ready: number;
  needsInput: number;
  failed: number;
};

function generationInput(job: ClaimedJob): RecipeGenerationInput {
  const item = job.input_payload.production_item;
  if (!item?.id || !item.name || !item.kind || !item.recipe_requirement) {
    throw new Error("Job has an invalid production-item payload.");
  }

  return {
    jobId: job.id,
    idempotencyKey: job.idempotency_key,
    productionItem: {
      id: item.id,
      name: item.name,
      kind: item.kind,
      active: item.active ?? true,
      recipeRequirement: item.recipe_requirement,
    },
    sources: (job.input_payload.sources ?? []).map((source) => ({
      sourceType: source.source_type ?? "unknown",
      sourceId: source.source_id ?? null,
      name: source.name ?? "",
      mappingState: source.mapping_state ?? "proposed",
    })),
  };
}

export async function processRecipeIntakeJobs({
  provider,
  workerId,
  limit = 5,
}: {
  provider: RecipeGenerationProvider;
  workerId: string;
  limit?: number;
}): Promise<IntakeProcessingSummary> {
  const { data, error } = await supabaseAdmin.rpc("claim_recipe_intake_jobs", {
    worker_id: workerId,
    claim_limit: limit,
    lease_seconds: 600,
  });

  if (error) {
    throw new Error(`Could not claim recipe jobs: ${error.message}`);
  }

  const jobs = (data ?? []) as ClaimedJob[];
  const summary: IntakeProcessingSummary = {
    claimed: jobs.length,
    ready: 0,
    needsInput: 0,
    failed: 0,
  };

  for (const job of jobs) {
    try {
      const input = generationInput(job);
      const result = await provider.generateRecipe(input);
      const validationErrors = validateRecipeDraftPayload(result.payload);
      const { error: completionError } = await supabaseAdmin.rpc(
        "complete_recipe_intake_job",
        {
          intake_job_id: job.id,
          worker_id: workerId,
          generated_payload: result.payload,
          payload_errors: validationErrors,
          generation_details: {
            provider: result.provider,
            model: result.model,
            providerRequestId: result.providerRequestId,
            warnings: result.warnings,
            rawResponseReference: result.rawResponseReference,
          },
        },
      );

      if (completionError) {
        throw new Error(completionError.message);
      }
      if (validationErrors.length > 0) summary.needsInput += 1;
      else summary.ready += 1;
    } catch (jobError) {
      summary.failed += 1;
      const message =
        jobError instanceof Error ? jobError.message : "Unknown generation failure";
      const { error: failureError } = await supabaseAdmin.rpc(
        "fail_recipe_intake_job",
        {
          intake_job_id: job.id,
          worker_id: workerId,
          error_message: message,
        },
      );
      if (failureError) {
        throw new Error(
          `Job ${job.id} failed and could not be recorded: ${failureError.message}`,
        );
      }
    }
  }

  return summary;
}
