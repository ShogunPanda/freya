// @ts-expect-error
import { hmac } from 'https://deno.land/x/hmac@v2.0.1/mod.ts'

const key = '@KEY@'
const secret = '@SECRET@'

function createResponse(statusCode: number, data: unknown | undefined): Response {
  return new Response(JSON.stringify(data), { status: statusCode, headers: { 'content-type': 'application/json' } })
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'GET') {
    return createResponse(404, { statusCode: 404, error: 'Not Found', message: 'Not found.' })
  }

  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) {
    return createResponse(404, {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Please send the authentication data as application/x-www-form-urlencoded.'
    })
  }

  const form = await request.formData()
  const socket = form.get('socket_id')
  const channel = form.get('channel_name')

  if (!socket || !channel) {
    return createResponse(401, { statusCode: 401, error: 'Unauthorized', message: 'Missing authentication data.' })
  }

  const user = JSON.stringify({ id: 'freya-slides-sync-guest' })
  const stringToSign = `${socket}:${channel}`
  const signature = hmac('sha256', secret, stringToSign, 'utf8', 'hex')

  return createResponse(200, { auth: `${key}:${signature}`, user_data: user })
}
