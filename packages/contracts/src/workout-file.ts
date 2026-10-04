import { z } from 'zod';

const finite = z.number().finite();
export const workoutFileMetricSchema = z
  .strictObject({
    value: finite.nonnegative().nullable(),
    unit: z.string(),
    origin: z.enum(['source', 'derived']),
    method: z.string(),
    complete: z.boolean(),
    coverage: z.record(z.string(), finite.nonnegative()).optional(),
    parameters: z.record(z.string(), z.union([finite, z.string()])).optional(),
  })
  .refine((m) => m.value !== null || !m.complete, 'Missing metric cannot be complete');
export type WorkoutFileMetric = z.infer<typeof workoutFileMetricSchema>;
export const workoutFileSummarySchema = z.strictObject({
  schemaVersion: z.literal('1.0'),
  source: z.strictObject({
    format: z.enum(['fit', 'gpx']),
    sizeBytes: z.number().int().positive(),
  }),
  activities: z.array(
    z.strictObject({
      id: z.string(),
      name: z.string().nullable(),
      sport: z.string().nullable(),
      startTime: z.string().nullable(),
      endTime: z.string().nullable(),
      sampleCount: z.number().int().nonnegative(),
      segmentCount: z.number().int().nonnegative(),
      lapCount: z.number().int().nonnegative(),
      metrics: z.record(z.string(), workoutFileMetricSchema),
    }),
  ),
  routeCount: z.number().int().nonnegative(),
  waypointCount: z.number().int().nonnegative(),
  warnings: z.array(z.strictObject({ code: z.string(), entity: z.string(), message: z.string() })),
});
export type WorkoutFileSummary = z.infer<typeof workoutFileSummarySchema>;
