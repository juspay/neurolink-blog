// run
import { HITLManager } from '@juspay/neurolink/hitl';
import type { HITLAuditLog } from '@juspay/neurolink';

const hitlManager = new HITLManager({
  enabled: true,
  dangerousActions: ['delete'],
  auditLogging: true,
});

hitlManager.on('hitl:audit', (entry: HITLAuditLog) => {
  // Forward to your log pipeline; one line per audit event. Keep entry.timestamp in a
  // real pipeline; it is left out here so the saved output is the same on every run.
  console.log(JSON.stringify({
    event: entry.eventType,
    tool: entry.toolName,
    by: entry.userId,
    reason: entry.reason,
  }));
});

// A stand-in reviewer that answers a moment after the request is shown.
hitlManager.on('hitl:confirmation-request', (event) => {
  const { confirmationId } = event.payload;
  setTimeout(() => {
    hitlManager.processUserResponse(confirmationId, {
      approved: false,
      reason: 'needs a ticket number',
      userId: 'reviewer-42',
    });
  }, 10);
});

const result = await hitlManager.requestConfirmation('deleteUser', { userId: 'u-314' }, { userId: 'ops-bot' });
console.log(`approved: ${result.approved}`);

export {};
