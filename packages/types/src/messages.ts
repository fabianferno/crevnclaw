import { z } from 'zod';

export const WSMessageTypeSchema = z.enum([
  'thought', 'tool_call', 'tool_result', 'approval_request',
  'approval_response', 'bankrupt', 'panic', 'chat', 'status',
]);

export const WSMessageSchema = z.object({
  type: WSMessageTypeSchema,
  id: z.string(),
  timestamp: z.string().datetime(),
  payload: z.record(z.unknown()),
});

export type WSMessageType = z.infer<typeof WSMessageTypeSchema>;
export type WSMessage = z.infer<typeof WSMessageSchema>;
