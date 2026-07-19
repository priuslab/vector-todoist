migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  if (!users || app.findCollectionByNameOrId('goal_discovery_sessions')) return;
  const sessions = new Collection({
    type: 'base', name: 'goal_discovery_sessions',
    listRule: '@request.auth.id != "" && user = @request.auth.id',
    viewRule: '@request.auth.id != "" && user = @request.auth.id',
    createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
    updateRule: '@request.auth.id != "" && user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)',
    deleteRule: '@request.auth.id != "" && user = @request.auth.id',
    fields: [
      { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: 'text', name: 'protocolVersion', required: true, max: 80 },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['active', 'completed', 'skipped'] },
      { type: 'json', name: 'answersJson', required: true, maxSize: 10000 },
      { type: 'json', name: 'suggestionJson', required: false, maxSize: 10000 },
      { type: 'date', name: 'startedAt', required: true },
      { type: 'date', name: 'completedAt', required: false },
    ],
  });
  sessions.indexes = ['CREATE INDEX idx_goal_discovery_sessions_user ON goal_discovery_sessions (user)'];
  app.save(sessions);
}, (app) => { const sessions = app.findCollectionByNameOrId('goal_discovery_sessions'); if (sessions) app.delete(sessions); });
