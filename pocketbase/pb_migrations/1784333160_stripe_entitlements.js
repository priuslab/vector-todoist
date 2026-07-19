migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  if (!users) return;
  const entitlements = new Collection({ type: 'base', name: 'stripe_entitlements', listRule: '@request.auth.id != "" && user = @request.auth.id', viewRule: '@request.auth.id != "" && user = @request.auth.id', createRule: '', updateRule: '', deleteRule: '', fields: [
    { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
    { type: 'text', name: 'product', required: true, max: 100 },
    { type: 'text', name: 'priceId', required: true, max: 200 },
    { type: 'select', name: 'mode', required: true, maxSelect: 1, values: ['test', 'live'] },
    { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['active', 'revoked'] },
    { type: 'text', name: 'checkoutSessionId', required: true, max: 255 },
    { type: 'date', name: 'activatedAt', required: true },
    { type: 'date', name: 'updatedAt', required: true },
  ] });
  entitlements.indexes = ['CREATE UNIQUE INDEX idx_stripe_entitlements_user_product ON stripe_entitlements (user, product)'];
  app.save(entitlements);
  const events = new Collection({ type: 'base', name: 'stripe_webhook_events', listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '', fields: [
    { type: 'text', name: 'eventId', required: true, max: 255 },
    { type: 'text', name: 'eventType', required: true, max: 100 },
    { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['received', 'processed', 'ignored', 'failed'] },
    { type: 'text', name: 'userId', required: false, max: 128 },
    { type: 'date', name: 'receivedAt', required: true },
    { type: 'date', name: 'processedAt', required: false },
  ] });
  events.indexes = ['CREATE UNIQUE INDEX idx_stripe_webhook_events_event_id ON stripe_webhook_events (eventId)'];
  app.save(events);
}, (app) => {
  for (const name of ['stripe_webhook_events', 'stripe_entitlements']) { const collection = app.findCollectionByNameOrId(name); if (collection) app.delete(collection); }
});
