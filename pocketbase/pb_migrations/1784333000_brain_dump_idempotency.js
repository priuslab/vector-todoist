migrate((app) => {
  const collection = app.findCollectionByNameOrId('brain_dumps');
  collection.fields.add(new TextField({ name: 'idempotencyKey', required: false, max: 256 }));
  collection.fields.add(new TextField({ name: 'timezone', required: false, max: 100 }));
  collection.indexes = [...collection.indexes, 'CREATE UNIQUE INDEX idx_brain_dumps_user_idempotency_key ON brain_dumps (user, idempotencyKey)'];
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('brain_dumps');
  collection.indexes = collection.indexes.filter((index) => !index.includes('idx_brain_dumps_user_idempotency_key'));
  collection.fields.removeByName('idempotencyKey');
  collection.fields.removeByName('timezone');
  app.save(collection);
});
