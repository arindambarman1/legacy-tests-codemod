const { getParser } = require('codemod-cli').jscodeshift;
const { exampleTransform } = require('../../utils/acceptance/example-transform');
const { trackingPageEventMigration } = require('./tracking_page_event_migration');
const {
  removeImport, addImport, removeSpecificImport
} = require('../../utils/imports');
const {
  findCallExpression,
} = require('../../utils/function');
const { replaceIdentifier, replaceIdentifierWithAwaitIdentifier } = require('../../utils/identifier');

module.exports = function transformer(file, api) {
  const j = getParser(api);
  let code = file.source;

  // containerLookup to this.owner.lookup
  code = removeImport(j, code, 'embercom/lib/container-lookup');
  code = replaceIdentifier(j, code, 'containerLookup', 'this.owner.lookup');

  // fetching store
  code = removeImport(j, code, 'embercom/lib/container-lookup');
  code = findCallExpression(j, code, "getEmberDataStore")
    .forEach(path => {
      j(path).replaceWith(j.identifier("this.owner.lookup('service:store')"))
    })
    .toSource();

  // register and inject helpers
  code = j(code)
  .find(j.MemberExpression, {
    object: {
      object: {
        type: 'ThisExpression',
      },
      property: {
        name: 'application',
      },
    },
  })
  .forEach(path => {
    if (path.value.property.name === 'register') {
      path.value.object.property.name = 'owner';
    } else if (path.value.property.name === 'inject') {
      j(path.parent).remove();
    }
  })
  .toSource();


  // click-ignore-timer to await click
  code = ((internalCode) => {
    let exists;
    internalCode = j(internalCode)
    .find(j.Identifier, { name: 'clickIgnoreTimers' })
    .forEach(path => {
      exists = true;
      j(path).replaceWith(j.identifier('await click'));
    })
    .closest(j.FunctionExpression).forEach(path => {
      path.value.async = true;
    }).toSource();

    if (exists) {
      internalCode = addImport(j, internalCode, 'click', '@ember/test-helpers');
    }

    return internalCode;
  })(code);

  // track_page_events.input migration
  code = trackingPageEventMigration(j, code);

  return code;
};
