migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  const tasks = app.findCollectionByNameOrId('tasks');
  if (!users || !tasks) return;
  const metrics = new Collection({ type: 'base', name: 'adaptation_metrics', listRule: '@request.auth.id != "" && user = @request.auth.id', viewRule: '@request.auth.id != "" && user = @request.auth.id', createRule: '@request.auth.id != "" && user = @request.auth.id', updateRule: '@request.auth.id != "" && user = @request.auth.id', deleteRule: '@request.auth.id != "" && user = @request.auth.id', fields: [
    { type: 'relation', name: 'user', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
    { type: 'bool', name: 'consent', required: true },
    { type: 'json', name: 'metricsJson', required: true, maxSize: 100000 },
    { type: 'json', name: 'suggestionsJson', required: true, maxSize: 100000 },
    { type: 'text', name: 'updatedAt', required: true, max: 40 },
  ] });
  metrics.indexes = ['CREATE UNIQUE INDEX idx_adaptation_metrics_user ON adaptation_metrics (user)'];
  app.save(metrics);
}, (app) => { const metrics = app.findCollectionByNameOrId('adaptation_metrics'); if (metrics) app.delete(metrics); });
