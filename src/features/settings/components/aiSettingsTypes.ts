import type { AiProviderDto } from "@/api";

export type ProviderDraft = Omit<AiProviderDto, "hasKey">;
