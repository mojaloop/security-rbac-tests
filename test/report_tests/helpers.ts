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

 - Shashikant Hirugade - shashikant.hirugade@modusbox.com

 --------------
 ******/

import { v4 as uuid } from 'uuid'
import { createWriteStream } from 'fs'
import stream from 'stream'
import { promisify } from 'util'

import got, { OptionsOfJSONResponseBody } from 'got'
import {
  Users,
  User,
  TestParameters
} from './types'
import {
  roleAssignmentSvcBasePath,
  username
} from '../config'
import { CookieJar } from 'tough-cookie'
const pipeline = promisify(stream.pipeline)

const GOT_JSON_OPTS: OptionsOfJSONResponseBody = {
  isStream: false,
  resolveBodyOnly: false,
  responseType: 'json',
  throwHttpErrors: false,
  headers: {
    'content-type': 'application/json',
    accept: 'application/json'
  }
}

export async function getUser () {
  const response = await got.get<Users>(`${roleAssignmentSvcBasePath}/users`, GOT_JSON_OPTS)
  expect(response.statusCode).toEqual(200)
  const user = response.body.users?.find((user: User) => user.username === username)
  expect(user?.id).toBeDefined()
  return user
}

export async function getParticipant ({ url, method } : TestParameters, cookieJar: CookieJar): Promise<any[]> {
  const response = await got.get<any[]>({
    url,
    method,
    ...GOT_JSON_OPTS,
    cookieJar
  })
  expect(response.statusCode).toBe(200)
  return response.body
}

export async function fundsIn ({ url, method }
:TestParameters, cookieJar: CookieJar, currency: string, amount: string, user: string, reference: string):
  Promise<string> {
  const transferId = uuid()

  const body = {
    transferId,
    externalReference: reference,
    action: 'recordFundsIn',
    reason: 'Testing funds in',
    amount: {
      amount,
      currency
    },
    extensionList: {
      extension: [
        {
          key: 'user',
          value: user
        }
      ]
    }
  }
  const response = await got.post({
    method,
    url,
    throwHttpErrors: false,
    cookieJar,
    body: JSON.stringify(body)
  })
  expect(response.statusCode).toBe(202)
  return transferId
}

export async function fundsOut ({ url, method }
:TestParameters, cookieJar: CookieJar, currency: string, amount: string, user: string, reference: string)
  :Promise<string> {
  const transferId = uuid()

  const body = {
    transferId,
    externalReference: reference,
    action: 'recordFundsOutPrepareReserve',
    reason: 'Testing funds out',
    amount: {
      amount,
      currency
    },
    extensionList: {
      extension: [
        {
          key: 'user',
          value: user
        }
      ]
    }
  }
  const response = await got.post({
    method,
    url,
    throwHttpErrors: false,
    cookieJar,
    body: JSON.stringify(body)
  })
  expect(response.statusCode).toBe(202)
  return transferId
}

export async function getSettlementAuditReport ({ url, method } : TestParameters, cookieJar: CookieJar): Promise<any> {
  const downloadStream = await got.stream({
    url,
    method,
    cookieJar
  })
  const reportFile = 'settlementAuditReport.xlsx'
  const fileWriterStream = createWriteStream(reportFile)

  try {
    await pipeline(downloadStream, fileWriterStream)
    console.log(`File downloaded to ${reportFile}`)
  } catch (error) {
    console.error(`Something went wrong. ${error}`)
  }
  return reportFile
}

export async function getDfspSettlementStatementReport ({ url, method } : TestParameters, cookieJar: CookieJar): Promise<any> {
  const downloadStream = await got.stream({
    url,
    method,
    cookieJar
  })
  const reportFile = 'dfspSettlementStatementReport.xlsx'
  const fileWriterStream = createWriteStream(reportFile)

  try {
    await pipeline(downloadStream, fileWriterStream)
    console.log(`File downloaded to ${reportFile}`)
  } catch (error) {
    console.error(`Something went wrong. ${error}`)
  }
  return reportFile
}
