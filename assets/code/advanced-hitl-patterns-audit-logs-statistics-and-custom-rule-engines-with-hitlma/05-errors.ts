import { HITLManager, HITLTimeoutError, HITLCancelledError } from '@juspay/neurolink/hitl';

const hitlManager = new HITLManager({
  enabled: true,
  dangerousActions: ['deletedatabase'],
  timeout: 60_000, // one minute
});

async function runCriticalTask(signal: AbortSignal) {
  try {
    const result = await hitlManager.requestConfirmation(
      'deleteDatabase',
      { dbName: 'customers' },
      { userId: 'ops-bot', signal },
    );
    if (!result.approved) {
      console.log(`Reviewer rejected the action: ${result.reason ?? 'no reason given'}`);
      return;
    }
    // ... proceed on approval
  } catch (error) {
    if (error instanceof HITLTimeoutError) {
      console.error(`No answer within ${error.timeout}ms. Paging on-call.`);
    } else if (error instanceof HITLCancelledError) {
      console.warn(`Confirmation was withdrawn: ${error.reason ?? 'no reason given'}`);
    } else {
      throw error;
    }
  }
}

export {};
