import { makeExecutableSchema } from '@graphql-tools/schema'
import { compileQuery, isCompiledQuery } from 'graphql-jit'
import { parse } from 'graphql'
import md5 from 'md5'
import { data } from './data'

const typeDefs = `
  type Author {
    id: ID!
    name: String!
    md5: String!
    company: String!
    books: [Book!]!
  }

  type Book {
    id: ID!
    name: String!
    numPages: Int!
  }

  type Query {
    authors: [Author!]!
  }
`

const resolvers = {
  Author: {
    md5: (parent: { name: any }) => md5(parent.name)
  },
  Query: {
    authors: () => data
  }
}

const asyncResolvers = {
  Author: {
    md5: (parent: { name: string | number[] }) => md5(parent.name)
  },
  Query: {
    authors: async () => data
  }
}

const schema = makeExecutableSchema({ typeDefs, resolvers })

const queryCache = new Map()

const server = Bun.serve({
  port: 3000,
  development: true,
  async fetch(request) {
    if (request.method === 'POST') {
      const body = (await request.json()) as {
        query: string
        variables?: Record<string, any>
      }
      // console.log('request:', body)

      let compiledQuery = queryCache.get(body.query)

      if (!compiledQuery) {
        const document = parse(body.query)

        compiledQuery = compileQuery(schema, document)
        // check if the compilation is successful
        queryCache.set(body.query, compiledQuery)

        if (!isCompiledQuery(compiledQuery)) {
          console.error(compiledQuery)
          throw new Error('Error compiling query')
        }
      }

      const executionResult = await compiledQuery.query({}, {}, body.variables)
      return new Response(JSON.stringify(executionResult))
    }

    return new Response('404', {
      status: 404
    })
  }
})

console.log(`Listening on http://localhost:${server.port}`)
