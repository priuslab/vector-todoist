migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  const collection = new Collection({
    type: 'base',
    name: 'calendar_busy_slots',
    listRule: '@request.auth.id != "" && user = @request.auth.id',
    viewRule: '@request.auth.id != "" && user = @request.auth.id',
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
    updateRule: '@request.auth.id != "" && user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)',
    deleteRule: '@request.auth.id != "" && user = @request.auth.id',
    fields: [
      { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: 'text', name: 'date', required: true, max: 10 },
      { type: 'text', name: 'start', required: true, max: 40 },
      { type: 'text', name: 'end', required: true, max: 40 },
      { type: 'text', name: 'syncedAt', required: true, max: 40 },
      { type: 'bool', name: 'locked', required: true },
      { type: 'bool', name: 'stale', required: true },
    ],
  });
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('calendar_busy_slots');
  if (collection) app.delete(collection);
});
