import { z } from "zod";

const vectorSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const setNameSchema = z.object({
  name: z.string().trim().min(1).max(24),
});

export const setReadySchema = z.object({
  isReady: z.boolean(),
});

export const moveSchema = vectorSchema.extend({
  rotY: z.number(),
});

export const interactSchema = z.object({
  objectId: z.string().min(1),
  interactionType: z.enum(["use", "open", "close", "toggle", "pickup"]),
});

export const useItemSchema = z.object({
  itemId: z.enum(["flashlight", "emf", "thermometer", "camera"]),
  action: z.enum(["primary", "secondary"]),
});

export const submitEvidenceSchema = z.object({
  evidence: z.array(z.enum(["emf", "freezing", "fingerprints"])).max(3),
});

export const requestEscapeSchema = z.object({
  confirm: z.boolean(),
});

export type SetNameMessage = z.infer<typeof setNameSchema>;
export type SetReadyMessage = z.infer<typeof setReadySchema>;
export type ClientMoveMessage = z.infer<typeof moveSchema>;
export type ClientInteractMessage = z.infer<typeof interactSchema>;
export type ClientUseItemMessage = z.infer<typeof useItemSchema>;
export type ClientSubmitEvidenceMessage = z.infer<typeof submitEvidenceSchema>;
export type ClientRequestEscapeMessage = z.infer<typeof requestEscapeSchema>;
