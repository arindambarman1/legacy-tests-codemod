
moduleForAcceptance('Team Articles | Acceptance | Site settings', {});

test('Custom path and prefix', async function(assert) {
  let site = this.owner.lookup('service:store').peekRecord('help-center-site', 1);
});
