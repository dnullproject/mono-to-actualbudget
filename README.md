# mono-to-actualbudget

Sync [monobank](https://api.monobank.ua/docs/) to [ActualBudget](https://actualbudget.org/).

## Disclaimer

This is my first steps in JS - this code is brutally bad.

Mainly, this is used for personal purposes -
but feel free to adjust everything under your
needs

## Configure

### Environment Variables

| Environment Variable | Description |
| --- | --- |
| NODE_TLS_REJECT_UNAUTHORIZED | Set to 0 if you have issues with connecting to plain http |
| ACTUAL_URL | URL to ActualBudget server |
| ACTUAL_PASSWORD | Password for ActualBudget server |
| ACTUAL_SYNC_ID | Special ID for ActualServer, can be found under Settings -> Advanced Settings -> Sync ID |
| DAYS_TO_SYNC | How many days need to be synced from now. If count of days bigger than 7, this Service will sync data by 7 days till the end data |
| MONO_TOKEN | Token to your monobank account |
| MONO_CARD_N | N means any numeric value, from 0 and incrementing by 1(like: MONO_CARD_0, MONO_CARD_1 ...). Its value is a pair of monobank card and actual budget id or name in form MONO_CARD:ACTUAL_ID or MONO_CARD:ACTUAL_NAME |

### Deduplication

For deduplication to take place you should not Hide decimals (Settings/Formatting)

## TODO

- [ ] better codebase
- [ ] run non-root
- [x] more that one card
- [ ] docs
- [ ] helm/k8s
- [ ] publish on npm
- [ ] use github docker registry
