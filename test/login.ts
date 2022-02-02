/*****
 License
 --------------
 Copyright © 2020 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the
 Apache License, Version 2.0 (the 'License') and you may not use these files
 except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files
 are distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied. See the License for the specific language
 governing permissions and limitations under the License.
 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 - Matt Kingston - matt.kingston@modusbox.com
 - Vijaya Kumar Guthi <vijaya.guthi@modusbox.com>

 --------------
 ******/

// This code was created as follows:
// 1. open an empty browser page/tab
// 2. open developer tools, network tab
// 3. choose "Preserve Log"
// 4. navigate to BOF login
// 5. log in using valid credentials
// 6. reproduce the observed network traffic here to login and retrieve session token etc.
//
// If problems are encountered, comparing the behaviour of login against the behaviour of this code
// might be prudent.

import { strict as assert } from 'assert'
import got from 'got'
import { URL, URLSearchParams } from 'url'
import { parse } from 'node-html-parser'
import { CookieJar } from 'tough-cookie'
import { promisify } from 'util'

export default async function login (username: string, password: string, basePath: string) {
  const cookieJar = new CookieJar()
  const assertCookie = async (url: string, key: string) => {
    const getCookies = promisify(cookieJar.getCookies.bind(cookieJar))
    const haveCookie = await getCookies(url).then(
      (cookies) => cookies.some((c) => c.key === key)
    )
    assert(haveCookie, `${key} cookie at ${url} is required to proceed`)
  }

  // This should fail and return a 401, but we'll get the CSRF token from it
  await got(`${basePath}/kratos/sessions/whoami`, {
    headers: {
      accept: 'application/json, text/plain, */*',
      Referer: `${basePath}/`,
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    },
    method: 'GET',
    throwHttpErrors: false,
    cookieJar
  })

  await assertCookie(`${basePath}/kratos/`, 'csrf_token')

  const browser = await got(`${basePath}/kratos/self-service/registration/browser`, {
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
    },
    method: 'GET',
    throwHttpErrors: false,
    followRedirect: false,
    cookieJar
  })

  assert.equal(browser.statusCode, 302, 'Expected 302')
  assert(browser.headers.location, 'Need to know where we were redirected')
  const locationUrl = new URL(browser.headers.location)

  const flow = locationUrl.searchParams.get('flow')
  assert(flow, 'Need flow ID')

  const formPage = await got(locationUrl, {
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
      Referer: `${basePath}/`
    },
    method: 'GET',
    throwHttpErrors: false,
    followRedirect: false,
    cookieJar
  })
  const html = parse(formPage.body)
  const body_csrf_token = html.querySelector('input[name="csrf_token"]')?.attrs.value
  const body_provider = html.querySelector('input[name="provider"]')?.attrs.value
  assert(body_csrf_token, 'csrf_token extracted from form page required to proceed')
  assert(body_provider, 'provider extracted from form page required to proceed')
  const bodyParams = new URLSearchParams({ csrf_token: body_csrf_token, provider: body_provider })

  const auth = await got(`${basePath}/kratos/self-service/methods/oidc/auth/${flow}`, {
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: bodyParams.toString(),
    throwHttpErrors: false,
    followRedirect: false,
    method: 'POST',
    cookieJar
  })

  assert.equal(auth.statusCode, 302, 'Expected to receive a redirect to authorize')
  assert(auth.headers.location, 'Expected to receive redirect location for authorize')

  await assertCookie(`${basePath}/`, 'ory_kratos_continuity')

  const authorizeUrl = new URL(auth.headers.location)

  const authorize = await got(authorizeUrl, {
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
    },
    method: 'GET',
    throwHttpErrors: false,
    followRedirect: false,
    cookieJar
  })

  assert.equal(authorize.statusCode, 302, 'Expected to receive a redirect to login')
  assert(authorize.headers.location, 'Expected to receive redirect location for login')
  const loginUrl = new URL(authorize.headers.location)
  const sessionDataKey = loginUrl.searchParams.get('sessionDataKey')
  assert(sessionDataKey, 'Need to extract session data key from login redirect URL')

  const bodyParamsCredentials = new URLSearchParams({
    username,
    password,
    sessionDataKey
  })
  const commonAuth = await got(`${loginUrl.origin}/commonauth`, {
    headers: {
      Referer: loginUrl.toString(),
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
      'content-type': 'application/x-www-form-urlencoded'
    },
    cookieJar,
    body: bodyParamsCredentials.toString(),
    method: 'POST',
    throwHttpErrors: false,
    followRedirect: false
  })

  assert.equal(commonAuth.statusCode, 302, 'Expected to receive a redirect to authorize')
  assert(commonAuth.headers.location, 'Expected to receive redirect location for authorize')
  const authorizeUrl2 = new URL(commonAuth.headers.location)
  await assertCookie(loginUrl.origin, 'commonAuthId')

  const authorize2 = await got(authorizeUrl2, {
    headers: {
      accept: 'ext/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
    },
    method: 'GET',
    throwHttpErrors: false,
    followRedirect: false,
    cookieJar
  })

  assert.equal(authorize2.statusCode, 302, 'Expected to receive a redirect to authorize')
  assert(authorize2.headers.location, 'Expected to receive redirect location for authorize')
  let idpCallbackUrl: URL
  // Check if the redirect location is Oauth2 consent URL
  if (authorize2.headers.location.includes('authenticationendpoint/oauth2_consent.do')) {
    const oauth2ConsentUrl = new URL(authorize2.headers.location)
    await assertCookie(loginUrl.origin, 'commonAuthId')
    const sessionDataKeyConsent = oauth2ConsentUrl.searchParams.get('sessionDataKeyConsent')
    assert(sessionDataKeyConsent, 'Need to extract session data key consent from login redirect URL')
    const consentResponse = await got(oauth2ConsentUrl, {
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
      },
      method: 'GET',
      throwHttpErrors: false,
      followRedirect: false,
      cookieJar
    })
    assert.equal(consentResponse.statusCode, 200, 'Expected to receive a 200')

    // Approving user consents, max 10 consents will be approved by the following request
    const bodyParamsConsent = new URLSearchParams({
      consent: 'approve',
      'scope-approval': 'approve',
      sessionDataKeyConsent,
      user_claims_consent: 'true',
      consent_select_all: 'on',
      consent_0: 'on',
      consent_1: 'on',
      consent_2: 'on',
      consent_3: 'on',
      consent_4: 'on',
      consent_5: 'on',
      consent_6: 'on',
      consent_7: 'on',
      consent_8: 'on',
      consent_9: 'on',
      consent_10: 'on'
    })
    const consentApproval = await got(`${loginUrl.origin}/oauth2/authorize`, {
      headers: {
        Referer: loginUrl.toString(),
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'content-type': 'application/x-www-form-urlencoded'
      },
      cookieJar,
      body: bodyParamsConsent.toString(),
      method: 'POST',
      throwHttpErrors: false,
      followRedirect: false
    })
    assert.equal(consentApproval.statusCode, 302, 'Expected to receive a redirect to consent')
    assert(consentApproval.headers.location, 'Expected to receive redirect location for consent')
    idpCallbackUrl = new URL(consentApproval.headers.location)
  } else {
    idpCallbackUrl = new URL(authorize2.headers.location)
  }
  assert(idpCallbackUrl, 'Expected idpCallbackUrl to be set')

  await got(idpCallbackUrl, {
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'
    },
    method: 'GET',
    throwHttpErrors: false,
    followRedirect: false,
    cookieJar
  })

  await assertCookie(`${basePath}/kratos/`, 'csrf_token')
  await assertCookie(`${basePath}/`, 'ory_kratos_continuity')
  await assertCookie(`${basePath}/`, 'ory_kratos_session')

  const whoamiResult = await got(`${basePath}/kratos/sessions/whoami`, {
    headers: {
      accept: 'application/json, text/plain, */*'
    },
    cookieJar,
    method: 'GET'
  })

  assert.equal(whoamiResult.statusCode, 200, 'Whoami failed')
  return {
    whoami: JSON.parse(whoamiResult.body),
    cookieJar
  }
}
