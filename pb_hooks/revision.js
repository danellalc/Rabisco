function nextRevision() {
  return $security.randomString(12)
}

function claimRevision(app, id, expected) {
  const revision = nextRevision()
  const result = app.db()
    .newQuery('UPDATE notes SET revision = {:revision} WHERE id = {:id} AND revision = {:expected}')
    .bind({ revision, id, expected })
    .execute()
  if (Number(result.rowsAffected()) !== 1) throw new ApiError(409, 'The note changed elsewhere.', { revision: '' })
  return revision
}

module.exports = { nextRevision, claimRevision }
