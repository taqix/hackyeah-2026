import { Encoder, Profile, type FileIdMesg, type SessionMesg } from '@garmin/fitsdk';
import { importActivityFit, MemoryWearableStore, WearableService } from '../dist/index.js';

// Synthetic data only. Replace bytes with a consented upload in the host application.
const encoder = new Encoder();
const fileMessage: FileIdMesg = {
  type: 'activity',
  manufacturer: 'development',
  product: 1,
  timeCreated: new Date('2026-10-02T10:00:00Z'),
};
encoder.onMesg(Profile.MesgNum.FILE_ID!, fileMessage);
const sessionMessage: SessionMesg = {
  messageIndex: 0,
  sport: 'running',
  startTime: new Date('2026-10-02T10:00:00Z'),
  totalElapsedTime: 600,
  totalTimerTime: 550,
  totalDistance: 1000,
};
encoder.onMesg(Profile.MesgNum.SESSION!, sessionMessage);
const service = new WearableService(new MemoryWearableStore());
const owner = 'synthetic-demo-user'; // Production: derive from the verified Supabase session.
await service.registerConnection(owner, {
  id: 'manual-imports',
  user_id: owner,
  provider: 'garmin',
  provider_subject: 'manual:demo-dataset',
  transport: 'manual',
  state: 'active',
  generation: 1,
  reader: null,
  consent: {
    datasets: ['workouts'],
    hrv: false,
    detailed_sensors: false,
    ai_context: false,
    policy_version: 'v1',
  },
  capabilities: {
    workouts: { availability: 'available', evidence: 'fit-activity-summary', version: 'v1' },
  },
});
const events = await importActivityFit(encoder.close(), {
  connection_id: 'manual-imports',
  connection_generation: 1,
  provider: 'garmin',
  import_id: 'immutable-upload-1',
  observed_at: '2026-10-03T12:00:00Z',
});
await service.ingest(owner, events);
await service.ingest(owner, events); // Retrying returns the same receipt, without a second workout.
const result = await service.records(owner, {
  dataset: 'workouts',
  start_at: '2026-10-01T00:00:00Z',
  end_at: '2026-10-04T00:00:00Z',
});
console.log(
  JSON.stringify(
    { imported_workouts: result.records.length, payload: result.records[0]?.event.payload },
    null,
    2,
  ),
);
