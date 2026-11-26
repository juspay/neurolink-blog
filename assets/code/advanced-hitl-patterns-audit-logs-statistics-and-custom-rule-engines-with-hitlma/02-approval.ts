// run
import { HITLManager } from '@juspay/neurolink/hitl';
import type { ConfirmationResult } from '@juspay/neurolink';

const hitlManager = new HITLManager({
  enabled: true,
  dangerousActions: ['updateconfig'],
  allowArgumentModification: true, // tells the UI it may offer an edit box
});

// Approval UI side: show the request, then answer it.
hitlManager.on('hitl:confirmation-request', (event) => {
  const { confirmationId, arguments: proposed } = event.payload;
  console.log('Review requested:', proposed);
  // The reviewer approves but corrects the target path.
  hitlManager.processUserResponse(confirmationId, {
    approved: true,
    modifiedArguments: { path: './production.conf', content: 'data' },
    userId: 'reviewer-42',
  });
});

// Application side: ask, then run with whatever the reviewer approved.
async function runToolWithConfirmation(toolName: string, args: unknown) {
  if (!hitlManager.requiresConfirmation(toolName, args)) {
    return run(toolName, args);
  }
  const result: ConfirmationResult = await hitlManager.requestConfirmation(toolName, args);
  if (!result.approved) {
    console.log(`Rejected: ${result.reason ?? 'no reason given'}`);
    return;
  }
  return run(toolName, result.modifiedArguments ?? args);
}

function run(toolName: string, args: unknown) {
  console.log('Executing', toolName, args);
}

runToolWithConfirmation('updateConfigFile', { path: './staging.conf', content: 'data' });

export {};
