migrate((app) => {
  const tasks = app.findCollectionByNameOrId('tasks');
  if (!tasks.fields.find((field) => field.name === 'version')) {
    // Optional during rollout so existing tasks remain readable; the gateway treats a missing value as version 0.
    tasks.fields.add(new NumberField({ name: 'version', required: false, min: 0, onlyInt: true }));
    app.save(tasks);
  }
  const changes = app.findCollectionByNameOrId('change_sets');
  if (!changes.fields.find((field) => field.name === 'taskId')) changes.fields.add(new RelationField({ name: 'taskId', required: false, collectionId: tasks.id, maxSelect: 1, cascadeDelete: false }));
  if (!changes.fields.find((field) => field.name === 'mutationKey')) changes.fields.add(new TextField({ name: 'mutationKey', required: false, max: 255 }));
  changes.indexes = changes.indexes.filter((index) => !index.includes('idx_change_sets_idempotency_key'));
  changes.indexes.push('CREATE UNIQUE INDEX idx_change_sets_user_idempotency ON change_sets (user, idempotencyKey)');
  changes.indexes.push('CREATE UNIQUE INDEX idx_change_sets_user_mutation ON change_sets (user, mutationKey) WHERE mutationKey != \'\'');
  app.save(changes);
}, (app) => {
  const tasks = app.findCollectionByNameOrId('tasks');
  tasks.fields = tasks.fields.filter((field) => field.name !== 'version');
  app.save(tasks);
  const changes = app.findCollectionByNameOrId('change_sets');
  changes.fields = changes.fields.filter((field) => !['taskId', 'mutationKey'].includes(field.name));
  changes.indexes = changes.indexes.filter((index) => !index.includes('idx_change_sets_user_idempotency'));
  changes.indexes = changes.indexes.filter((index) => !index.includes('idx_change_sets_user_mutation'));
  changes.indexes.push('CREATE UNIQUE INDEX idx_change_sets_idempotency_key ON change_sets (idempotencyKey)');
  app.save(changes);
});
