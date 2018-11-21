const { getParser } = require('codemod-cli').jscodeshift;
const { exampleTransform } = require('../../utils/acceptance/example-transform');

module.exports = function transformer(file, api) {
  const j = getParser(api);
  let code = file.source;

  let code = file.source;

  // fetching store
  code = removeImport(j, code, 'embercom/lib/container-lookup');

  code = j(code)
    .find(j.CallExpression, {
      callee: {
        name: "getEmberDataStore"
      }
    })
    .forEach(path => {
      j(path).replaceWith(j.identifier("this.owner.lookup('service:store')"))
    })
    .toSource();

  return code;
};
