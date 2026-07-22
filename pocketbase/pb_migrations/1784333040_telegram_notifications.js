migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  if (!users) return;
  const ownedRules = {
    listRule: '@request.auth.id != "" && user = @request.auth.id',
    viewRule: '@request.auth.id != "" && user = @request.auth.id',
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
    updateRule: '@request.auth.id != "" && user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)',
    deleteRule: '@request.auth.id != "" && user = @request.auth.id',
  };
  const pairings = new Collection({
    type: 'base', name: 'telegram_pairings', ...ownedRules,
    fields: [
      { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: 'text', name: 'tokenHash', required: true, max: 128 },
      { type: 'date', name: 'expiresAt', required: true },
      { type: 'date', name: 'consumedAt', required: false },
      { type: 'text', name: 'chatId', required: false, max: 100 },
    ],
  });
  pairings.indexes = ['CREATE UNIQUE INDEX idx_telegram_pairings_token_hash ON telegram_pairings (tokenHash)'];
  app.save(pairings);
  const connections = new Collection({
    type: 'base', name: 'telegram_connections', ...ownedRules,
    fields: [
      { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: 'text', name: 'chatId', required: true, max: 100 },
      { type: 'text', name: 'username', required: false, max: 255 },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['connected', 'disabled'] },
      { type: 'date', name: 'connectedAt', required: true },
    ],
  });
  connections.indexes = ['CREATE UNIQUE INDEX idx_telegram_connections_user ON telegram_connections (user)', 'CREATE UNIQUE INDEX idx_telegram_connections_chat ON telegram_connections (chatId)'];
  app.save(connections);
  const updates = new Collection({
    type: 'base', name: 'telegram_updates', listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '',
    fields: [{ type: 'text', name: 'updateId', required: true, max: 100 }, { type: 'date', name: 'receivedAt', required: true }],
  });
  updates.indexes = ['CREATE UNIQUE INDEX idx_telegram_updates_update_id ON telegram_updates (updateId)'];
  app.save(updates);
  const claims = new Collection({
    type: 'base', name: 'telegram_pairing_claims', listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '',
    fields: [{ type: 'text', name: 'pairingId', required: true, max: 100 }, { type: 'text', name: 'chatId', required: true, max: 100 }, { type: 'date', name: 'claimedAt', required: true }],
  });
  claims.indexes = ['CREATE UNIQUE INDEX idx_telegram_pairing_claims_pairing_id ON telegram_pairing_claims (pairingId)'];
  app.save(claims);
}, (app) => {
  for (const name of ['telegram_pairing_claims', 'telegram_updates', 'telegram_connections', 'telegram_pairings']) {
    const collection = app.findCollectionByNameOrId(name);
    if (collection) app.delete(collection);
  }
});
