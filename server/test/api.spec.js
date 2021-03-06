/// <reference types="jest" />

const _ = require('lodash')
const Promise = require('bluebird')
const supertest = require('supertest')

const app = require('../src/app').app
const request = supertest(app)

let seeder

const yieldDb = () => seeder.read()

const cleanseDb = (db) => {
  let cleanse = {
    users: ['salt', 'hash'],
    articles: [],
    comments: ['id'],
  }

  Object.keys(db).forEach((key) => {
    db[key] = db[key].map((item) => {
      cleanse[key].forEach((prop) => {
        item[prop] = !!item[prop]
      })
      return item
    }
    )
  })
  return db
}

const snapshotAll = (res) =>
  Promise.resolve(expect(res.body).toMatchSnapshot('response'))
  .then(yieldDb)
  .then(cleanseDb)
  .then((db) => expect(db).toMatchSnapshot('DB'))

const seedUsersSingle = () => {
  const seed = _.cloneDeep(require('../seeds/users/single.json'))
  return seeder.seed({ users: [seed.user] })
}
const seedUsersMany = () => {
  const seed = _.cloneDeep(require('../seeds/users/many.json'))
  return seeder.seed(seed)
}
const seedArticlesMany = () => {
  const seed = _.cloneDeep(require('../seeds/articles/many.json'))
  return seeder.seed(seed)
}
const seedCommentsMany = () => {
  const seed = _.cloneDeep(require('../seeds/comments/many.json'))
  return seeder.seed(seed)
}
const seedAll = () =>
  seedUsersMany()
  .then(seedArticlesMany)
  .then(seedCommentsMany)


const login = () =>
  seedUsersMany()
  .then(() => seedArticlesMany())
  .then(() =>
    request
    .post('/api/users/login')
    .send({
      user: {
        email: 'jake@jake.jake',
        password: 'jakejake',
      },
    })
    .expect(200)
  )

const loginWithHeaders = () =>
  login()
  .then((res) => res.body.user.token)
  .then((token) => (aRequest) => aRequest.set('Authorization', `Bearer ${token}`))

describe('API tests', () => {
  beforeAll(() =>
    app.setup().then(() => {
      seeder = require('../lib/seeder')
    })
  )

  beforeEach(() =>
    seeder.clear()
  )

  it('GET /tags', () =>  
    seedArticlesMany()
    .then(() => request.get('/api/tags').expect(200))
    .then(snapshotAll)
  )

  it('GET /articles', () =>
    seedArticlesMany()
    .then(() => seedUsersMany())
    .then(() => request.get('/api/articles').expect(200))
    .then(snapshotAll)
  )

  it('PUT /articles/:article', () =>
    loginWithHeaders()
    .then((applyHeaders) => applyHeaders(request.put('/api/articles/articleslug-1'))
    .send(
      {
        'article': {
          'title': 'Did you train your dragon?',
        },
      }
    ).expect(200))
    .then(snapshotAll)
  )

  it('GET /articles/:article', () =>
    seedAll()
    .then((db) => db.articles[0].slug)
    .then((slug) => request.get(`/api/articles/${slug}`).expect(200))
    .then(snapshotAll)
  )

  it('GET /feed with auth', () =>
    loginWithHeaders()
    .then((applyHeaders) =>
      applyHeaders(request.get('/api/articles/feed')).expect(200)
    )
    .then(snapshotAll)
  )

  it('POST /:article/comments', () =>
    loginWithHeaders()
    .then((applyHeaders) =>
      applyHeaders(request.post('/api/articles/articleslug-1/comments'))
      .send({
        comment: {
          body: 'POST test comment',
        },
      })
      .expect(200)
    )
    .then((res) => {
      res.body.comment.id = !!res.body.comment.id
      return res
    })
    .then(snapshotAll)
  )

  it('POST /articles', () =>
    loginWithHeaders()
    .then((applyHeaders) =>
      applyHeaders(request.post('/api/articles'))
      .send({
        article: {
          title: 'How to train your dragon',
          description: 'Ever wonder how?',
          body: 'You have to believe',
          tagList: ['reactjs', 'angularjs', 'dragons'],
        },
      })
      .expect(200)
    )
    .then(snapshotAll)
  )

  it('POST /articles/:article/favorite', () =>
    loginWithHeaders()
    .then((applyHeaders) =>
      applyHeaders(
        request.post('/api/articles/articleslug-1/favorite')
      ).expect(200)
    )
    .then(snapshotAll)
  )

  it('DELETE /articles/:article/favorite', () =>
    loginWithHeaders()
    .then((applyHeaders) =>
      applyHeaders(
        request.delete('/api/articles/articleslug-1/favorite')
      ).expect(200)
    )
    .then(snapshotAll)
  )

  it('GET /articles/:article/comments', () =>
    seedUsersMany()
    .then(() => seedCommentsMany())
    .then(() => seedArticlesMany())
    .then((db) => db.articles[0].slug)
    .then((slug) => request.get(`/api/articles/${slug}/comments`).expect(200))
    .then(snapshotAll)
  )

  it('DELETE /:article/comments/:comment', () =>
    seedCommentsMany()
    .then(() => loginWithHeaders())
    .then((applyHeaders) =>
      applyHeaders(
        request.delete('/api/articles/articleslug-1/comments/1')
      ).expect(204)
    )
    .then(snapshotAll)
  )

  it('GET /profiles/:username', () =>
    seedUsersSingle()
    .then((db) => db.users[0].username)
    .then((username) => request.get(`/api/profiles/${username}`).expect(200))
    .then(snapshotAll)
  )

  it('POST /profiles/:username/follow', () =>
    loginWithHeaders()
    .then((applyHeaders) =>
      applyHeaders(request.post('/api/profiles/jake/follow')).expect(200)
    )
    .then(snapshotAll)
  )

  it('DELETE /profiles/:username/follow', () =>
    loginWithHeaders()
    .then((applyHeaders) =>
      applyHeaders(request.delete('/api/profiles/jake/follow')).expect(200)
    )
    .then(snapshotAll)
  )

  it('GET /user', () =>
    loginWithHeaders()
    .then((applyHeaders) => applyHeaders(request.get('/api/user')).expect(200))
    .then(snapshotAll)
  )


  it('PUT /user', () =>
    loginWithHeaders()
    .then((applyHeaders) => applyHeaders(request.put('/api/user'))
    .send(
      {
        'user': {
          'bio': 'I like to skateboard',
          'image': 'https://i.stack.imgur.com/xHWG8.jpg',
        },
      }).expect(200))
    .then(snapshotAll)
  )

  it('POST /users/login', () =>
    login()
    .then((res) => {
      res.body.user.token = !!res.body.user.token
      return res
    })
    .then(snapshotAll)
  )

  it('POST /users', () =>
    request.post('/api/users')
    .send({
      'user': {
        'username': 'John',
        'email': 'john@john.john',
        'password': 'newpass123',
      },
    })
    .expect(200)
    .then(snapshotAll)
  )

  it('GET /articles?author=jake', () =>
    seedAll()
    .then(() => request.get('/api/articles?author=jake').expect(200))
    .then(snapshotAll)
  )

  it('POST users/login (no email)', () => 
    seedAll()
      .then(() =>
        request.post('/api/users/login')
        .send({
          user: {
            password: 'jakejake',
          },
        })
        .expect(422)
    )
    .then(snapshotAll)
  )

  it('POST users/login (no password)', () => 
    seedAll()
      .then(() =>
        request.post('/api/users/login')
        .send({
          user: {
            email: "jake@jake.jake"
          },
        })
        .expect(422)
    )
    .then(snapshotAll)
  )

  it('POST users/login (no password | email)', () => 
    seedAll()
      .then(() =>
        request.post('/api/users/login')
        .send({
          user: {
          },
        })
        .expect(422)
    )
    .then(snapshotAll)
  )
})
