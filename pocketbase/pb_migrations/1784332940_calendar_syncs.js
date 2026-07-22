migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  const collection = new Collection({
    type: 'base', name: 'calendar_syncs',
    listRule: '@request.auth.id != "" && user = @request.auth.id',
    viewRule: '@request.auth.id != "" && user = @request.auth.id',
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
    updateRule: '@request.auth.id != "" && user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)',
    deleteRule: '@request.auth.id != "" && user = @request.auth.id',
    fields: [
      { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: 'text', name: 'date', required: true, max: 10 },
      { type: 'text', name: 'syncedAt', required: true, max: 40 },
      { type: 'bool', name: 'stale', required: true },
    ],
  });
  collection.indexes = ['CREATE UNIQUE INDEX idx_calendar_syncs_user_date ON calendar_syncs (user, date)'];
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('calendar_syncs');
  if (collection) app.delete(collection);
});
