// npm install --save @actual-app/api
let actualApi = require('@actual-app/api');

(async () => {
  await actualApi.init({
    dataDir: '.cache/',
    serverURL: process.env.ACTUAL_URL,
    password: process.env.ACTUAL_PASSWORD,
  });

  var fs = require('fs');
  var dir = '.cache';

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  await actualApi.downloadBudget(process.env.ACTUAL_SYNC_ID);
  const endDate = new Date();
  const endDateIso = endDate.toISOString().slice(0, 10);

  const startDate = new Date();
  // set date as now - DAYS_TO_SYNC
  startDate.setDate(endDate.getDate() - parseInt(process.env.DAYS_TO_SYNC));

  const startDateIso = startDate.toISOString().slice(0, 10);
  const startDateTimestamp = startDate.getTime();

  console.log('Sync: ' + startDateIso + ' ' + endDateIso);

  const actual_card = process.env.ACTUAL_CARD;
  const mono_card = process.env.MONO_CARD;
  const mono_url = 'https://api.monobank.ua/';
  const mono_api_token = process.env.MONO_TOKEN;

  let mono_data = Array();
  let Transaction = [];

  // MONO
  async function fetchMonoData() {
    try {
      const response = await fetch(mono_url + '/personal/statement/' + mono_card + '/' + startDateTimestamp, {
        headers: { 'X-Token': mono_api_token, },
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

  async function fetchActualData() {
    try {
      let { actual_data } = await actualApi.runQuery(
          actualApi.q('transactions')
                  .filter({
                    date: [
                      { $gte: startDateIso },
                      { $lte: endDateIso }
                    ]
                  })
                  .select('*')
        );
      // let actual_data = await actualApi.getTransactions(actual_card, startDateIso, endDateIso);
      return actual_data
    } catch (error) {
      console.error(error);
    }
  }

  // const example_actual_trans = [{
  //   // is_parent: false,
  //   // is_child: false,
  //   // parent_id: null,
  //   account: actual_card,
  //   // category: '1111',
  //   amount: -77700,
  //   payee: '333',
  //   // notes: null,
  //   date: startDateIso,
  //   imported_id: null,
  //   // error: null,
  //   // imported_payee: null,
  //   // starting_balance_flag: false,
  //   // transfer_id: null,
  //   // sort_order: 1705047040628,
  //   // cleared: false,
  //   // reconciled: false,
  //   // tombstone: false,
  //   // schedule: null,
  //   // subtransactions: []
  // }];
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

  actual_data = await fetchActualData();
  console.log("actual data")
  console.log(actual_data);
  console.log("end actual data")
  mono_data = await fetchMonoData();
  console.log("mono data")
  console.log(mono_data);
  console.log("end mono data")

  if (mono_data && mono_data.length > 0) {
    for (const exp of mono_data) {
      let create_trans = new Object();

      create_trans.account = actual_card;
      create_trans.amount = exp.amount;
      create_trans.date = new Date(exp.time * 1000).toISOString().slice(0, 10);
      create_trans.payee_name = exp.description;

      const found = actual_data.find((actual) => {
          console.log("comparing " + JSON.stringify(create_trans) + " with " + JSON.stringify(actual));
          if (create_trans.amount == actual.amount) {
            if (create_trans.payee_name == actual.imported_payee) {
              console.log('duplicate: amount' + create_trans.amount + ' payee:' + create_trans.payee_name);
              return true;
            }
            if (create_trans.payee_name == actual.payee) {
              console.log('duplicate:: amount' + create_trans.amount + ' payee:' + create_trans.payee_name);
              return true;
            }
          }
          return false;
        }
      );

      if (found) {
        console.log('skipping date: ' + create_trans.date + 'amount: ' + create_trans.amount + ' payee: ' + create_trans.payee_name);
      } else {
        console.log('create date: ' + create_trans.date + 'amount: ' + create_trans.amount + ' payee: ' + create_trans.payee_name);
        Transaction.push(create_trans);
      }
    }
  }

  if (Transaction.length > 0) {
    console.log("transactions")
    console.log(Transaction)
    console.log("end transactions")
    let result = await actualApi.addTransactions(actual_card, Transaction);
    console.log(result);
  } else {
    console.log('No new data to be added: ' + Transaction.length)
  }

  await actualApi.shutdown();
})();
