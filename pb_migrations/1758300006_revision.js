migrate((app) => {
  const notes = app.findCollectionByNameOrId('notes')
  notes.fields.add(new TextField({ name: 'revision', max: 32 }))
  notes.updateRule = 'user = @request.auth.id && @request.body.user:isset = false && @request.body.share_token:isset = false && @request.body.title:isset = false && @request.body.cover:isset = false && @request.body.revision:isset = false'
  app.save(notes)

  const records = app.findAllRecords('notes')
  for (let index = 0; index < records.length; index++) {
    records[index].set('revision', $security.randomString(12))
    app.save(records[index])
  }
}, (app) => {
  const notes = app.findCollectionByNameOrId('notes')
  notes.fields.removeByName('revision')
  notes.updateRule = 'user = @request.auth.id && @request.body.user:isset = false && @request.body.share_token:isset = false && @request.body.title:isset = false && @request.body.cover:isset = false'
  app.save(notes)
})
