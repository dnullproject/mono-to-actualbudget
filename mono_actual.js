// npm install --save @actual-app/api
// npm install --save node-cron@3.0.3
const actualApi = require('@actual-app/api');

const CACHE_DIR_PATH = '.cache/';
const MONO_URL = 'https://api.monobank.ua/';
let TOTAL_DAYS_SYNC = parseInt(process.env.DAYS_TO_SYNC);
const DEFAULT_DAYS_SYNC = TOTAL_DAYS_SYNC < 7 ? TOTAL_DAYS_SYNC : 7;

const MONO_INCOME_CARD = process.env.MONO_INCOME_CARD;
const MONO_EXPENSE_CARD = process.env.MONO_EXPENCE_CARD;

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
function combine_mono_data(mono_income_data, mono_expence_data) {
  for (let inc_data of mono_income_data) {
    const found = mono_expence_data.find((exp_data) => {
        if (inc_data.time === exp_data.time) {
          log('combine_mono_data: duplicate imported_payee amount ' + inc_data.amount + ' payee: ' + inc_data.description);
          return true;
        }
      return false;
    });
    // remove found element
    mono_expence_data.splice(mono_expence_data.indexOf(found), 1);

    if (found) {
      inc_data.amount += found.amount;
    }
  }

  return mono_income_data.concat(mono_expence_data);
}

async function fetch_data() {
  // MONO
  async function fetchMonoData(card, startDateTimestamp, endDateTimestamp) {
    try {
      const response = await fetch(MONO_URL + '/personal/statement/' + card + '/' + startDateTimestamp + '/' + endDateTimestamp, {
        headers: { 'X-Token': process.env.MONO_TOKEN, },
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();

      // Mono allows 1 request per 60 seconds
      if (TOTAL_DAYS_SYNC > 0) {
        await sleep(60 * 1000); // 60 seconds
      }

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
  endDate.setHours(0, 0, 0, 0);

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  while (TOTAL_DAYS_SYNC > 0) {
    const endDateIso = endDate.toISOString().slice(0, 10);
    const endDateTimestamp = endDate.getTime();

    // set date as end - DAYS_TO_SYNC
    startDate.setDate(endDate.getDate() - DEFAULT_DAYS_SYNC);

    const startDateIso = startDate.toISOString().slice(0, 10);
    const startDateTimestamp = startDate.getTime();

    console.log('Sync: ' + startDateIso + ' ' + endDateIso);

    let transactions = [];

    const actual_data = await fetchActualData(startDateIso, endDateIso);
    log("actual data")
    log(actual_data);
    log("end actual data")

    const mono_expence_data = await fetchMonoData(MONO_EXPENSE_CARD, startDateTimestamp, endDateTimestamp);
    console.log("mono expence data")
    console.log(mono_expence_data);
    console.log("end mono expence data")

    const mono_income_data = await fetchMonoData(MONO_INCOME_CARD, startDateTimestamp, endDateTimestamp);
    console.log("mono income data")
    console.log(mono_income_data);
    console.log("end mono income data")

    const mono_data = combine_mono_data(mono_income_data, mono_expence_data);
    console.log("mono combined data")
    console.log(mono_data);
    console.log("end mono combined data")

    if (mono_data && mono_data.length > 0) {
      for (const exp of mono_data) {
        let create_trans = new Object();

        create_trans.account = process.env.ACTUAL_CARD;
        create_trans.amount = exp.amount;
        create_trans.date = new Date(exp.time * 1000).toISOString().slice(0, 10);
        create_trans.payee_name = exp.description;

        const found = actual_data.find((actual) => {
            if (create_trans.amount == actual.amount) {
              if (create_trans.payee_name.toUpperCase() === actual.imported_payee.toUpperCase()) {
                log('duplicate: amount' + create_trans.amount + ' payee:' + create_trans.payee_name);
                return true;
              }
              if (create_trans.payee_name.toUpperCase() === actual.payee.toUpperCase()) {
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
      let result = await actualApi.importTransactions(process.env.ACTUAL_CARD, transactions);
      log(result);
    } else {
      log('No new data to be added: ' + transactions.length)
    }

    endDate = startDate;
    TOTAL_DAYS_SYNC -= DEFAULT_DAYS_SYNC;
  }

  await actualApi.shutdown();
};

// fetch initial data
(async () => {
  await fetch_data();
})()

var cron = require('node-cron');

const CRON_ONCE_PER_HOUR = '0 * * * *';
// shedule fetch data for later
cron.schedule(CRON_ONCE_PER_HOUR, async () => {
  await fetch_data();
});
