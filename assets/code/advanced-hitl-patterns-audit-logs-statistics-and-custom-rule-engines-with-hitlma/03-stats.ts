// run
import { HITLManager } from '@juspay/neurolink/hitl';

const hitlManager = new HITLManager({ enabled: true, dangerousActions: ['delete'] });

// Call this from a /metrics endpoint or a periodic job.
function printStats() {
  const stats = hitlManager.getStatistics();
  console.log('--- HITL Statistics ---');
  console.log(`Total requests: ${stats.totalRequests}`);
  console.log(`Pending now: ${stats.pendingRequests}`);
  console.log(`Approved: ${stats.approvedRequests}`);
  console.log(`Rejected: ${stats.rejectedRequests}`);
  console.log(`Timed out: ${stats.timedOutRequests}`);
  console.log(`Average response time: ${Math.round(stats.averageResponseTime)}ms`);
  console.log(`Pending (live count): ${hitlManager.getPendingCount()}`);
}

// A stand-in reviewer: approves the first request and rejects the second. It passes
// responseTime itself so the average below is the same on every run.
let answered = 0;
hitlManager.on('hitl:confirmation-request', (event) => {
  const { confirmationId, toolName } = event.payload;
  console.log(`Waiting on ${toolName}: ${hitlManager.getPendingCount()} pending`);
  answered += 1;
  if (answered === 1) {
    hitlManager.processUserResponse(confirmationId, { approved: true, userId: 'reviewer-42', responseTime: 1200 });
  } else {
    hitlManager.processUserResponse(confirmationId, { approved: false, reason: 'wrong customer', userId: 'reviewer-42', responseTime: 800 });
  }
});

await hitlManager.requestConfirmation('deleteOrder', { orderId: 'A-1001' });
await hitlManager.requestConfirmation('deleteOrder', { orderId: 'A-1002' });
printStats();

export {};
