migrate((app) => {
  const notes = app.findCollectionByNameOrId('notes')
  notes.fields.add(new TextField({ name: 'title', max: 120 }))
  notes.fields.add(new TextField({ name: 'cover', max: 200 }))
  notes.updateRule = 'user = @request.auth.id && @request.body.user:isset = false && @request.body.share_token:isset = false && @request.body.title:isset = false && @request.body.cover:isset = false'
  app.save(notes)
}, (app) => {
  const notes = app.findCollectionByNameOrId('notes')
  notes.fields.removeByName('title')
  notes.fields.removeByName('cover')
  notes.updateRule = 'user = @request.auth.id && @request.body.user:isset = false && @request.body.share_token:isset = false'
  app.save(notes)
})
