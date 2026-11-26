// run
import { HITLManager } from '@juspay/neurolink/hitl';
import type { HITLConfig } from '@juspay/neurolink';

const config: HITLConfig = {
  enabled: true,
  dangerousActions: [], // rely on the rule below instead of keywords
  customRules: [
    {
      name: 'protected-config-paths',
      condition: (toolName, args) => {
        if (toolName !== 'updateConfigFile') return false;
        const path = (args as { path?: unknown })?.path;
        return typeof path === 'string' && (path.startsWith('/etc/') || path.startsWith('/root/'));
      },
      requiresConfirmation: true,
      customMessage: 'This call edits a protected configuration file.',
    },
  ],
};

const hitlManager = new HITLManager(config);

// No confirmation: the path is outside the protected directories.
console.log(hitlManager.requiresConfirmation('updateConfigFile', { path: '/tmp/app.conf' })); // false

// Confirmation required: the rule's condition matches.
console.log(hitlManager.requiresConfirmation('updateConfigFile', { path: '/etc/app.conf' })); // true

export {};
