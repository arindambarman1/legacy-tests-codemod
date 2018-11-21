
import { getEmberDataStore } from 'embercom/lib/container-lookup';

moduleForAcceptance('Team Articles | Acceptance | Site settings', {});

test('Custom path and prefix', async function(assert) {
  let site = getEmberDataStore().peekRecord('help-center-site', 1);
});
