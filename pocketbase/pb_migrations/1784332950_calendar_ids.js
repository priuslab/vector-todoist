migrate((app) => {
  const collection = app.findCollectionByNameOrId('calendar_connections');
  if (collection && !collection.fields.getByName('calendarIds')) collection.fields.add(new JSONField({ name: 'calendarIds', required: false }));
  if (collection) app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('calendar_connections');
  if (collection) {
    const field = collection.fields.getByName('calendarIds');
    if (field) collection.fields.removeById(field.id);
    app.save(collection);
  }
});
