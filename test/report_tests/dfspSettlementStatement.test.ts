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

import { DateTime } from 'luxon'
import sleep from 'sleep'
import Excel, { Worksheet } from 'exceljs'

import {
  mlIngressBasePath,
  username,
  password,
  payer,
  centralLedgerAdminEndpoint,
  reportBasePath,
  currency

} from '../config'
import login from '../login'
import {
  TestParameters
} from './types'

import { getUser, getParticipant, fundsIn, fundsOut, getDfspSettlementStatementReport } from './helpers'
import { CookieJar } from 'tough-cookie'

let cookieJarObj: CookieJar

beforeAll(async () => {
  const user = await getUser()
  const { cookieJar } = await login(username, password, mlIngressBasePath)
  cookieJarObj = cookieJar
})

describe('DFSP Settlements Statement Report', () => {
  describe('Happy Path', () => {
    it('Run a transfer, settle a settlement and extract the report', async () => {
      expect(1).toBe(1)
    })
    it('Run funds in and out, run the report ', async () => {
      // Get the start date
      const startDate: string = DateTime.now().toUTC().toISO()

      const getAllParticipantsParams: TestParameters = {
        url: new URL(`${centralLedgerAdminEndpoint}/participants`),
        method: 'GET',
        role: ''
      }

      const getParticipantParams: TestParameters = {
        url: new URL(`${centralLedgerAdminEndpoint}/participants/${payer}/accounts`),
        method: 'GET',
        role: ''
      }
      const payerAccounts = await getParticipant(getParticipantParams, cookieJarObj)
      const payerAccount = payerAccounts.filter(acc => acc.ledgerAccountType === 'SETTLEMENT' &&
                                                  acc.currency === currency)

      const fundsInParams: TestParameters = {
        url: new URL(`${centralLedgerAdminEndpoint}/participants/${payer}/accounts/${payerAccount[0].id}`),
        method: 'POST',
        role: ''
      }

      const fundsInAmount1 = '5.17'
      const fundsOutAmount1 = '7.45'
      const fundsInAmount2 = '15.92'

      const fundsInTransferId1 = await fundsIn(
        fundsInParams,
        cookieJarObj,
        currency,
        fundsInAmount1,
        'test1@test.com',
        'Test Reference funds in 1'
      )

      const fundsOutTransferId = await fundsOut(
        fundsInParams,
        cookieJarObj,
        currency,
        fundsOutAmount1,
        'test1@test.com',
        'Test Reference funds out'
      )

      const fundsInTransferId2 = await fundsIn(
        fundsInParams,
        cookieJarObj,
        currency,
        fundsInAmount2,
        'test1@test.com',
        'Test Reference funds in 2'
      )

      // Get the end date + 2 mins to allow for the transfers to complete
      const endDate: string = DateTime.now().plus({ minutes: 2 }).toUTC().toISO()

      // allow the transfers to complete
      sleep.sleep(5)

      // Get the latest settlement audit report
      const getDfspSettlementStatementReportParams: TestParameters = {
        url: new URL(`${reportBasePath}/settlementAudit?startDate=${startDate}&endDate=${endDate}&format=xlsx`),
        method: 'GET',
        role: ''
      }
      const reportFile = await getDfspSettlementStatementReport(getDfspSettlementStatementReportParams, cookieJarObj)
      // sleep.sleep(15)

      const workbook = new Excel.Workbook()
      await workbook.xlsx.readFile(reportFile)
        .then(() => {
          const worksheet = workbook.getWorksheet(`${payer}-${currency}`)

          const firstRow:any = worksheet.getRow(1)
          // console.log(`${firstRow.values[1]} ${firstRow.values[2]}`)
          expect(firstRow.values[1]).toEqual('DFSP')

          const secondRow: any = worksheet.getRow(2)
          expect(secondRow.values[2]).toEqual('SETTLEMENT')

          const fourthRow: any = worksheet.getRow(3)
          expect(fourthRow.values[1]).toEqual('Date From')
          expect(fourthRow.values[2]).toEqual(startDate)

          const fifthRow: any = worksheet.getRow(4)
          expect(fifthRow.values[1]).toEqual('Date To')
          expect(fifthRow.values[2]).toEqual(endDate)

          const sixthRow: any = worksheet.getRow(5)
          expect(sixthRow.values[1]).toEqual('Currency')
          expect(sixthRow.values[2]).toEqual(currency)

          const seventhRow: any = worksheet.getRow(7)
          expect(seventhRow.values[1]).toEqual('Transfer Id')
          expect(seventhRow.values[3]).toEqual('Date Time')
          expect(seventhRow.values[4]).toEqual('Process Description')
          expect(seventhRow.values[5]).toEqual('User')
          expect(seventhRow.values[6]).toEqual('Reference')
          expect(seventhRow.values[7]).toEqual('Funds In')
          expect(seventhRow.values[8]).toEqual('Funds Out')
          expect(seventhRow.values[9]).toEqual('Balance')

          const reportRecords: any = {}

          worksheet.eachRow((row: any, rowNumber :number) => {
            if (rowNumber > 7) {
              reportRecords[row.values[1]] = row.values
            }
          })

          // Validate the first funds in
          const firstFundsIn = reportRecords[fundsInTransferId1]
          const startingBalance = parseFloat(firstFundsIn[9].replace(',', ''))
          expect(firstFundsIn[1]).toEqual(fundsInTransferId1) // transferId
          expect(firstFundsIn[3]).not.toBeUndefined() // datetime
          expect(firstFundsIn[4]).toEqual('Testing funds in') // Process Description
          expect(firstFundsIn[5]).toEqual('test1@test.com') // user
          expect(firstFundsIn[6]).toEqual('Test Reference funds in 1') // reference
          expect(firstFundsIn[7]).toEqual(fundsInAmount1) // funds in amount
          expect(firstFundsIn[8]).toBeUndefined() // funds out amount
          expect(firstFundsIn[9]).not.toBeUndefined() // balance

          // validate the first funds out
          const firstFundsOut = reportRecords[fundsOutTransferId]
          const balanceAfterFundsOut = (startingBalance + parseFloat(fundsOutAmount1)).toFixed(2)
          expect(firstFundsOut[1]).toEqual(fundsOutTransferId) // transferId
          expect(firstFundsOut[3]).not.toBeUndefined() // datetime
          expect(firstFundsOut[4]).toEqual('Testing funds out') // Process Description
          expect(firstFundsOut[5]).toEqual('test1@test.com') // user
          expect(firstFundsOut[6]).toEqual('Test Reference funds out') // reference
          expect(firstFundsOut[7]).toBeUndefined() // funds out amount
          expect(firstFundsOut[8].replace(',', '')).toEqual(fundsOutAmount1) // funds in amount
          expect(firstFundsOut[9].replace(',', '')).toEqual(balanceAfterFundsOut) // balance

          // validate the second funds in
          const secondFundsIn = reportRecords[fundsInTransferId2]
          const balanceAfterFundsIn = (parseFloat(balanceAfterFundsOut) - parseFloat(fundsInAmount2)).toFixed(2)
          expect(secondFundsIn[1]).toEqual(fundsInTransferId2) // transferId
          expect(secondFundsIn[3]).not.toBeUndefined() // datetime
          expect(secondFundsIn[4]).toEqual('Testing funds in') // Process Description
          expect(secondFundsIn[5]).toEqual('test1@test.com') // user
          expect(secondFundsIn[6]).toEqual('Test Reference funds in 2') // reference
          expect(secondFundsIn[7].replace(',', '')).toEqual(fundsInAmount2) // funds in amount
          expect(secondFundsIn[8]).toBeUndefined() // funds out amount
          expect(secondFundsIn[9].replace(',', '')).toEqual(balanceAfterFundsIn) // balance
        })

      expect(1).toBe(1)
    })
  })
})
