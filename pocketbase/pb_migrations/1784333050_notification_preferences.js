migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  if (!users) return;
  const preferences = new Collection({
    type: 'base', name: 'notification_preferences',
    listRule: '@request.auth.id != "" && user = @request.auth.id',
    viewRule: '@request.auth.id != "" && user = @request.auth.id',
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
    updateRule: '@request.auth.id != "" && user = @request.auth.id',
    deleteRule: '@request.auth.id != "" && user = @request.auth.id',
    fields: [
      { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: 'text', name: 'timezone', required: true, max: 100 },
      { type: 'text', name: 'quietStart', required: true, max: 5 },
      { type: 'text', name: 'quietEnd', required: true, max: 5 },
      { type: 'bool', name: 'remindersEnabled', required: true },
      { type: 'bool', name: 'morningPlanEnabled', required: true },
      { type: 'bool', name: 'eveningReviewEnabled', required: true },
    ],
  });
  preferences.indexes = ['CREATE UNIQUE INDEX idx_notification_preferences_user ON notification_preferences (user)'];
  app.save(preferences);
  const claims = new Collection({
    type: 'base', name: 'notification_claims', listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '',
    fields: [
      { type: 'text', name: 'notificationKey', required: true, max: 500 },
      { type: 'date', name: 'claimedAt', required: true },
    ],
  });
  claims.indexes = ['CREATE UNIQUE INDEX idx_notification_claims_key ON notification_claims (notificationKey)'];
  app.save(claims);
}, (app) => {
  for (const name of ['notification_claims', 'notification_preferences']) {
    const collection = app.findCollectionByNameOrId(name);
    if (collection) app.delete(collection);
  }
});
