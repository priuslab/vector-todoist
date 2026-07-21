migrate((app) => {
  const tasks = app.findCollectionByNameOrId('tasks');
  const goals = app.findCollectionByNameOrId('goals');
  const dumps = app.findCollectionByNameOrId('brain_dumps');
  if (dumps) {
    const status = dumps.fields.getByName ? dumps.fields.getByName('status') : dumps.fields.find((field) => field.name === 'status');
    if (status && Array.isArray(status.values) && !status.values.includes('applied')) status.values = [...status.values, 'applied'];
    app.save(dumps);
  }
  if (tasks && goals && !tasks.fields.find((field) => field.name === 'goalId')) {
    tasks.fields.add(new RelationField({ name: 'goalId', required: false, collectionId: goals.id, maxSelect: 1, cascadeDelete: false }));
    tasks.indexes = [...(tasks.indexes ?? []), 'CREATE INDEX idx_tasks_user_goal ON tasks (user, goalId)'];
    app.save(tasks);
  }
}, (app) => {
  const tasks = app.findCollectionByNameOrId('tasks');
  const field = tasks?.fields.find((item) => item.name === 'goalId');
  if (tasks && field) { tasks.fields.removeById(field.id); app.save(tasks); }
  const dumps = app.findCollectionByNameOrId('brain_dumps');
  const status = dumps?.fields.getByName ? dumps.fields.getByName('status') : dumps?.fields.find((item) => item.name === 'status');
  if (dumps && status && Array.isArray(status.values)) { status.values = status.values.filter((value) => value !== 'applied'); app.save(dumps); }
});
