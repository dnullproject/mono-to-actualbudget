// npm install --save @actual-app/api
const actualApi = require('@actual-app/api');

const CACHE_DIR_PATH = '.cache/';
const MONO_URL = 'https://api.monobank.ua/';
let TOTAL_DAYS_SYNC = parseInt(process.env.DAYS_TO_SYNC);
const DEFAULT_DAYS_SYNC = TOTAL_DAYS_SYNC < 7 ? TOTAL_DAYS_SYNC : 7;

function create_cache_dir() {
  const fs = require('fs');
  const dir = CACHE_DIR_PATH;

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
}

function log(text) {
  if (process.env.DEBUG) {
    console.log(text);
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

(async () => {
  // MONO
  async function fetchMonoData(startDateTimestamp, endDateTimestamp) {
    try {
      const response = await fetch(MONO_URL + '/personal/statement/' + process.env.MONO_CARD + '/' + startDateTimestamp + '/' + endDateTimestamp, {
        headers: { 'X-Token': process.env.MONO_TOKEN, },
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(error);
    }
  }

  async function fetchActualData(startDateIso, endDateIso) {
    try {
      const actual_data = await actualApi.runQuery(
          actualApi.q('transactions')
                  .filter({
                    date: [
                      { $gte: startDateIso },
                      { $lte: endDateIso }
                    ]
                  })
                  .select('*')
        );
      // actual_data structure
      // const actual_data = {
      //   data: [
      //     {
      //       id: '8eb6241f-3d36-48aa-aab6-c2c8e',
      //       is_parent: false,
      //       is_child: false,
      //       parent_id: null,
      //       account: null,
      //       category: null,
      //       amount: -15200,
      //       payee: '13c21c0a-284a-4689-b4',
      //       notes: null,
      //       date: '2024-01-35',
      //       imported_id: null,
      //       error: null,
      //       imported_payee: '...',
      //       starting_balance_flag: false,
      //       transfer_id: null,
      //       sort_order: 1706225650763,
      //       cleared: true,
      //       reconciled: false,
      //       tombstone: false,
      //       schedule: null
      //     },
      //   ],
      //   dependencies: [ 'transactions', 'accounts', 'categories', 'payees', 'schedules' ]
      // }
      return actual_data.data
    } catch (error) {
      console.error(error);
    }
  }

  // START
  create_cache_dir();

  await actualApi.init({
    dataDir: CACHE_DIR_PATH,
    serverURL: process.env.ACTUAL_URL,
    password: process.env.ACTUAL_PASSWORD,
  });

  await actualApi.downloadBudget(process.env.ACTUAL_SYNC_ID);

  let endDate = new Date();

  const startDate = new Date();

  while (TOTAL_DAYS_SYNC > 0) {
    const endDateIso = endDate.toISOString().slice(0, 10);
    const endDateTimestamp = endDate.getTime();

    // set date as end - DAYS_TO_SYNC
    startDate.setDate(endDate.getDate() - DEFAULT_DAYS_SYNC);

    const startDateIso = startDate.toISOString().slice(0, 10);
    const startDateTimestamp = startDate.getTime();

    console.log('Sync: ' + startDateIso + ' ' + endDateIso);

    // const example_mono_trans = [
    //   {
    //     id: 'aaaa',
    //     time: 1705091543,
    //     description: 'test',
    //     mcc: 4829,
    //     originalMcc: 4829,
    //     amount: -100,
    //     operationAmount: -100,
    //     currencyCode: 980,
    //     commissionRate: 0,
    //     cashbackAmount: 0,
    //     balance: 536687,
    //     hold: true,
    //     receiptId: 'xxxxx'
    //   }
    // ];

    let transactions = [];

    const actual_data = await fetchActualData(startDateIso, endDateIso);
    log("actual data")
    log(actual_data);
    log("end actual data")

    const mono_data = await fetchMonoData(startDateTimestamp);
    log("mono data")
    log(mono_data);
    log("end mono data")

    if (mono_data && mono_data.length > 0) {
      for (const exp of mono_data) {
        let create_trans = new Object();

        create_trans.account = process.env.ACTUAL_CARD;
        create_trans.amount = exp.amount;
        create_trans.date = new Date(exp.time * 1000).toISOString().slice(0, 10);
        create_trans.payee_name = exp.description;

        const found = actual_data.find((actual) => {
            if (create_trans.amount == actual.amount) {
              if (create_trans.payee_name == actual.imported_payee) {
                log('duplicate: amount' + create_trans.amount + ' payee:' + create_trans.payee_name);
                return true;
              }
              if (create_trans.payee_name == actual.payee) {
                log('duplicate:: amount' + create_trans.amount + ' payee:' + create_trans.payee_name);
                return true;
              }
            }
            return false;
          }
        );

        if (found) {
          log('skipping date: ' + create_trans.date + 'amount: ' + create_trans.amount + ' payee: ' + create_trans.payee_name);
        } else {
          log('create date: ' + create_trans.date + 'amount: ' + create_trans.amount + ' payee: ' + create_trans.payee_name);
          transactions.push(create_trans);
        }
      }
    }

    if (transactions.length > 0) {
      console.log("adding " + transactions.length + " transactions");
      log("transactions")
      log(transactions)
      log("end transactions")
      let result = await actualApi.addTransactions(process.env.ACTUAL_CARD, transactions);
      log(result);
    } else {
      log('No new data to be added: ' + transactions.length)
    }

    endDate = startDate;
    TOTAL_DAYS_SYNC -= DEFAULT_DAYS_SYNC;

    await sleep(200);
  }

  await actualApi.shutdown();
})();
