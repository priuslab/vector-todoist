migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  const calendarConnections = new Collection({
    type: 'base',
    name: 'calendar_connections',
    listRule: '@request.auth.id != "" && user = @request.auth.id',
    viewRule: '@request.auth.id != "" && user = @request.auth.id',
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
    updateRule: '@request.auth.id != "" && user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)',
    deleteRule: '@request.auth.id != "" && user = @request.auth.id',
    fields: [
      { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: 'select', name: 'provider', required: true, maxSelect: 1, values: ['google'] },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['connected', 'attention', 'disabled'] },
      { type: 'text', name: 'encryptedRefreshToken', required: true, max: 2_000 },
      { type: 'email', name: 'accountEmail', required: false },
      { type: 'json', name: 'scopes', required: false },
      { type: 'date', name: 'tokenExpiresAt', required: false },
    ],
  });
  calendarConnections.indexes = ['CREATE UNIQUE INDEX idx_calendar_connections_user_provider ON calendar_connections (user, provider)'];
  app.save(calendarConnections);
}, (app) => {
  app.delete(app.findCollectionByNameOrId('calendar_connections'));
});
