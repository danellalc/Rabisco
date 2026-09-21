const TABLES = { boards: 'boards', docs: 'docs' }

function nextRevision() {
  return $security.randomString(12)
}

function claimRevision(app, table, id, expected) {
  const name = TABLES[table]
  if (!name) throw new BadRequestError('Unknown collection.')
  const revision = nextRevision()
  const result = app.db()
    .newQuery('UPDATE ' + name + ' SET revision = {:revision} WHERE id = {:id} AND revision = {:expected}')
    .bind({ revision, id, expected })
    .execute()
  if (Number(result.rowsAffected()) !== 1) throw new ApiError(409, 'The note changed elsewhere.', { revision: '' })
  return revision
}

function applyRevision(app, table, record, expected, changed) {
  if (expected !== '' && expected !== record.original().getString('revision')) {
    throw new ApiError(409, 'The note changed elsewhere.', { revision: record.original().getString('revision') })
  }
  if (!changed) return
  record.set('revision', expected === '' ? nextRevision() : claimRevision(app, table, record.id, expected))
}

module.exports = { nextRevision, claimRevision, applyRevision }
